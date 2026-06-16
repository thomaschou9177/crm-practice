// supabase/functions/processExcel/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 這是 Edge Function 的主要進入點
Deno.serve(async (req) => {
  // 1. 處理 Preflight OPTIONS 請求 (這解決了 CORS 錯誤)
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    // 2. 僅允許 POST 請求
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    
    
    // 1. 從請求 Body 中取得 tenant 資訊
    const { batchIndex, customers, infos,tenant,appendIfDuplicate,onlyCheck } = await req.json();
    // 2. 決定要使用的 Schema：如果有傳入 tenant 就用它，否則預設為 'public'
    const targetSchema = tenant || 'public';
    // 3. 根據目標 Schema 初始化 Client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: targetSchema } } // 關鍵：動態切換 Schema 
    );
    // ====================================================================
    // 🔍 預檢機制：【已修復 URL 過長問題】分段排查 Email 是否重複
    // ====================================================================
    const batchEmails = customers.map((c: any) => c.email).filter(Boolean);
    const duplicateRecords: any[] = [];
    
    // 💡 設定每一小批次只查 5000 個 Email，防止 URL 長度爆掉
    const chunkSize = 5000; 
    for (let i = 0; i < batchEmails.length; i += chunkSize) {
      const chunk = batchEmails.slice(i, i + chunkSize);
      
      const { data: chunkDuplicates, error: checkError } = await supabase
        .from("customer")
        .select("id, email")
        .in("email", chunk);

      if (checkError) throw checkError;
      if (chunkDuplicates) {
        duplicateRecords.push(...chunkDuplicates);
      }
    }

    // 如果分段撈完後，發現有任何重複，直接回報並阻斷
    if (duplicateRecords.length > 0) {
      const duplicateIds = duplicateRecords.map((r) => r.id).sort((a, b) => a - b);
      const totalDuplicates = duplicateRecords.length;

      return new Response(
        JSON.stringify({
          success: false,
          error: `偵測到 Email 與資料庫重複！\n重疊資料總數：${totalDuplicates} 筆\n資料庫中已佔用此 Email 的客戶 ID 列表：[ ${duplicateIds.join(", ")} ]\n為保護資料結構，已強制中止本次上傳動作。`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // 🟢【核心控制】：如果是純檢查模式，到這裡沒重複就可以安全退出了，絕不寫入資料庫
    if (onlyCheck === true) {
      return new Response(
        JSON.stringify({ success: true, message: "預檢通過，無重複資料" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ====================================================================
    // 🚀 安全過濾通過，開始整理資料 Payload
    // ====================================================================
    // 處理資料邏輯...
    const fixedKeys = ["id", "name", "email", "role"];
    // 🟢【新增自動化步驟】如果是追加模式，先用 Service Role 查出目前資料庫的最大 ID
    let currentMaxId = 0;
    if (appendIfDuplicate === true) {
      const { data: maxData } = await supabase
        .from("customer")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);
      
      if (maxData && maxData.length > 0) {
        currentMaxId = maxData[0].id;
      }
    }
    
    // 🟢 修改 map 邏輯
    let incrementalId = currentMaxId; // 計數器指針
    const customerPayload = customers.map((c: any) => {
      const metadata: Record<string, any> = {};
      Object.keys(c).forEach((key) => {
        if (!fixedKeys.includes(key)) metadata[key] = c[key];
      });
      // 🟢 1. 在後端做最後一線的安全檢查，強制確保 c.id 是純整數
      let cleanId = (c.id !== null && c.id !== undefined) ? Math.floor(Number(c.id)) : null;

      // 如果轉出來不幸是 NaN，設為 null
      if (Number.isNaN(cleanId)) cleanId = null;

      // 🟢 行為分支邏輯
      if (appendIfDuplicate === true) {
        // 【情況 A：使用者勾選追加】
        // 🟢 密技：不再交給 Sequence，我們自己在程式碼中發號牌，保證連續不跳號！
        incrementalId++;
        return { id: incrementalId,name: c.name, email: c.email, role: c.role, metadata };
      } else {
        // 【情況 B：使用者未勾選追加（預設，欲取消動作）】
        // 我們誠實把 Excel 的 id 傳過去。
        // 如果這個 id 存在，因爲我們設定的是 .upsert(..., { onConflict: 'email' })
        // 如果 email 沒有重複但 id 重複了，PostgreSQL 就會拋出原汁原味的主鍵唯一性衝突錯誤 (500)
        // 這個錯誤會被內層 catch 抓住並回傳給前端，前端隨即彈出 Alert 視窗並中止其餘批次上傳！
        return { id: cleanId, name: c.name, email: c.email, role: c.role, metadata };
      }
    });
    // ====================================================================
    // 🟢【新增】全新的「雙軌寫入機制」：完美分流 Upsert 追加與 Insert 嚴格阻斷
    // ====================================================================
    let insertedCustomers = null;
    let customerError = null;
    if (appendIfDuplicate === true) {
      // 【情境 A：使用者勾選追加】
      // 🚨 修正：當勾選追加時，如果 email 發生重複，舊的寫法只會回傳舊資料的 email
      // 卻「不會」回傳舊資料的 ID，導致下方的 customer_info 拿不到 ID 寫入失敗！
      // 改用 .upsert(..., { onConflict: 'email', ignoreDuplicates: false }) 確保回傳所有實體 ID
      const res = await supabase
        .from("customer")
        .upsert(customerPayload, { onConflict: 'email', ignoreDuplicates: false })
        .select("id, email");
      insertedCustomers = res.data;
      customerError = res.error;
    } else {
      // 【情境 B：使用者未勾選（重複時必須取消並噴錯）】
      // 核心關鍵：直接改成標準的 .insert()！不給任何轉更新（Update）的退路
      // 只要 Excel 的 ID 敢跟資料庫重複，PostgreSQL 就會 100% 拋出 customer_pkey 唯一約束錯誤！
      const res = await supabase
        .from("customer")
        .insert(customerPayload)
        .select("id, email");
      insertedCustomers = res.data;
      customerError = res.error;
    }
    if (customerError) throw customerError;

    // 2. 利用剛剛成功寫入後，資料庫分配/找到的正確主鍵 id，建立 info 關聯
    if (insertedCustomers && insertedCustomers.length > 0) {
      // 🚨 修正：過濾掉 id 為 null 的無效資料，確保 Payload 絕對安全
      const infoPayload = insertedCustomers
                          .filter((inserted) => inserted.id !== null && inserted.id !== undefined)
                          .map((inserted) => ({
                               id: inserted.id, // 精準對齊的外鍵 id
                               email: inserted.email
                          }));

      // 3. 寫入 customer_info，以 id (主鍵) 作為重複判定
      // 只有當真的有有效的 infoPayload 時才執行寫入，避免空的 Array 呼叫語法錯誤
      if (infoPayload.length > 0) {
        const { error: infoError } = await supabase
          .from("customer_info")
          .upsert(infoPayload, { onConflict: 'id' });
          
        if (infoError) throw infoError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, batchIndex }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    // 🚨 修正：不要用 500，維持 400，這樣前端的 PostgREST Client 才會正確認定它是個可攔截的請求錯誤
    return new Response(
      JSON.stringify({ success: false, error: error.message || String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
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
    const { batchIndex, customers, infos,tenant,appendIfDuplicate } = await req.json();
    // 2. 決定要使用的 Schema：如果有傳入 tenant 就用它，否則預設為 'public'
    const targetSchema = tenant || 'public';
    // 3. 根據目標 Schema 初始化 Client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: targetSchema } } // 關鍵：動態切換 Schema 
    );
    // 處理資料邏輯...
    const fixedKeys = ["id", "name", "email", "role"];
    const customerPayload = customers.map((c: any) => {
      const metadata: Record<string, any> = {};
      Object.keys(c).forEach((key) => {
        if (!fixedKeys.includes(key)) metadata[key] = c[key];
      });
      // 🟢 行為分支邏輯
      if (appendIfDuplicate === true) {
        // 【情況 A：使用者勾選追加】
        // 我們完全不傳入任何 id 屬性！
        // 這樣資料庫會直接觸發 SERIAL 的 nextval()，自動追加到全資料庫最新、最後面的序列 ID
        return { name: c.name, email: c.email, role: c.role, metadata };
      } else {
        // 【情況 B：使用者未勾選追加（預設，欲取消動作）】
        // 我們誠實把 Excel 的 id 傳過去。
        // 如果這個 id 存在，因爲我們設定的是 .upsert(..., { onConflict: 'email' })
        // 如果 email 沒有重複但 id 重複了，PostgreSQL 就會拋出原汁原味的主鍵唯一性衝突錯誤 (500)
        // 這個錯誤會被內層 catch 抓住並回傳給前端，前端隨即彈出 Alert 視窗並中止其餘批次上傳！
        return { id: c.id, name: c.name, email: c.email, role: c.role, metadata };
      }
    });

    // 1. 🟢 修改：寫入 customer 時加上 .select()，這樣能把 PostgreSQL 自動生成的 id 撈回來！
    const { data: insertedCustomers, error: customerError } = await supabase
      .from("customer")
      .upsert(customerPayload, { onConflict: 'email' }) // 依據 email 判定重複
      .select("id, email"); // 👈 關鍵：把新生成的 id 與 email 抓出來

    if (customerError) throw customerError;

    // 2. 利用剛剛成功寫入後，資料庫分配/找到的正確主鍵 id，建立 info 關聯
    if (insertedCustomers && insertedCustomers.length > 0) {
      const infoPayload = insertedCustomers.map((inserted) => ({
        id: inserted.id, // 精準對齊的外鍵 id
        email: inserted.email
      }));

      // 3. 寫入 customer_info，以 id (主鍵) 作為重複判定
      const { error: infoError } = await supabase
        .from("customer_info")
        .upsert(infoPayload, { onConflict: 'id' });
        
      if (infoError) throw infoError;
    }

    return new Response(
      JSON.stringify({ success: true, batchIndex }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
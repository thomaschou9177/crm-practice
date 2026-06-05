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
    const { batchIndex, customers, infos,tenant } = await req.json();
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
      return { name: c.name, email: c.email, role: c.role, metadata };
    });

    // 1. 🟢 修改：寫入 customer 時加上 .select()，這樣能把 PostgreSQL 自動生成的 id 撈回來！
    const { data: insertedCustomers, error: customerError } = await supabase
      .from("customer")
      .upsert(customerPayload, { onConflict: 'email' }) // 依據 email 判定重複
      .select("id, email"); // 👈 關鍵：把新生成的 id 與 email 抓出來

    if (customerError) throw customerError;

    // 2. 🟢 修改：利用剛剛拿到的最新一對一 id，來建立對應的 infoPayload
    const infoPayload = insertedCustomers.map((inserted) => {
      // 在 infos 陣列中尋找 email 相同的那筆原始資料（用來保留可能存在的其他 info 欄位）
      // 這裡確保 customer_info 的 id 一定能精準對上 customer 表剛產生的自增 id！
      return {
        id: inserted.id, // 👈 100% 正確的安全外鍵 id
        email: inserted.email
      };
    });

    // 3. Upsert Info
    const { error: infoError } = await supabase
      .from("customer_info")
      .upsert(infoPayload, { onConflict: 'id' }); // 依據外鍵主鍵判定重複
      
    if (infoError) throw infoError;

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
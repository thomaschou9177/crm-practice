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
      return { id: c.id, name: c.name, email: c.email, role: c.role, metadata };
    });

    const infoPayload = infos.map((i: any) => ({ id: i.id, email: i.email }));

    // Upsert Customer(此時會自動作用於 targetSchema)
    const { error: customerError } = await supabase.from("customer").upsert(customerPayload);
    if (customerError) throw customerError;

    // Upsert Info
    const { error: infoError } = await supabase.from("customer_info").upsert(infoPayload);
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
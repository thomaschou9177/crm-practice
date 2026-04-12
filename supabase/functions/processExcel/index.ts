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

    // 初始化 Supabase (建議開發完後改用 SERVICE_ROLE_KEY 以避開 RLS 限制)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! 
    );

    const { batchIndex, customers, infos } = await req.json();

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

    // Upsert Customer
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
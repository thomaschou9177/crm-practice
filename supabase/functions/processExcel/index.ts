// supabase/functions/processExcel/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 共用的 CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // 或改成 "https://crm-practice.vercel.app" 只允許你的前端
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 處理 preflight request
export async function OPTIONS() {
  return new Response("ok", { status: 200,headers: corsHeaders });
}

export async function POST(req: Request) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  try {
    const { batchIndex, customers, infos } = await req.json();

    const fixedKeys = ["id", "name", "email", "role"];

    // customer payload：固定欄位 + metadata
    const customerPayload = customers.map((c: any) => {
      const metadata: Record<string, any> = {};
      Object.keys(c).forEach((key) => {
        if (!fixedKeys.includes(key)) {
          metadata[key] = c[key];
        }
      });

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.role,
        metadata,
      };
    });

    // customer_info payload：只存 id + email
    const infoPayload = infos.map((i: any) => ({
      id: i.id,
      email: i.email,
    }));

    // upsert customer
    const { error: customerError } = await supabase
      .from("customer")
      .upsert(customerPayload, { onConflict: "id" });

    if (customerError) {
      console.error("Customer upsert error:", customerError);
      return new Response(JSON.stringify({ error: customerError }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // upsert customer_info
    const { error: infoError } = await supabase
      .from("customer_info")
      .upsert(infoPayload, { onConflict: "id" });

    if (infoError) {
      console.error("Customer_info upsert error:", infoError);
      return new Response(JSON.stringify({ error: infoError }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({ success: true, batchIndex }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to process batch" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

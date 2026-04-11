// supabase/functions/processExcel/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // 用 Service Role Key，避免 anon key 限制
);

serve(async (req) => {
  // ✅ CORS 設定
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const { batchIndex, customers, infos } = await req.json();

    // ✅ 批次 upsert，避免單筆 insert 太慢
    const { error: customerError } = await supabase
      .from("customer")
      .upsert(customers, { onConflict: "id" });

    if (customerError) throw customerError;

    const { error: infoError } = await supabase
      .from("customer_info")
      .upsert(infos, { onConflict: "id" });

    if (infoError) throw infoError;

    return new Response(
      JSON.stringify({ success: true, batchIndex }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*", // ✅ 回應也要帶 CORS
        },
      }
    );
  } catch (err) {
    console.error("processExcel error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

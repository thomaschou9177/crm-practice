// supabase/functions/processExcel/index.ts
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const { batchIndex, customers, infos } = await req.json();

    const fixedKeys = ["id", "name", "email", "role"];

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

    const infoPayload = infos.map((i: any) => ({
      id: i.id,
      email: i.email,
    }));

    const { error: customerError } = await supabase
      .from("customer")
      .upsert(customerPayload, { onConflict: "id" });

    if (customerError) {
      console.error("Customer upsert error:", customerError);
      return new Response(JSON.stringify({ error: customerError }), { status: 500 });
    }

    const { error: infoError } = await supabase
      .from("customer_info")
      .upsert(infoPayload, { onConflict: "id" });

    if (infoError) {
      console.error("Customer_info upsert error:", infoError);
      return new Response(JSON.stringify({ error: infoError }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, batchIndex }), { status: 200 });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: "Failed to process batch" }), { status: 500 });
  }
}

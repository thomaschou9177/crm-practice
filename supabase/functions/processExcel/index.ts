// supabase/functions/processExcel/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { batchIndex, customers, infos } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    )

    if (customers && customers.length > 0) {
      const { error: err1 } = await supabaseAdmin.from('customer').upsert(customers, { onConflict: 'id' })
      if (err1) throw err1
    }

    if (infos && infos.length > 0) {
      const { error: err2 } = await supabaseAdmin.from('customer_info').upsert(infos, { onConflict: 'id' })
      if (err2) throw err2
    }

    return new Response(
      JSON.stringify({ message: "Batch Success", processed: customers?.length || 0, batchIndex }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (err: any) {
    console.error("Error detail:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})


// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs



import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ExcelJS from 'https://esm.sh/exceljs@4.4.0'

console.log("Hello from Functions!")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. 處理 CORS 預檢請求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { filename } = await req.json()
    
    // 初始化 Supabase Client (使用 Service Role Key 以繞過 RLS 限制)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. 從 Storage 下載檔案
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('crm-bucket')
      .download(`uploads/${filename}`)

    if (downloadError) throw new Error(`Download error: ${downloadError.message}`)

    // 3. 讀取 Excel (對於 100 萬筆，建議先在本地轉成 CSV，ExcelJS load 仍會吃不少記憶體)
    const workbook = new ExcelJS.Workbook()
    const arrayBuffer = await fileData.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)
    const worksheet = workbook.worksheets[0]

    const BATCH_SIZE = 1000 // 每 1000 筆寫入一次資料庫，避免請求過大
    let customers = []
    let infos = []
    let count = 0

    // 4. 逐行處理資料
    worksheet.eachRow(async (row, rowNumber) => {
      if (rowNumber === 1) return // 跳過標題列

      // 注意：ExcelJS row.values 的 Index 1 是 A 欄
      const values: any = row.values
      const id = Number(values[1])
      const email = String(values[3] || "")

      customers.push({
        id: id,
        name: String(values[2] || ""),
        email: email,
        role: String(values[4] || ""),
        metadata: {
          age: values[5],
          birthday: values[6],
          education: values[7]
        }
      })

      infos.push({ id, email })
      count++

      // 5. 批次寫入資料庫
      if (customers.length >= BATCH_SIZE) {
        const currentBatch = [...customers]
        const currentInfos = [...infos]
        customers = []
        infos = []

        // 使用 upsert 處理，若 ID 重複則更新
        await supabaseAdmin.from('Customer').upsert(currentBatch, { onConflict: 'id' })
        await supabaseAdmin.from('Customer_info').upsert(currentInfos, { onConflict: 'id' })
      }
    })

    // 處理剩餘不足一個 BATCH 的資料
    if (customers.length > 0) {
      await supabaseAdmin.from('Customer').upsert(customers, { onConflict: 'id' })
      await supabaseAdmin.from('Customer_info').upsert(infos, { onConflict: 'id' })
    }

    return new Response(
      JSON.stringify({ message: "Success", processedRows: count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})


/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/processExcel' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

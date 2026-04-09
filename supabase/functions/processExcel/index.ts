// supabase/functions/processExcel/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ExcelJS from 'https://esm.sh/exceljs@4.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { filename } = await req.json()
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    )

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('crm-bucket')
      .download(`uploads/${filename}`)

    if (downloadError) throw new Error(`Download error: ${downloadError.message}`)

    const arrayBuffer = await fileData.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const worksheet = workbook.worksheets[0]

    const customers = []
    const infos = []
    
    // 找出標題索引 (避免硬編碼欄位順序)
    const headerRow = worksheet.getRow(1)
    const colMap: Record<string, number> = {}
    headerRow.eachCell((cell, colNumber) => {
      const val = cell.value ? String(cell.value).toLowerCase().trim() : ""
      colMap[val] = colNumber
    })

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // 跳過標題列

      // --- 修正重點：確保 id 有被定義 ---
      const idValue = row.getCell(colMap['id']).value
      if (idValue === null || idValue === undefined) return // 略過沒 ID 的行

      const id = Number(idValue) // 在這裡宣告 id
      const email = String(row.getCell(colMap['email']).value || "")

      customers.push({
        id: id, // 現在 id 被定義了
        name: String(row.getCell(colMap['name']).value || ""),
        email: email,
        role: String(row.getCell(colMap['role']).value || ""),
        metadata: {
          age: row.getCell(colMap['age']).value,
          birthday: row.getCell(colMap['birthday']).value,
          education: row.getCell(colMap['education']).value
        }
      })

      infos.push({ id, email })
    })

    // 執行 Upsert (建議分批，如果是 100 萬筆請參考之前的批次邏輯)
    const { error: err1 } = await supabaseAdmin.from('customer').upsert(customers, { onConflict: 'id' })
    if (err1) throw err1

    const { error: err2 } = await supabaseAdmin.from('customer_info').upsert(infos, { onConflict: 'id' })
    if (err2) throw err2

    return new Response(
      JSON.stringify({ message: "Success", totalRows: customers.length }),
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
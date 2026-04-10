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
    const { filename, batchIndex,  } = await req.json()
    const batchSize=100;// 固定每批 100 筆
    if (!filename) throw new Error("No filename provided")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    )

    // 下載檔案
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('crm-bucket')
      .download(`uploads/${filename}`)
    if (downloadError) throw new Error(`Download error: ${downloadError.message}`)

    // 使用 streaming parser
    const workbook = new ExcelJS.Workbook()
    const stream = fileData.stream()
    await workbook.xlsx.read(stream)

    const worksheet = workbook.worksheets[0]

    // 計算批次範圍
    const startRow = batchIndex * batchSize + 2 // 跳過標題列
    const endRow = Math.min(startRow + batchSize - 1, worksheet.rowCount)

    const customers: any[] = []
    const infos: any[] = []

    // 建立欄位索引
    const headerRow = worksheet.getRow(1)
    const colMap: Record<string, number> = {}
    headerRow.eachCell((cell, colNumber) => {
      const val = cell.value ? String(cell.value).toLowerCase().trim() : ""
      colMap[val] = colNumber
    })

    // 逐行讀取，只處理需要的範圍
    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
      const row = worksheet.getRow(rowNumber)
      if (!row || row.cellCount === 0) continue

      const idValue = row.getCell(colMap['id']).value
      if (idValue === null || idValue === undefined) continue

      const id = Number(idValue)
      const email = String(row.getCell(colMap['email']).value || "")

      customers.push({
        id,
        name: String(row.getCell(colMap['name']).value || ""),
        email,
        role: String(row.getCell(colMap['role']).value || ""),
      })

      infos.push({ id, email })
    }

    // 分批 Upsert
    if (customers.length > 0) {
      const { error: err1 } = await supabaseAdmin.from('customer').upsert(customers, { onConflict: 'id' })
      if (err1) throw err1
    }

    if (infos.length > 0) {
      const { error: err2 } = await supabaseAdmin.from('customer_info').upsert(infos, { onConflict: 'id' })
      if (err2) throw err2
    }

    return new Response(
      JSON.stringify({ message: "Batch Success", processed: customers.length, batchIndex }),
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

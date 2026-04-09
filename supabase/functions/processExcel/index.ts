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
    console.log(`開始處理檔案: ${filename}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    )

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('crm-bucket')
      .download(`uploads/${filename}`)

    if (downloadError) throw new Error(`下載失敗: ${downloadError.message}`)

    const arrayBuffer = await fileData.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const worksheet = workbook.worksheets[0]

    const customers = []
    const infos = []
    
    // 取得標題列 (第一行) 來尋找欄位索引
    const headerRow = worksheet.getRow(1)
    const colMap: Record<string, number> = {}
    headerRow.eachCell((cell, colNumber) => {
      colMap[String(cell.value).toLowerCase()] = colNumber
    })

    console.log("偵測到的欄位:", colMap)

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      // 安全地抓取數值
      const getValue = (key: string) => row.getCell(colMap[key] || 0).value
      
      const rawId = getValue('id')
      if (!rawId) return // 跳過沒有 ID 的行

      const customerObj = {
        id: Number(rawId),
        name: String(getValue('name') || ""),
        email: String(getValue('email') || ""),
        role: String(getValue('role') || ""),
        metadata: {
          age: getValue('age'),
          birthday: getValue('birthday'),
          education: getValue('education')
        }
      }

      customers.push(customerObj)
      infos.push({ id: Number(rawId), email: String(getValue('email') || "") })
    })

    console.log(`準備寫入 ${customers.length} 筆資料`)

    // 執行寫入
    const { error: insertErr } = await supabaseAdmin.from('Customer').upsert(customers, { onConflict: 'id' })
    if (insertErr) throw insertErr

    const { error: infoErr } = await supabaseAdmin.from('Customer_info').upsert(infos, { onConflict: 'id' })
    if (infoErr) throw infoErr

    return new Response(
      JSON.stringify({ message: "Success", totalRows: customers.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (err: any) {
    console.error("發生錯誤:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
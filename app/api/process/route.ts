// src/app/api/process/route.ts
import { prisma } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  try{
    const { filename, batchIndex, batchSize } = await req.json();
    // --- 排錯日誌：記錄嘗試存取的完整路徑 ---
      const fullPath = `uploads/${filename}`;
      console.log("正在嘗試從 crm-bucket 下載檔案，路徑為:", fullPath);
    const { data,error } = await supabase.storage.from("crm-bucket").download(fullPath);
    if (error || !data) {
      return NextResponse.json({ 
            error: "File not found or download failed",
            supabaseError: error, // 這裡會顯示 Supabase 給出的具體錯誤 (例如 404 Object Not Found 或 403 Forbidden)
            attemptedPath: fullPath 
          }, { status: 404 });
    }
    const buffer = await data.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const batch = rows.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);

    await prisma.customer.createMany({
      data: batch.map((r: any) => ({
        name: r.name,
        email: r.email,
        role: r.role,
        metadata: r.metadata || {},
      })),
      skipDuplicates: true,
    });

    await prisma.customer_info.createMany({
      data: batch.map((r: any) => ({
        email: r.email,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ processed: batch.length });
  }catch (err: any) {
    // 捕捉其他程式碼錯誤
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: err.message 
    }, { status: 500 });
  }  
}

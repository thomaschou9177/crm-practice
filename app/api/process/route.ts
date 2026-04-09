// src/app/api/process/route.ts
import { prisma } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  try {
    const { filename, batchIndex, batchSize } = await req.json();
    const fullPath = `uploads/${filename}`;

    const { data, error } = await supabase.storage
      .from("crm-bucket")
      .download(fullPath);

    if (error || !data) {
      return NextResponse.json({ error: "File not found", details: error }, { status: 404 });
    }

    const buffer = await data.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const batch = rows.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);

    // 1. 準備 Customer 表的資料 (包含 ID)
    const customerData = batch.map((r: any) => ({
      id: Number(r.id), // 強制轉為數字，解決非自動遞增的主鍵問題
      name: String(r.name || ""),
      email: String(r.email || ""),
      role: String(r.role || ""),
      metadata: {
        age: r.age,
        birthday: r.birthday,
        education: r.education
      },
    }));

    // 2. 準備 Customer_info 表的資料
    // 注意：如果 customer_info 的 id 也不是自動遞增，你可能也需要給它一個 ID
    // 這裡假設 customer_info 的 ID 跟 customer 一樣，或是你有另一個欄位
    const customerInfoData = batch.map((r: any) => ({
      id: Number(r.id), // 同步加上 ID
      email: String(r.email || ""),
    }));

    // 執行寫入，使用 skipDuplicates 防止 ID 重複導致崩潰
    await prisma.customer.createMany({
      data: customerData,
      skipDuplicates: true,
    });

    await prisma.customer_info.createMany({
      data: customerInfoData,
      skipDuplicates: true,
    });

    return NextResponse.json({ processed: batch.length });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      message: err.message // 這邊會傳回具體的 Prisma 錯誤原因
    }, { status: 500 });
  }
}
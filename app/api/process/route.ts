// src/app/api/process/route.ts
import { prisma } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { filename, batchIndex, batchSize } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: "No filename provided" }, { status: 400 });
    }

    const fullPath = `uploads/${filename}`;
    const { data, error } = await supabase.storage
      .from("crm-bucket")
      .download(fullPath);

    if (error || !data) {
      return NextResponse.json({ error: "File not found", details: error?.message }, { status: 404 });
    }

    const buffer = await data.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    const startRow = batchIndex * batchSize + 2; // 跳過標題列
    const endRow = Math.min(startRow + batchSize - 1, worksheet.rowCount);

    const batchData: any[] = [];
    const batchInfoData: any[] = [];

    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (!row || row.cellCount === 0) continue;

      const r: any = {};
      row.eachCell((cell, colNumber) => {
        const header = worksheet.getRow(1).getCell(colNumber).value as string;
        r[header] = cell.value;
      });

      batchData.push({
        id: Number(r.id),
        name: String(r.name || ""),
        email: String(r.email || ""),
        role: String(r.role || ""),
        metadata: {
          age: r.age,
          birthday: r.birthday,
          education: r.education,
        },
      });

      batchInfoData.push({
        id: Number(r.id),
        email: String(r.email || ""),
      });
    }

    // 使用 transaction 批量插入，避免逐筆寫入
    if (batchData.length > 0 || batchInfoData.length > 0) {
      await prisma.$transaction([
        prisma.customer.createMany({ data: batchData, skipDuplicates: true }),
        prisma.customer_info.createMany({ data: batchInfoData, skipDuplicates: true }),
      ]);
    }

    return NextResponse.json({ processed: batchData.length });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({
      error: "Internal Server Error",
      message: err.message,
    }, { status: 500 });
  }
}

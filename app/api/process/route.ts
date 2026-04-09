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

    // 建立 streaming reader
    const buffer = await data.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    let startRow = batchIndex * batchSize + 2; // 跳過標題列
    let endRow = startRow + batchSize - 1;
    let processed = 0;

    // 逐行讀取並直接寫入 DB
    for (let rowNumber = startRow; rowNumber <= endRow && rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (!row || row.cellCount === 0) continue;

      const r: any = {};
      row.eachCell((cell, colNumber) => {
        const header = worksheet.getRow(1).getCell(colNumber).value as string;
        r[header] = cell.value;
      });

      // 寫入 customer
      await prisma.customer.create({
        data: {
          id: Number(r.id),
          name: String(r.name || ""),
          email: String(r.email || ""),
          role: String(r.role || ""),
          metadata: {
            age: r.age,
            birthday: r.birthday,
            education: r.education,
          },
        },
      });

      // 寫入 customer_info
      await prisma.customer_info.create({
        data: {
          id: Number(r.id),
          email: String(r.email || ""),
        },
      });

      processed++;
    }

    return NextResponse.json({ processed });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({
      error: "Internal Server Error",
      message: err.message,
    }, { status: 500 });
  }
}

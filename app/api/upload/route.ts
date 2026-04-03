import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // 取得上傳的檔案
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 讀取 Excel buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // 假設 Excel 第一個工作表就是 customer 資料
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);

    // 逐筆寫入 customer + customer_info
    // 在循環內加入 try-catch，避免一筆失敗就全盤皆輸
for (const row of rows) {
  try {
    console.log("正在處理行資料:", row); // 👈 加入這行，看看欄位名稱對不對
    const id = Number(row["id"]);
    if (isNaN(id)) continue; // 跳過 ID 不是數字的列
    // ✅ 修正點：必須在這裡定義 metadata 變數
    const metadata: Record<string, any> = {};
    for (const key of Object.keys(row)) {
        // 排除固定欄位，剩下的存入 metadata
        if (!["id", "name", "email", "role"].includes(key)) {
          metadata[key] = row[key];
        }
    }
    await prisma.customer.upsert({
      where: { id },
      update: {
        name: String(row["name"] || ""),
        email: String(row["email"] || ""),
        role: String(row["role"] || ""),
        metadata: metadata,
      },
      create: {
        id,
        name: String(row["name"] || ""),
        email: String(row["email"] || ""),
        role: String(row["role"] || ""),
        metadata: metadata,
      }
    });

    // 建議分開處理 customer_info 以確保穩定
    await prisma.customer_info.upsert({
      where: { id },
      update: { email: String(row["email"] || "") },
      create: { id, email: String(row["email"] || "") }
    });
  } catch (e) {
    console.error(`Error processing row ID ${row["id"]}:`, e);
  }
}

    return Response.redirect(new URL('/dashboard', req.url));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to process Excel file" }, { status: 500 });
  }
}

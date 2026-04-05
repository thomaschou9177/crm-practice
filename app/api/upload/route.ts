import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // ✅ 強制 Node.js runtime

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);

    const batchSize = 500;
    let processed = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((row) => {
        const id = Number(row["id"]);
        if (isNaN(id)) return null;

        const metadata: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          if (!["id", "name", "email", "role"].includes(key)) {
            metadata[key.toLowerCase()] = row[key];
          }
        }

        return {
          id,
          name: String(row["name"] || ""),
          email: String(row["email"] || ""),
          role: String(row["role"] || ""),
          metadata,
        };
      }).filter(Boolean) as any[];

      await prisma.customer.createMany({
        data: batch,
        skipDuplicates: true,
      });

      const infoBatch = batch.map((c) => ({
        id: c.id,
        email: c.email,
      }));
      await prisma.customer_info.createMany({
        data: infoBatch,
        skipDuplicates: true,
      });

      processed += batch.length;
      console.log(`✅ 已完成批次 ${i / batchSize + 1}，累計處理 ${processed} 筆`);
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to process Excel file" }, { status: 500 });
  }
}

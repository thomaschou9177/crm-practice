import { prisma } from "@/lib/db";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 讀取 Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);

    // 上傳到 S3（可選，這裡保留）
    const s3 = new S3Client({ region: process.env.AWS_REGION! });
    const key = `uploads/${Date.now()}-${file.name}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
    }));

    // 立即匯入 DB
    const batchSize = 1000;
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

      await prisma.customer_info.createMany({
        data: batch.map((c) => ({ id: c.id, email: c.email })),
        skipDuplicates: true,
      });

      processed += batch.length;
    }

    return NextResponse.json({ status: "ok", processed, total: rows.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to upload and import" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

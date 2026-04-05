// scripts/worker.ts
import { prisma } from "@/lib/db";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as XLSX from "xlsx";

async function processFile(fileId: string) {
  const s3 = new S3Client({ region: process.env.AWS_REGION! });

  // 從 S3 下載檔案
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: fileId,
    })
  );

  const buffer = await res.Body?.transformToByteArray();
  if (!buffer) throw new Error("Failed to download file from S3");

  // 解析 Excel
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(
    workbook.Sheets[sheetName]
  );

  const batchSize = 5000;
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
    console.log(`✅ 已完成批次 ${i / batchSize + 1}，累計處理 ${processed} 筆`);
  }

  console.log(`🎉 全部完成，共處理 ${processed} 筆`);
}

async function main() {
  try {
    // 假設 fileId 是從 DB 或 queue 取出
    const fileId = "uploads/1234567890-myfile.xlsx";
    await processFile(fileId);
  } catch (err) {
    console.error("Worker failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

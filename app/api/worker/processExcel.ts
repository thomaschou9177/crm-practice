// worker/processExcel.ts
import { prisma } from "@/lib/db";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import * as XLSX from "xlsx";

const s3 = new S3Client({ region: "ap-northeast-1" });

export async function processExcel(key: string) {
  // 1. 從 S3 讀取檔案
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  });
  const data = await s3.send(command);
  const stream = data.Body as Readable;

  // 2. 轉成 buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);

  // 3. 解析 Excel
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // 4. 批次寫入 DB
  const chunkSize = 10000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((r: any) => ({
      id: Number(r.id),
      name: r.name,
      email: r.email,
      role: r.role,
      metadata: {},
    }));

    await prisma.customer.createMany({
      data: chunk,
      skipDuplicates: true,
    });

    console.log(`Inserted ${i + chunk.length} / ${rows.length}`);
  }
}

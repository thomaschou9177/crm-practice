import { prisma } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase-server";
import { Worker } from "bullmq";
import ExcelJS from "exceljs";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL!);

const worker = new Worker("excelQueue", async job => {
  const { filePath } = job.data;

  const { data, error } = await supabaseServer.storage
    .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET!)
    .download(filePath);

  if (error || !data) throw new Error(`Failed to download file: ${error?.message}`);

  const buffer = await data.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Excel 檔案沒有工作表");

  const batch: any[] = [];
  const chunkSize = 5000;
  let processed = 0;

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);
    batch.push({
      id: Number(row.getCell(1).value ?? 0),
      name: String(row.getCell(2).value ?? ""),
      email: String(row.getCell(3).value ?? ""),
      role: String(row.getCell(4).value ?? "")
    });

    if (batch.length >= chunkSize) {
      await prisma.customer.createMany({ data: batch, skipDuplicates: true });
      processed += batch.length;
      console.log(`Inserted ${processed} / ${worksheet.rowCount}`);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await prisma.customer.createMany({ data: batch, skipDuplicates: true });
    processed += batch.length;
  }

  console.log("✅ Excel 處理完成");
}, { connection });

worker.on("completed", job => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed: ${err.message}`);
});

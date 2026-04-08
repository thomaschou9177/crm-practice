import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";
import { Readable } from "stream";

interface CustomerRow {
  id: number;
  name: string;
  email: string;
  role: string;
}

export async function processExcel(buffer: ArrayBuffer): Promise<void> {
  // 1. 把 ArrayBuffer 包裝成 Readable Stream
  const stream = Readable.from(Buffer.from(buffer));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.read(stream); // 用 stream 載入，不用 Buffer/Uint8Array

  // 2. 取得第一個工作表
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel 檔案沒有工作表");
  }

  // 3. 流式逐行讀取 + 批次寫入
  const batch: CustomerRow[] = [];
  const chunkSize = 5000;
  let processed = 0;

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex);

    const id = Number(row.getCell(1).value ?? 0);
    const name = String(row.getCell(2).value ?? "");
    const email = String(row.getCell(3).value ?? "");
    const role = String(row.getCell(4).value ?? "");

    batch.push({ id, name, email, role });

    if (batch.length >= chunkSize) {
      await insertBatch(batch);
      processed += batch.length;
      console.log(`Inserted ${processed} / ${worksheet.rowCount}`);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    processed += batch.length;
    console.log(`Inserted ${processed} / ${worksheet.rowCount}`);
  }

  console.log("✅ Excel 處理完成");
}

async function insertBatch(batch: CustomerRow[]): Promise<void> {
  await prisma.customer.createMany({ data: batch, skipDuplicates: true });
  await prisma.customerInfo.createMany({
    data: batch.map((r) => ({ customerId: r.id, email: r.email })),
    skipDuplicates: true,
  });
}

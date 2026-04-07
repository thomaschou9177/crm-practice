// worker/processExcel.ts
import { prisma } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

export async function processExcel(filePath: string) {
  // 1. 從 Supabase Storage 下載檔案
  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET!)
    .download(filePath);

  if (error || !data) {
    throw new Error("Failed to download file from Supabase Storage");
  }

  // 2. 轉成 buffer
  const buffer = await data.arrayBuffer();

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

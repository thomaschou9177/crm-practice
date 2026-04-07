import { prisma } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

export async function processExcel(filePath: string) {
  const bucketName = process.env.SUPABASE_BUCKET;

  // 增加明確的錯誤檢查
  if (!bucketName) {
    throw new Error("環境變數 SUPABASE_BUCKET 未設定，請檢查 Vercel Settings");
  }

  if (!filePath) {
    throw new Error("未提供 filePath，無法從 Storage 下載檔案");
  }

  console.log(`正在從 Bucket: ${bucketName} 下載檔案: ${filePath}`);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .download(filePath);

  if (error || !data) {
    console.error("Supabase 下載失敗詳情:", error);
    throw new Error(`無法從 Supabase 下載檔案: ${error?.message || "未知錯誤"}`);
  }

  // 2. 轉成 buffer
  const buffer = await data.arrayBuffer();

  // 3. 解析 Excel
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // 4. 批次寫入 DB (同時建立 customer 與 customer_info)
  const chunkSize = 1000; // 建議縮小批次，避免 transaction 過大
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    // 使用 transaction 保證兩個 table 同步
    await prisma.$transaction(
      chunk.map((r: any) =>
        prisma.customer.create({
          data: {
            id: Number(r.id),
            name: r.name,
            email: r.email,
            role: r.role,
            metadata: {},
            customer_info: {
              create: {
                id: Number(r.id),
                email: r.email,
              },
            },
          },
        })
      )
    );

    console.log(`Inserted ${i + chunk.length} / ${rows.length}`);
  }
}

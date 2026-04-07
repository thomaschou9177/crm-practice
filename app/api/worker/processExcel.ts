import { prisma } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase-server"; // 後端用 Service Role Key
import * as XLSX from "xlsx";

export async function processExcel(filePath: string) {
  // 1. 從 Supabase Storage 下載檔案（用 service role key）
  const { data, error } = await supabaseServer.storage
    .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET!)
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

  // 4. 批次寫入 DB (同時建立 customer 與 customer_info)
  const chunkSize = 1000; // 建議縮小批次，避免 transaction 過大
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

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

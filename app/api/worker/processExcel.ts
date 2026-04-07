import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

export async function processExcel(buffer:ArrayBuffer) {


  // 3. 解析 Excel
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // 4. 批次寫入 DB (同時建立 customer 與 customer_info)
  const chunkSize = 5000; // 建議縮小批次，避免 transaction 過大
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

     // 批次插入 customer
    await prisma.customer.createMany({
      data: chunk.map((r: any) => ({
        id: Number(r.id),
        name: r.name,
        email: r.email,
        role: r.role,
      })),
      skipDuplicates: true,
    });

    // 批次插入 customer_info
    await prisma.customerInfo.createMany({
      data: chunk.map((r: any) => ({
        customerId: Number(r.id),
        email: r.email,
      })),
      skipDuplicates: true,
    });

    console.log(`Inserted ${i + chunk.length} / ${rows.length}`);
  }
}

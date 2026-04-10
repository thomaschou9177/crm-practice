// src/components/ImportBar.tsx
"use client";
import ExcelJS from "exceljs";
import { useState } from "react";
import ProgressBar from "./ProgressBar";

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);

    // 1. 前端解析 Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];

    const totalRows = worksheet.rowCount - 1; // 減去標題列
    setTotalRows(totalRows);

    const batchSize = 500; // 每批處理 500 筆
    const totalBatches = Math.ceil(totalRows / batchSize);

    // 建立欄位索引
    const headerRow = worksheet.getRow(1);
    const colMap: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const val = cell.value ? String(cell.value).toLowerCase().trim() : "";
      colMap[val] = colNumber;
    });

    // 2. 分批送 JSON 到 Edge Function
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startRow = batchIndex * batchSize + 2;
      const endRow = Math.min(startRow + batchSize - 1, worksheet.rowCount);

      const customers: any[] = [];
      const infos: any[] = [];

      for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (!row || row.cellCount === 0) continue;

        const idValue = row.getCell(colMap["id"]).value;
        if (idValue === null || idValue === undefined) continue;

        const id = Number(idValue);
        const email = String(row.getCell(colMap["email"]).value || "");

        customers.push({
          id,
          name: String(row.getCell(colMap["name"]).value || ""),
          email,
          role: String(row.getCell(colMap["role"]).value || ""),
        });

        infos.push({ id, email });
      }
      // Supabase Function URL 拼接
      await fetch("https://htlqcgfgazlmjlyqibik.supabase.co/functions/v1/processExcel", {
        method: "POST",
        headers: { "Content-Type": "application/json","Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, },
        body: JSON.stringify({ batchIndex, customers, infos }),
      });

      // 更新進度條
      const processed = Math.min((batchIndex + 1) * batchSize, totalRows);
      setProcessedRows(processed);
    }

    setIsProcessing(false);
  };

  return (
    <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex flex-col gap-2">
      <h2 className="font-bold text-green-700 uppercase">Import Excel File</h2>
      <div className="flex gap-2">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="bg-white border p-1 rounded"
        />
        <button
          onClick={handleProcess}
          className="bg-green-600 text-white px-4 py-2 rounded font-bold"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Upload & Sync"}
        </button>
      </div>

      {totalRows > 0 && (
        <div className="mt-2">
          <ProgressBar progress={(processedRows / totalRows) * 100} />
          <p className="text-sm mt-1">
            Processed {processedRows} / {totalRows} rows
          </p>
        </div>
      )}
    </div>
  );
}


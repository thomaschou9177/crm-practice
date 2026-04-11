// src/components/ImportBar.tsx
"use client";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { useState } from "react";
import ProgressBar from "./ProgressBar";

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const batchSize = 500; // 每批 500 筆，避免 payload 過大
  const parallelLimit = 3; // 同時送出 3 個批次

  const sendBatch = async (batchIndex: number, customers: any[], infos: any[]) => {
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/processExcel`;
    await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ batchIndex, customers, infos }),
    });
    setProcessedRows((prev) => prev + customers.length);
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);

    const ext = file.name.split(".").pop()?.toLowerCase();
    let rows: any[] = [];

    if (ext === "xlsx" || ext === "xls") {
      // Excel 檔案用 ExcelJS
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];

      const headerRow = worksheet.getRow(1);
      const colMap: Record<string, number> = {};
      headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? String(cell.value).toLowerCase().trim() : "";
        colMap[val] = colNumber;
      });

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (!row || row.cellCount === 0) continue;

        const idValue = row.getCell(colMap["id"]).value;
        if (idValue === null || idValue === undefined) continue;

        const id = Number(idValue);
        const email = String(row.getCell(colMap["email"]).value || "");
        rows.push({
          id,
          name: String(row.getCell(colMap["name"]).value || ""),
          email,
          role: String(row.getCell(colMap["role"]).value || ""),
        });
      }
      setTotalRows(rows.length);
    } else if (ext === "csv") {
      // CSV 檔案用 PapaParse 流式解析
      let buffer: any[] = [];
      let batchIndex = 0;
      let total = 0;

      await new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          worker: true,
          skipEmptyLines: true,
          step: async (row, parser) => {
            const record = row.data as any;
            if (!record.id) return;

            const customer = {
              id: Number(record.id),
              name: record.name || "",
              email: record.email || "",
              role: record.role || "",
            };
            buffer.push(customer);
            total++;

            if (buffer.length >= batchSize) {
              const infos = buffer.map((c) => ({ id: c.id, email: c.email }));
              await sendBatch(batchIndex, buffer, infos);
              batchIndex++;
              buffer = [];
            }
            setTotalRows(total); // 更新總筆數
          },
          complete: async () => {
            if (buffer.length > 0) {
              const infos = buffer.map((c) => ({ id: c.id, email: c.email }));
              await sendBatch(batchIndex, buffer, infos);
            }
            resolve();
          },
          error: (err) => reject(err),
        });
      });
    } else {
      alert("Unsupported file type");
      setIsProcessing(false);
      return;
    }

    // Excel 的 rows 分批上傳
    if (rows.length > 0) {
      const totalBatches = Math.ceil(rows.length / batchSize);
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += parallelLimit) {
        const batchPromises: Promise<void>[] = [];
        for (let j = 0; j < parallelLimit && batchIndex + j < totalBatches; j++) {
          const currentBatch = batchIndex + j;
          const start = currentBatch * batchSize;
          const end = Math.min(start + batchSize, rows.length);
          const customers = rows.slice(start, end);
          const infos = customers.map((c) => ({ id: c.id, email: c.email }));
          batchPromises.push(sendBatch(currentBatch, customers, infos));
        }
        await Promise.all(batchPromises);
      }
    }

    setIsProcessing(false);
  };

  return (
    <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex flex-col gap-2">
      <h2 className="font-bold text-green-700 uppercase">Import Excel/CSV File</h2>
      <div className="flex gap-2">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
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

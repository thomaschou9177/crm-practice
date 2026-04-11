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

  const batchSize = 300; // 每批 300 筆
  const parallelLimit = 2; // 同時送出 2 批

  const sendBatch = async (batchIndex: number, customers: any[], infos: any[]) => {
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/processExcel`;
    try {
      await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ batchIndex, customers, infos }),
      });
      setProcessedRows((prev) => prev + customers.length);
    } catch (err) {
      console.error("Batch upload failed:", err);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);

    const ext = file.name.split(".").pop()?.toLowerCase();
    let buffer: any[] = [];
    let batchIndex = 0;
    let activeRequests: Promise<void>[] = [];
    let total = 0;

    if (ext === "csv") {
      // ✅ CSV 流式解析
      await new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          worker: true,
          skipEmptyLines: true,
          chunkSize: 1000,
          chunk: async (results) => {
            const data = results.data as any[];
            for (const record of data) {
              if (!record.id) continue;
              buffer.push({
                id: Number(record.id),
                name: record.name || "",
                email: record.email || "",
                role: record.role || "",
              });
              total++;
            }
            setTotalRows(total);

            while (buffer.length >= batchSize) {
              const customers = buffer.slice(0, batchSize);
              buffer = buffer.slice(batchSize);
              const infos = customers.map((c) => ({ id: c.id, email: c.email }));
              const req = sendBatch(batchIndex, customers, infos);
              activeRequests.push(req);
              batchIndex++;
              if (activeRequests.length >= parallelLimit) {
                await Promise.all(activeRequests);
                activeRequests = [];
              }
            }
          },
          complete: async () => {
            if (buffer.length > 0) {
              const infos = buffer.map((c) => ({ id: c.id, email: c.email }));
              await sendBatch(batchIndex, buffer, infos);
            }
            if (activeRequests.length > 0) {
              await Promise.all(activeRequests);
            }
            setIsProcessing(false);
            resolve();
          },
          error: (err) => reject(err),
        });
      });
    } else if (ext === "xlsx" || ext === "xls") {
      // ✅ Excel 解析
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

      const rows: any[] = [];
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (!row || row.cellCount === 0) continue;
        const idValue = row.getCell(colMap["id"]).value;
        if (idValue === null || idValue === undefined) continue;
        rows.push({
          id: Number(idValue),
          name: String(row.getCell(colMap["name"]).value || ""),
          email: String(row.getCell(colMap["email"]).value || ""),
          role: String(row.getCell(colMap["role"]).value || ""),
        });
      }

      setTotalRows(rows.length);

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

      setIsProcessing(false);
    } else {
      alert("Unsupported file type");
      setIsProcessing(false);
    }
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

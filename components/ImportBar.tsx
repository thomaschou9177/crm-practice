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

  const batchSize = 200;       // 每批 200 筆
  const parallelLimit = 1;     // 同時送出 1 批
  const segmentSize = 500000;  // 每段 50 萬筆

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

  // 分段處理函式
  const processSegment = async (rows: any[], segmentIndex: number) => {
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
    console.log(`Segment ${segmentIndex} 完成`);
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);

    const ext = file.name.split(".").pop()?.toLowerCase();
    let rows: any[] = [];

    if (ext === "csv") {
      // ✅ CSV 解析
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = parsed.data as any[];
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
    } else {
      alert("Unsupported file type");
      setIsProcessing(false);
      return;
    }

    setTotalRows(rows.length);

    // 分段處理
    const totalSegments = Math.ceil(rows.length / segmentSize);
    for (let segmentIndex = 0; segmentIndex < totalSegments; segmentIndex++) {
      const start = segmentIndex * segmentSize;
      const end = Math.min(start + segmentSize, rows.length);
      const segmentRows = rows.slice(start, end);
      await processSegment(segmentRows, segmentIndex);
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

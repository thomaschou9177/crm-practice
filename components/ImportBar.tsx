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
      rows.push({
        id: Number(row.getCell(colMap["id"]).value),
        name: String(row.getCell(colMap["name"]).value || ""),
        email: String(row.getCell(colMap["email"]).value || ""),
        role: String(row.getCell(colMap["role"]).value || ""),
      });
    }
  } else if (ext === "csv") {
    // CSV 檔案用 TextDecoder + split
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
    const headers = lines[0].split(",").map(h => h.toLowerCase().trim());

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const record: any = {};
      headers.forEach((h, idx) => {
        record[h] = cols[idx];
      });
      rows.push({
        id: Number(record["id"]),
        name: record["name"] || "",
        email: record["email"] || "",
        role: record["role"] || "",
      });
    }
  } else {
    alert("Unsupported file type");
    setIsProcessing(false);
    return;
  }

  // ✅ 接下來用 rows 做分批上傳
  setTotalRows(rows.length);

  const batchSize = 1000;
  const parallelLimit = 3;
  const totalBatches = Math.ceil(rows.length / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += parallelLimit) {
    const batchPromises: Promise<void>[] = [];

    for (let j = 0; j < parallelLimit && batchIndex + j < totalBatches; j++) {
      const currentBatch = batchIndex + j;
      const start = currentBatch * batchSize;
      const end = Math.min(start + batchSize, rows.length);

      const customers = rows.slice(start, end);
      const infos = customers.map(c => ({ id: c.id, email: c.email }));

      const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/processExcel`;

      batchPromises.push(
        fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ batchIndex: currentBatch, customers, infos }),
        }).then(() => {
          setProcessedRows(Math.min(end, rows.length));
        })
      );
    }

    await Promise.all(batchPromises);
  }

  setIsProcessing(false);
};


  return (
    <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex flex-col gap-2">
      <h2 className="font-bold text-green-700 uppercase">Import Excel File</h2>
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



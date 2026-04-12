// src/components/ImportBar.tsx
"use client";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { useState } from "react";
import ProgressBar from "./ProgressBar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const batchSize = 5000;
  const parallelLimit = 3;

  const sendBatch = async (batchIndex: number, customers: any[], infos: any[]) => {
    try {
      const { data, error } = await supabase.functions.invoke("processExcel", {
        body: { batchIndex, customers, infos },
      });

      if (error) {
        console.error("Batch upload failed:", error);
        alert("Batch upload failed, check console logs.");
      } else {
        setProcessedRows((prev) => prev + customers.length);
      }
    } catch (err) {
      console.error("Batch upload failed:", err);
      alert("Batch upload failed, check console logs.");
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);

    const ext = file.name.split(".").pop()?.toLowerCase();
    let rows: any[] = [];

    if (ext === "csv") {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      // 將 header key 全部轉小寫，避免 Age vs age 問題
      rows = (parsed.data as any[]).map((row) => {
        const normalized: Record<string, any> = {};
        Object.keys(row).forEach((key) => {
          normalized[key.toLowerCase()] = row[key];
        });
        return normalized;
      });
    } else if (ext === "xlsx" || ext === "xls") {
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

        const fixed = {
          id: Number(idValue),
          name: String(row.getCell(colMap["name"]).value || ""),
          email: String(row.getCell(colMap["email"]).value || ""),
          role: String(row.getCell(colMap["role"]).value || ""),
        };

        const metadata: Record<string, any> = {};
        Object.keys(colMap).forEach((key) => {
          if (!["id", "name", "email", "role"].includes(key)) {
            metadata[key] = row.getCell(colMap[key]).value || null;
          }
        });

        rows.push({ ...fixed, metadata });
      }
    } else {
      alert("Unsupported file type");
      setIsProcessing(false);
      return;
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

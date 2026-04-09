// src/components/ImportBar.tsx
"use client";
import { createClient } from "@supabase/supabase-js";
import { useState } from "react";
import ProgressBar from "./ProgressBar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 上傳 Excel 檔案到 Supabase Storage
  const handleUpload = async () => {
    if (!file) return;

    const path = `uploads/${file.name}`;
    const { error } = await supabase.storage
      .from("crm-bucket")
      .upload(path, file, { upsert: true });

    if (error) {
      alert("上傳失敗: " + error.message);
      return;
    }

    // 呼叫後端 API，只傳檔名，不傳檔案
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });

    const data = await res.json();
    setFilename(data.filename);
    setTotalRows(data.totalRows);
    setProcessedRows(0);

    // 上傳完成後自動開始批次處理
    autoProcess(data.filename, data.totalRows, 1000, 3); // 每批 1000 筆，並行 3 批
  };

  // 自動批次處理（支援並行）
  const autoProcess = async (
    filename: string,
    totalRows: number,
    batchSize: number,
    concurrency: number
  ) => {
    setIsProcessing(true);
    let batchIndex = 0;

    const runBatch = async (index: number) => {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, batchIndex: index, batchSize }),
      });

      const data = await res.json();
      setProcessedRows((prev) => prev + data.processed);
    };

    while (batchIndex * batchSize < totalRows) {
      const tasks = [];
      for (let i = 0; i < concurrency && batchIndex * batchSize < totalRows; i++) {
        tasks.push(runBatch(batchIndex));
        batchIndex++;
      }
      await Promise.all(tasks); // 並行執行多批次
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
          onClick={handleUpload}
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

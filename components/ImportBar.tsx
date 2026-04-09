"use client";
import { useState } from "react";
import ProgressBar from "./ProgressBar";

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 上傳 Excel 檔案
  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();

    setFilename(data.filename);
    setTotalRows(data.totalRows);
    setProcessedRows(0);

    // 上傳完成後自動開始批次處理
    autoProcess(data.filename, data.totalRows, 5000);
  };

  // 自動批次處理
  const autoProcess = async (filename: string, totalRows: number, batchSize: number) => {
    setIsProcessing(true);
    let batchIndex = 0;

    while (batchIndex * batchSize < totalRows) {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, batchIndex, batchSize }),
      });

      const data = await res.json();
      setProcessedRows((prev) => prev + data.processed);

      batchIndex++;
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

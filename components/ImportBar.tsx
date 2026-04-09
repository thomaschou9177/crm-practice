"use client";
import { useState } from "react";
import ProgressBar from "./ProgressBar";

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setFilename(data.filename);
    setTotalRows(data.totalRows);
    setProcessedRows(0);
  };

  const processBatch = async (batchIndex: number, batchSize: number) => {
    if (!filename) return;
    const res = await fetch("/api/process", {
      method: "POST",
      body: JSON.stringify({ filename, batchIndex, batchSize }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setProcessedRows((prev) => prev + data.processed);
  };

  return (
    <div className="p-4 border rounded">
      <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload} className="bg-blue-600 text-white px-4 py-2 rounded">Upload</button>
      {totalRows > 0 && (
        <div className="mt-2">
          <ProgressBar progress={(processedRows / totalRows) * 100} />
          <button onClick={() => processBatch(Math.floor(processedRows / 5000), 5000)} className="mt-2 bg-green-600 text-white px-4 py-2 rounded">
            Process Next Batch
          </button>
        </div>
      )}
    </div>
  );
}

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

    // 呼叫 Supabase Edge Function，而不是 Vercel API
    const res = await fetch(
      "https://htlqcgfgazlmjlyqibik.functions.supabase.co/processExcel",
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ filename: file.name }),
      }
    );

    const data = await res.json();
    setFilename(file.name);
    setTotalRows(data.totalRows || 0);
    setProcessedRows(data.processedRows || 0);
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

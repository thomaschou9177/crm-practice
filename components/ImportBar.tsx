// components/ImportBar.tsx
"use client";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setIsProcessing(true);

    try {
      // 1. 呼叫 /api/upload 取得 filePath
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const { filePath } = await res.json();
      if (!filePath) throw new Error("後端未回傳 filePath");

      // 2. 上傳檔案到 Supabase Storage
      const { error } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET!)
        .upload(filePath, file);

      if (error) throw error;

      // 3. 呼叫 /api/process 解析 Excel
      const processRes = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });

      if (!processRes.ok) throw new Error("後端解析失敗");

      alert("資料處理完成！");
      window.location.reload();
    } catch (err: any) {
      alert("處理失敗: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".xlsx,.xls"
        disabled={isProcessing}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={handleUpload}
        disabled={!file || isProcessing}
      >
        {isProcessing ? "處理中..." : "Upload to Supabase"}
      </button>
    </div>
  );
}

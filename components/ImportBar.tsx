// components/ImportBar.tsx
"use client";
import { useState } from "react";

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);

  async function handleUpload() {
    if (!file) return;

    // 1. 先向後端要 presigned URL
    const res = await fetch("/api/upload", {
      method: "POST",
      body: JSON.stringify({ filename: file.name }),
    });
    const { url,filePath } = await res.json();

    // 2. 直接 PUT 到 S3
    await fetch(url, {
      method: "PUT",
      body: file,
    });

    // 3. 新增：通知後端開始處理 Excel 並寫入 DB
  const processRes = await fetch("/api/process", {
    method: "POST",
    body: JSON.stringify({ filePath }),
  });

  if (processRes.ok) {
    alert("資料處理完成！");
    window.location.reload(); // 重新整理頁面以顯示新資料
  }
  }

  return (
    <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex items-center gap-2">
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={handleUpload}
        className="bg-green-600 text-white px-4 py-2 rounded font-bold"
      >
        Upload to S3
      </button>
    </div>
  );
}

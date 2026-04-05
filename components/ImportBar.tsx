"use client";
import ImportProgress from "@/components/ImportProgress";
import { useState } from "react";

export default function ImportBar() {
  const [uploadInfo, setUploadInfo] = useState<{ fileId: string; total: number } | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // 1. 上傳到 S3
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();

    // 2. 觸發 Worker API，開始匯入 DB
    await fetch(`/api/worker?fileId=${data.fileId}`);

    // 3. 更新前端進度條
    setUploadInfo({ fileId: data.fileId, total: data.total });
  }

  return (
    <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex flex-col gap-4">
      <h2 className="font-bold text-green-700 uppercase">Import Excel File</h2>
      <form onSubmit={handleUpload} encType="multipart/form-data" className="flex gap-2">
        <input type="file" name="file" accept=".xlsx,.xls" className="bg-white border p-1 rounded" required />
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded font-bold">
          Upload to S3
        </button>
      </form>

      {uploadInfo && <ImportProgress fileId={uploadInfo.fileId} total={uploadInfo.total} />}
    </div>
  );
}

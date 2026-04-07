// components/ImportBar.tsx
"use client";
import { useState } from "react";

export default function ImportBar() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // 新增：防止重複點擊

  async function handleUpload() {
    if (!file) return;
    setIsProcessing(true); // 開始處理

    try {
      // --- 檢查點 1: 取得預簽名 URL ---
      const res = await fetch("/api/upload", {
        method: "POST",
        body: JSON.stringify({ filename: file.name }),
      });
      
      if (!res.ok) throw new Error("無法取得上傳預簽名 URL");
      
      const uploadData = await res.json();
      const { url, filePath } = uploadData;

      // 🔍 核心偵錯點：確認 filePath 是否真的存在
      console.log("檢查點 1 (Upload API 回傳):", uploadData);
      if (!filePath) {
        throw new Error("後端 /api/upload 未回傳 filePath，請檢查該 API 邏輯");
      }

      // --- 檢查點 2: 上傳至 S3/Supabase Storage ---
      const uploadRes = await fetch(url, {
        method: "PUT",
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`檔案上傳失敗 (HTTP ${uploadRes.status})`);
      }
      console.log("檢查點 2: 檔案已成功 PUT 到儲存空間");

      // --- 檢查點 3: 觸發後端解析 ---
      console.log("檢查點 3: 準備發送至 /api/process，路徑為:", filePath);
      
      const processRes = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filePath: filePath }), // 確保 Key 名稱對齊
      });
      // 增加詳細檢查
      console.log("API 狀態碼:", processRes.status);

      const result = await processRes.json();

      if (processRes.ok) {
        alert("資料處理完成！");
        window.location.reload();
      } else {
        // 這裡會抓到您在 Log 中看到的 "未提供 filePath" 等錯誤
        throw new Error(result.error || "後端解析過程發生錯誤");
      }

    } catch (err: any) {
      console.error("上傳流程中斷:", err.message);
      alert("處理失敗: " + err.message);
    } finally {
      setIsProcessing(false); // 結束處理
    }
  }

  return (
    <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex items-center gap-2">
      <input
        type="file"
        accept=".xlsx,.xls"
        disabled={isProcessing}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={handleUpload}
        disabled={!file || isProcessing}
        className={`${
          isProcessing ? "bg-gray-400" : "bg-green-600"
        } text-white px-4 py-2 rounded font-bold transition-colors`}
      >
        {isProcessing ? "處理中..." : "Upload to S3"}
      </button>
    </div>
  );
}
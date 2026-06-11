// src/components/ImportBar.tsx
"use client";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { useParams, useRouter } from "next/navigation"; // 1. 引入 useParams // 1. 引入 useRouter
import Papa from "papaparse";
import { useState } from "react";
import ProgressBar from "./ProgressBar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ImportBar() {
  const params = useParams(); // 2. 獲取網址參數
  const router = useRouter(); // 2. 初始化 router
  const tenant = params?.tenant as string; // 取得 tenant1 或 tenant2

  const [file, setFile] = useState<File | null>(null);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [processedRows, setProcessedRows] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [appendIfDuplicate, setAppendIfDuplicate] = useState<boolean>(false); // 🟢 新增：是否在重複時加到最後

  const batchSize = 5000;
  const parallelLimit = 3;

  const sendBatch = async (batchIndex: number, customers: any[], infos: any[]) => {
    try {
      const { data, error } = await supabase.functions.invoke("processExcel", {
        body: { 
          batchIndex, 
          customers, 
          infos,
          tenant: tenant || 'public',
          appendIfDuplicate 
        },
      });

      // 🟢 進入 Supabase 傳回的錯誤判定
      if (error) {
        console.error("Batch upload failed (Supabase Error):", error);
        
        let friendlyMessage = "批次上傳失敗，請檢查資料格式。";

        // 🔥 關鍵核心：挖掘被藏在 non-2xx 裡面的真實 Response
        if (error.context && typeof error.context.response?.json === 'function') {
          try {
            const bodyData = await error.context.response.json();
            if (bodyData && bodyData.error) {
              friendlyMessage = bodyData.error;
            }
          } catch (e) {
            console.error("解析深層錯誤 JSON 失敗:", e);
          }
        } else if (error.message && !error.message.includes("non-2xx")) {
          friendlyMessage = error.message;
        }

        // 🎯 彈出最完美的客製化詳細重複報告！
        alert(`❌ 上傳中斷通知\n\n${friendlyMessage}`);
        
        throw error; // 中斷其餘批次
      } else {
        setProcessedRows((prev) => prev + customers.length);
      }
    } catch (err: any) {
      console.error("Catch 區塊捕獲錯誤:", err);
      
      // 這裡做第二層保險防線：如果在上面 throw error 跑到這，且訊息包含重複提示，就不再重複 alert 彈窗
      // 如果是用戶完全斷網、或者其他程式語法崩潰，就在此處把原汁原味的訊息顯示出來
      const isDuplicateAlerted = err?.context || err?.message?.includes("Email 與資料庫重複");
      
      if (!isDuplicateAlerted) {
        alert(`❌ 系統回報錯誤: ${err.message || "未知錯誤"}`);
      }
      throw err; 
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
      // ========================================================
      // 🟢【新增】對 CSV 讀取出的 rows 進行資料清洗，確保 id 為純整數
      // ========================================================
      rows = rows.map((row) => {
        if (row.id !== null && row.id !== undefined && row.id !== "") {
          row.id = Math.floor(Number(row.id));
        }
        return row;
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

        // ========================================================
        // 🟢【新增】修改後的 fixed 組裝方式（強制將 id 轉為無小數點的純整數）
        // ========================================================
        const fixed = {
          id: Math.floor(Number(idValue)), // 👈 破除 1.0 變浮點數的關鍵
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

    // 3. 關鍵：上傳完成後，通知 Next.js 重新抓取資料
    // 這會觸發伺服器重新執行 DashboardPage 的 prisma 查詢
    router.refresh(); 
    
    // 選項：如果想給使用者更明確的提示
    alert("資料上傳並同步完成！");
  };

  return (
    <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 flex flex-col gap-2">
      <h2 className="font-bold text-green-700 uppercase">Import Excel/CSV File</h2>
      {/* 🟢 新增：行為決策勾選方塊 */}
      <label className="flex items-center gap-2 text-sm text-gray-700 my-1 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={appendIfDuplicate}
          onChange={(e) => setAppendIfDuplicate(e.target.checked)}
          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
        />
        <span className="font-medium">
          若 ID 與資料庫重複時，<span className="text-green-600 font-bold">自動忽略 Excel ID 並加在最後面</span>（未勾選則自動取消動作並報錯）
        </span>
      </label>
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

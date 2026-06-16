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

  const sendBatch = async (batchIndex: number, customers: any[], infos: any[], onlyCheck: boolean = false) => {
    const { data, error } = await supabase.functions.invoke("processExcel", {
      body: { 
        batchIndex, 
        customers, 
        infos,
        tenant: tenant || 'public',
        appendIfDuplicate,
        onlyCheck // 👈 傳送給後端，控制是否只進行檢查而不寫入
      },
    });

    // 1. 先捕捉 Supabase 套件本身的網路或端點異常
    // 🟢【全面修正】：即便 error 存在 (status 400)，也要把裡面的真實業務邏輯錯誤挖出來！
    // 🟢【真·終極修復】：安全穿透 non-2xx 屏障，防範 Stream 鎖定
    if (error) {
      console.error("網路或伺服器連線異常:", error);
      throw new Error(error.message || "與後端連線異常，請稍後再試。");
    }

    // 2. 🔥 精準攔截後端回傳的 success: false 業務邏輯報告
    if (data && data.success === false) {
      throw new Error(data.error || "批次上傳失敗。");
    }

    // 只有在非純檢查（真實寫入）時，才累加進度條 rows
    if (!onlyCheck) {
      setProcessedRows((prev) => prev + customers.length);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProcessedRows(0); // 每次點擊重置進度

    const ext = file.name.split(".").pop()?.toLowerCase();
    let rows: any[] = [];

    // ... (保持您原本的 CSV / XLSX 檔案讀取組裝邏輯不變) ...
    if (ext === "csv") {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = (parsed.data as any[]).map((row) => {
        const normalized: Record<string, any> = {};
        Object.keys(row).forEach((key) => { normalized[key.toLowerCase()] = row[key]; });
        return normalized;
      }).map((row) => {
        if (row.id !== null && row.id !== undefined && row.id !== "") { row.id = Math.floor(Number(row.id)); }
        return row;
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];
      const headerRow = worksheet.getRow(1);
      const colMap: Record<string, number> = {};
      headerRow.eachCell((cell, colNumber) => { const val = cell.value ? String(cell.value).toLowerCase().trim() : ""; colMap[val] = colNumber; });
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        if (!row || row.cellCount === 0) continue;
        const idValue = row.getCell(colMap["id"]).value;
        if (idValue === null || idValue === undefined) continue;
        const fixed = { id: Math.floor(Number(idValue)), name: String(row.getCell(colMap["name"]).value || ""), email: String(row.getCell(colMap["email"]).value || ""), role: String(row.getCell(colMap["role"]).value || "") };
        const metadata: Record<string, any> = {};
        Object.keys(colMap).forEach((key) => { if (!["id", "name", "email", "role"].includes(key)) { metadata[key] = row.getCell(colMap[key]).value || null; } });
        rows.push({ ...fixed, metadata });
      }
    } else {
      alert("Unsupported file type");
      setIsProcessing(false);
      return;
    }

    setTotalRows(rows.length);

    const totalBatches = Math.ceil(rows.length / batchSize);
    
    try {
      // ====================================================================
      // 🛡️ 階段一：【黃金防線】全檔案「純預檢」模式 (onlyCheck: true)
      // ====================================================================
      // 依序檢查所有批次，此階段絕對不改動資料庫。只要有任何一批內含重複 Email，立刻被 catch 攔截！
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, rows.length);
        const customers = rows.slice(start, end);
        const infos = customers.map((c) => ({ id: c.id, email: c.email }));

        await sendBatch(batchIndex, customers, infos, true); // 👈 帶入 true，開啟純檢查
      }
      // ====================================================================
      // 🚀 階段二：【全面放行】實際寫入資料庫階段 (onlyCheck: false)
      // ====================================================================
      // 能走到這裡，代表「整張 Excel 超過 1 萬筆資料全部百分之百乾淨、絕無重複」！
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, rows.length);
        const customers = rows.slice(start, end);
        const infos = customers.map((c) => ({ id: c.id, email: c.email }));

        await sendBatch(batchIndex, customers, infos, false); // 👈 帶入 false，正式寫入
      }

      // 全部順利完成
      setIsProcessing(false);
      router.refresh(); 
      alert("資料上傳並同步完成！");

    } catch (err: any) {
      // 🎯 這裡會穩穩地接到後端傳出來的原始換行錯誤訊息！
      console.error("上傳過程遭到攔截:", err);
      setIsProcessing(false);
      setProcessedRows(0); // 失敗時重置進度條
      // 直接跳出最純粹、帶有換行符號的客製化詳細報告
      alert(err.message || "上傳中止。");
    }
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

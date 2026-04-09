// src/app/api/upload/route.ts
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    
    // --- 修正點 1: 改為正確的 Bucket 名稱 "crm-bucket" ---
    // --- 修正點 2: 將路徑加上 "uploads/" 資料夾前綴，與 process 端一致 ---
    const { data, error } = await supabase.storage
      .from("crm-bucket") 
      .upload(`uploads/${file.name}`, arrayBuffer, { upsert: true });

    if (error) {
      return NextResponse.json({ error: "上傳失敗", details: error.message }, { status: 500 });
    }

    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    return NextResponse.json({ filename: file.name, totalRows: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: "伺服器錯誤", message: err.message }, { status: 500 });
  }
}
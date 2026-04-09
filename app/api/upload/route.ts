// src/app/api/upload/route.ts
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  try {
    const { filename } = await req.json(); // 接收 JSON
    if (!filename) {
      return NextResponse.json({ error: "No filename provided" }, { status: 400 });
    }

    const fullPath = `uploads/${filename}`;
    const { data, error } = await supabase.storage
      .from("crm-bucket")
      .download(fullPath);

    if (error || !data) {
      return NextResponse.json({ error: "File not found", details: error?.message }, { status: 404 });
    }

    const buffer = await data.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    return NextResponse.json({ filename, totalRows: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: "伺服器錯誤", message: err.message }, { status: 500 });
  }
}

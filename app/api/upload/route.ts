// src/app/api/upload/route.ts
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  await supabase.storage.from("uploads").upload(file.name, arrayBuffer, { upsert: true });

  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  return NextResponse.json({ filename: file.name, totalRows: rows.length });
}

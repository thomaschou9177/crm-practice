// src/app/api/process/route.ts
import { prisma } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  try {
    const { filename, batchIndex, batchSize } = await req.json();
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
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const batch = rows.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);

    const customerData = batch.map((r: any) => ({
      id: Number(r.id),
      name: String(r.name || ""),
      email: String(r.email || ""),
      role: String(r.role || ""),
      metadata: {
        age: r.age,
        birthday: r.birthday,
        education: r.education,
      },
    }));

    const customerInfoData = batch.map((r: any) => ({
      id: Number(r.id),
      email: String(r.email || ""),
    }));

    await prisma.customer.createMany({
      data: customerData,
      skipDuplicates: true,
    });

    await prisma.customer_info.createMany({
      data: customerInfoData,
      skipDuplicates: true,
    });

    return NextResponse.json({ processed: batch.length });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({
      error: "Internal Server Error",
      message: err.message,
    }, { status: 500 });
  }
}

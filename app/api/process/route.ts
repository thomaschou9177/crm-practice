// src/app/api/process/route.ts
import { prisma } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  const { filename, batchIndex, batchSize } = await req.json();

  const { data,error } = await supabase.storage.from("uploads").download(filename);
  if (error || !data) {
  return NextResponse.json({ error: "File not found or download failed" }, { status: 404 });
}
  const buffer = await data.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const batch = rows.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);

  await prisma.customer.createMany({
    data: batch.map((r: any) => ({
      name: r.name,
      email: r.email,
      role: r.role,
      metadata: r.metadata || {},
    })),
    skipDuplicates: true,
  });

  await prisma.customer_info.createMany({
    data: batch.map((r: any) => ({
      email: r.email,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ processed: batch.length });
}

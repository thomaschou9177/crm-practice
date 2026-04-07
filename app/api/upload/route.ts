// app/api/upload/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { filename } = await req.json();
  if (!filename) {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  // 建立唯一檔案路徑
  const filePath = `uploads/${Date.now()}-${filename}`;
  return NextResponse.json({ filePath });
}

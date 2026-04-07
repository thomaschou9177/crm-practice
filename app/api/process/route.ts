// app/api/process/route.ts
import { NextResponse } from "next/server";
import { processExcel } from "../worker/processExcel";

export async function POST(req: Request) {
  try {
    const { filePath } = await req.json();
    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    await processExcel(filePath);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

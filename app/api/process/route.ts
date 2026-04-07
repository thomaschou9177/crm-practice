import { NextResponse } from "next/server";
import { processExcel } from "../worker/processExcel";

export async function POST(req: Request) {
  try {
    const { filePath } = await req.json();
    await processExcel(filePath); // 執行你寫好的下載->解析->寫入邏輯
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "處理失敗" }, { status: 500 });
  }
}
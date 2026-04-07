// app/api/process/route.ts
import { NextResponse } from "next/server";
import { processExcel } from "../worker/processExcel"; // 請確認 processExcel.ts 的實際存放路徑

export async function POST(req: Request) {
  try {
    // 確保內容類型正確
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 400 });
    }

    // 嘗試讀取 Text 再解析，避免 req.json() 直接失敗
    const rawBody = await req.text();
    console.log("Raw Body received:", rawBody); // 這裡如果印出空字串，就是前端沒傳成功

    if (!rawBody) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    const body = JSON.parse(rawBody);
    const { filePath } = body;

    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath in body" }, { status: 400 });
    }

    console.log("Starting to process file:", filePath);
    await processExcel(filePath);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Detailed Error in /api/process:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
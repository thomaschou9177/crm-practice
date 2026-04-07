import { NextResponse } from "next/server";
import { processExcel } from "../worker/processExcel";

// app/api/process/route.ts 修改建議
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("收到的 Body 內容:", body); // 增加此行進行除錯
    
    const { filePath } = body;
    
    // 檢查 filePath 是否真的存在
    if (!filePath) {
      console.error("錯誤：Request body 中缺少 filePath");
      return NextResponse.json({ error: "未提供 filePath" }, { status: 400 });
    }

    await processExcel(filePath);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Detailed Error in /api/process:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
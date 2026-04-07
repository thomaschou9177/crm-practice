// app/api/process/route.ts
import { NextResponse } from "next/server";
import { processExcel } from "../worker/processExcel";

export async function POST(req: Request) {
  try {
    const { filePath } = await req.json();
    console.log("Starting to process file:", filePath);
    
    await processExcel(filePath);
    
    console.log("Process completed successfully");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    // 關鍵：將詳細錯誤印出到 Console，Vercel Log 才會顯示
    console.error("Detailed Error in /api/process:", err.message, err.stack);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" }, 
      { status: 500 }
    );
  }
}
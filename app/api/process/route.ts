// app/api/process/route.ts
import { supabaseServer } from "@/lib/supabase-server"; // 用 service role key
import { NextResponse } from "next/server";
import { processExcel } from "../worker/processExcel";

export async function POST(req: Request) {
  try {
    const { filePath } = await req.json();
    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    // 用 supabaseServer 下載檔案
    const { data, error } = await supabaseServer.storage
      .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET!)
      .download(filePath);
    if (error || !data) throw new Error(`Failed to download file: ${error?.message}`);
    // 轉成 buffer
    const buffer = await data.arrayBuffer();
    await processExcel(buffer);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

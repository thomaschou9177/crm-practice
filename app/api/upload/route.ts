// app/api/upload/route.ts
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { filename } = await req.json();

  // 建立一個 signed URL 或直接回傳 bucket 路徑
  const filePath = `uploads/${Date.now()}-${filename}`;

  // 產生一個可用來上傳的 signed URL
  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET!)
    .createSignedUploadUrl(filePath);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl, path: filePath });
}

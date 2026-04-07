// app/api/upload/route.ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

const s3 = new S3Client({ region: "ap-northeast-1" });

export async function POST(req: Request) {
  const { filename } = await req.json();
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: `uploads/${Date.now()}-${filename}`,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return NextResponse.json({ url });
}

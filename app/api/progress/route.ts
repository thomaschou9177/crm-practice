import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const total = Number(searchParams.get("total")) || 0;

  const processed = await prisma.customer.count();

  return NextResponse.json({
    processed,
    total,
    percentage: total ? Math.round((processed / total) * 100) : 0,
  });
}

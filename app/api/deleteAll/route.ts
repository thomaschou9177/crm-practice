import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";  // ✅ 強制使用 Node.js runtime
export async function POST(req:Request) {
  try {
    // ✅ 使用 TRUNCATE 清空整個表，CASCADE 會連帶清空 customer_info
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE customer CASCADE`);
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete all data" }, { status: 500 });
  }
}

import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";  // ✅ 強制使用 Node.js runtime
export async function POST(req:Request) {
  try {
    // 刪除 所有 customer data後，會自動刪除所有 customer_info data
    await prisma.customer.deleteMany({});
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete all data" }, { status: 500 });
  }
}

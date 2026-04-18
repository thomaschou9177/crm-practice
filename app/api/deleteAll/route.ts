import { getPrismaClient } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";  // ✅ 強制使用 Node.js runtime
export async function POST(req:Request) {
  try {
    // 1. 解析表單資料取得 tenant
    const formData = await req.formData();
    const tenant = (formData.get("tenant") as string) || "public";

    // 2. 取得該租戶專屬的 Prisma Client
    const prisma = getPrismaClient(tenant);
    // 3. 執行 TRUNCATE
    // 注意：在 PostgreSQL 中，TRUNCATE 會受到 search_path 影響
    // 或是我們可以直接在 SQL 中指定 Schema
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tenant}".customer CASCADE`);

    // 4. 重新導向回原本的 Dashboard
    const redirectUrl = tenant === "public" ? "/dashboard" : `/${tenant}/dashboard`;
    return NextResponse.redirect(new URL(redirectUrl, req.url), 303);
  } catch (error) {
    console.error("Delete all failed:", error);
    return NextResponse.json({ error: "Failed to delete all data" }, { status: 500 });
  }
}

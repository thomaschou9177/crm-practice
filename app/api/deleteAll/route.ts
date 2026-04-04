import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // 刪除 所有 customer data後，會自動刪除所有 customer_info data
    await prisma.customer.deleteMany({});
    return NextResponse.redirect("/dashboard");
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete all data" }, { status: 500 });
  }
}

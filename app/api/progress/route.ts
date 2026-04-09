import { excelQueue } from "@/lib/queue";
import { NextResponse } from "next/server";

export async function GET() {
  const counts = await excelQueue.getJobCounts();
  return NextResponse.json(counts);
}

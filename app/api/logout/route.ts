// app/api/logout/route.ts
import { destroySession } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  if (sessionId) {
    destroySession(sessionId); // 刪除伺服器端 session
    cookieStore.delete("sessionId"); // 刪除 cookie
  }

  return new Response("Session destroyed", { status: 200 });
}

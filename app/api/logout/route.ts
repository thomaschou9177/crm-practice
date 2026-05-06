// app/api/logout/route.ts
import { destroySession } from '@/lib/session';

export async function POST(request: Request) {
  const { sessionId } = await request.json(); // 改從 Body 接收

  if (sessionId) {
    // ✅ 刪除資料庫中的紀錄
    await destroySession(sessionId);
  }

  return new Response(null, { status: 204 });
}

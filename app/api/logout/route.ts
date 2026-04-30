// app/api/logout/route.ts
import { destroySession } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;

  if (sessionId) {
    // ✅ 刪除資料庫中的紀錄
    await destroySession(sessionId);
    cookieStore.delete('sessionId');
  }

  return new Response(null, { status: 204 });
}

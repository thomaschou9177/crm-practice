// app/api/logout/route.ts
import { destroySession } from '@/lib/session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try{
    const { sessionId } = await request.json(); // 改從 Body 接收

    if (sessionId) {
      // ✅ 刪除資料庫中的紀錄
      await destroySession(sessionId);
    }
    // 2. 同時清除 Cookie
    const cookieStore = await cookies();
    cookieStore.delete('sessionId');
    return new Response(null, { status: 204 });
  }catch(error){
    // 防止 Body 解析失敗導致崩潰
    return new NextResponse(JSON.stringify({ error: 'Invalid Request' }), { status: 400 });
  }
}

// app/api/logout/route.ts
import { destroySession } from '@/lib/session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try{
    // 🐞 Debug: 印出 request headers 與來源
    console.log("🐞 /api/logout → headers:", Object.fromEntries(request.headers));
    console.log("🐞 /api/logout → referer:", request.headers.get("referer"));
    const body = await request.json();
    const { sessionId } = body || {}; // 改從 Body 接收
    // 🐞 Debug: 印出收到的 body 與 sid
    console.log("🐞 /api/logout → 收到 body:", body);
    console.log("🐞 /api/logout → 收到 sid:", sessionId);
    if (sessionId) {
      // ✅ 刪除資料庫中的紀錄
      await destroySession(sessionId);
      // 🐞 Debug: 確認刪除 sid
      console.log("🐞 /api/logout → destroySession 執行完成 sid:", sessionId);
    }else {
      console.warn("🐞 /api/logout → 沒有收到 sid");
    }
    // 2. 同時清除 Cookie
    const cookieStore = await cookies();
    cookieStore.delete('sessionId');
    console.log("🐞 /api/logout → Cookie 已刪除 sessionId");

    return new Response(null, { status: 204 });
  }catch(error){
    console.error("🐞 /api/logout → 發生錯誤:", error);
    // 防止 Body 解析失敗導致崩潰
    return new NextResponse(JSON.stringify({ error: 'Invalid Request' }), { status: 400 });
  }
}

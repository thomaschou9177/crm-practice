// app/api/login/route.ts
import { createSession } from '@/lib/session';
import { NextResponse } from 'next/server';

// 每個 tenant 的帳號密碼清單
const TENANT_USERS: Record<string, { username: string; password: string }[]> = {
  public: [
    { username: "admin", password: "password123" },
    { username: "user", password: "user123" },
    { username: "test", password: "test123" },
  ],
  tenant1: [
    { username: "tenant1admin", password: "t1password123" },
    { username: "tenant1user", password: "t1user123" },
    { username: "tenant1test", password: "t1test123" },
  ],
  tenant2: [
    { username: "tenant2admin", password: "t2password123" },
    { username: "tenant2user", password: "t2user123" },
    { username: "tenant2test", password: "t2test123" },
  ],
  // ...依需求繼續加 tenant3, tenant4, tenantN
};

export async function POST(request: Request) {
  const body = await request.json();
  const { username, password, tenant } = body;

  // 找出對應租戶的帳號清單
  const validUsers = TENANT_USERS[tenant] || [];
  const user = validUsers.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    const tenantId = tenant || 'public';
    const sessionId = createSession({
      tenant: tenantId,
      isLoggedIn: true,
      user: { name: username },
    });

    // 設定 sessionId cookie
    const response = NextResponse.json({ success: true, tenant: tenantId });
    response.cookies.set('sessionId', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  }

  return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
}

// /middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname,searchParams } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('favicon.ico')) {
    return NextResponse.next();
  }

  // 從 cookie 讀取 sessionId
  const sessionId = request.cookies.get('sessionId')?.value;
  // ✅ 改為 await 取得 Supabase 資料[cite: 10]
  const session = sessionId ? await getSession(sessionId) : null;

  const authTenant = session?.tenant;
  const isLoggedIn = Boolean(session?.isLoggedIn);

  // 自動解析 URL 第一段作為 tenant
  const segments = pathname.split('/').filter(Boolean); // e.g. "/tenant3/dashboard" → ["tenant3","dashboard"]
  let targetTenant = segments[0] || 'public';
  if (targetTenant === 'dashboard') targetTenant = 'public';

  const isLoginPage = pathname === '/' || (segments.length === 1 && segments[0] !== 'dashboard');
  const isDashboardArea = pathname.includes('/dashboard');

  // ✅ 重要修正：如果已經帶有 pending_switch 參數，說明已經在處理跳轉中，放行讓 TenantGuard 處理
  if (searchParams.has('pending_switch')) {
    return NextResponse.next();
  }

  // --- 規則 0：未登入阻擋 ---
  if (isDashboardArea && !isLoggedIn) {
    const origin = request.nextUrl.origin;
    const loginPage = targetTenant === 'public' ? new URL('/', origin) : new URL(`/${targetTenant}`, origin);
    return NextResponse.redirect(loginPage);
  }
  // --- 規則 1：跨租戶切換 ---
  if (isLoggedIn && authTenant && authTenant !== targetTenant) {
    // 只有在試圖存取別人的 Dashboard 或登入頁時才攔截
    if (isDashboardArea || isLoginPage) {
      const origin = request.nextUrl.origin;
      const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
      const url = new URL(currentDash, origin);
      // ✅ 修正：傳遞布林值或簡單標記，避免將整個 pathname 編碼進去造成混亂
      url.searchParams.set('pending_switch', 'true');
      url.searchParams.set('target_tenant', targetTenant);
      return NextResponse.redirect(url);
    }
  }

  // --- 規則 2：同租戶登入頁 ---
  if (isLoginPage && isLoggedIn && authTenant === targetTenant) {
    const origin = request.nextUrl.origin;
    const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    return NextResponse.redirect(new URL(currentDash, origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

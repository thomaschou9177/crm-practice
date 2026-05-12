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
  // 🐞 Debug: 印出收到的 sessionId
  console.log("🐞 middleware 收到 sessionId:", sessionId);
  // ✅ 改為 await 取得 Supabase 資料[cite: 10]
  const session = sessionId ? await getSession(sessionId) : null;
  // 🐞 Debug: 印出 getSession 查詢結果
  console.log("🐞 middleware getSession 結果:", session);

  const authTenant = session?.tenant;
  // 🐞 Debug: 印出 authTenant
  console.log("🐞 middleware 判斷 authTenant:", authTenant);
  // const isLoggedIn = Boolean(session?.isLoggedIn);

  // // 🚀 [修正] 讀取前端埋下的暫時放行標記
  // const hasTempBypass = request.cookies.has('temp_bypass');

  // 自動解析 URL 第一段作為 tenant
  const segments = pathname.split('/').filter(Boolean); // e.g. "/tenant3/dashboard" → ["tenant3","dashboard"]
  let targetTenant = segments[0] || 'public';
  if (targetTenant === 'dashboard') targetTenant = 'public';

  const isLoginPage = pathname === '/' || (segments.length === 1 && segments[0] !== 'dashboard');
  const isDashboardArea = pathname.includes('/dashboard');

  // 🐞 Debug: 印出 URL 與判斷結果
  console.log("🐞 middleware URL:", pathname, "targetTenant:", targetTenant, "isLoginPage:", isLoginPage, "isDashboardArea:", isDashboardArea);
  // ✅ 重要修正：如果已經帶有 pending_switch 參數，說明已經在處理跳轉中，放行讓 TenantGuard 處理
  // --- 🚀 [最新修改處]：前端鎖定 Handshake 機制 ---
  // 當使用者進入 Dashboard，如果 URL 沒有同步標記，強制重導向帶上標記
  // 這確保了如果是「新分頁貼上網址」，一定會經過 TenantGuard 的 useEffect 檢查
  if (isDashboardArea && 
      !searchParams.has('check_sync')) {
    const url = request.nextUrl.clone();
    url.searchParams.set('check_sync', '1');
    return NextResponse.redirect(url);
  }

  // --- 🚀 [最新修改處 2]：簡化權限邏輯 (移除 pending_switch) ---
  
  // 規則 A：訪問 Dashboard 區域時
  if (isDashboardArea) {
    // 沒登入，或是登入的租戶與目標不符
    if (!session || authTenant !== targetTenant) {
      const origin = request.nextUrl.origin;
      const loginPage = targetTenant === 'public' ? new URL('/', origin) : new URL(`/${targetTenant}`, origin);
      // 加上 retry 避免極端情況下的無限循環
      if (!searchParams.has('retry')) loginPage.searchParams.set('retry', '1');
      return NextResponse.redirect(loginPage);
    }
  }

  // 規則 B：訪問登入頁時，如果已經登入該租戶，直接進 Dashboard
  if (isLoginPage && authTenant === targetTenant) {
    const origin = request.nextUrl.origin;
    const dashPath = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    return NextResponse.redirect(new URL(dashPath, origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

// /middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname,searchParams } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('favicon.ico')) {
    return NextResponse.next();
  }
  // 自動解析 URL 第一段作為 tenant
  const segments = pathname.split('/').filter(Boolean); // e.g. "/tenant3/dashboard" → ["tenant3","dashboard"]
  // let targetTenant = segments[0] || 'public';
  // if (targetTenant === 'dashboard') targetTenant = 'public';
  const targetTenant = (segments[0] === 'dashboard') ? 'public' : segments[0];
  // 定義 Dashboard 與 登入頁 判斷
  const isDashboardArea = pathname.includes('/dashboard');
  const isLoginPage = (targetTenant === 'public' && pathname === '/') || 
                      (targetTenant !== 'public' && pathname === `/${targetTenant}`);
  // 🚀 [修改點]：根據租戶區分 Cookie 名稱 (若你打算實作租戶隔離)
  // 或者統一使用 sessionId，但由 TenantGuard 驗證 sessionStorage
  // 如果是 public 租戶，找 session_public；如果是 tenant1，找 session_tenant1
  const cookieName = targetTenant === 'public' ? 'session_public' : `session_${targetTenant}`;
  const sessionId = request.cookies.get(cookieName)?.value;
  // 🐞 Debug: 印出動態變量幫助排查
  console.log(`🐞 middleware [${targetTenant}] 嘗試讀取 Cookie: ${cookieName} =`, sessionId);
  const session = sessionId ? await getSession(sessionId) : null;
  const authTenant = session?.tenant;
  // 🐞 Debug: 印出 URL 與判斷結果
  console.log(`🐞 Middleware 檢查: path=${pathname}, target=${targetTenant}, auth=${authTenant}`);
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

  // --- 🚀 [最新修改處 2]：簡化權限邏輯 (移除 pending_switch,retry) ---
  
  // 規則 A：訪問 Dashboard 區域時
  if (isDashboardArea) {
    // 沒登入，或是登入的租戶與目標不符
    if (!session || authTenant !== targetTenant) {
      const origin = request.nextUrl.origin;
      const loginPage = targetTenant === 'public' ? new URL('/', origin) : new URL(`/${targetTenant}`, origin);
      // // 加上 retry 避免極端情況下的無限循環
      // if (!searchParams.has('retry')) loginPage.searchParams.set('retry', '1');
      return NextResponse.redirect(loginPage);
    }
  }
  // 🚀 [新增邏輯]：如果 URL 帶有 'force_login'，說明是前端 Guard 判斷沒 Session 踢回來的
  // 此時即便有 Cookie，也絕對不要自動導向 Dashboard
  const isForcedLogin = searchParams.has('force_login');
  // 規則 B：訪問登入頁時，如果已經登入該租戶，直接進 Dashboard
  if (isLoginPage && authTenant === targetTenant) {
    // 如果不是被強制踢回來的，才執行自動登入跳轉
    if (!isForcedLogin) {
      console.log("🐞 middleware: 有 Cookie，自動導向 Dashboard");
      const origin = request.nextUrl.origin;
      const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
      return NextResponse.redirect(new URL(currentDash, origin));
    }
    console.log("🐞 middleware: 偵測到 force_login 標記，停留在登入頁");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

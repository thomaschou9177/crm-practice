// app/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 排除靜態資源與 API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next();
  }

  // 取得當前 Cookie 狀態
  const authTenant = request.cookies.get('auth_tenant')?.value;
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value === 'true';

  // 2. 解析當前網址想要訪問的租戶 (Target)
  // /dashboard -> public
  // /tenant1/... -> tenant1
  // /tenant2/... -> tenant2
  const pathSegments = pathname.split('/');
  let targetTenant = pathSegments[1] || 'public';
  if (targetTenant === 'dashboard') targetTenant = 'public';

  const isLoginPage = pathname === '/' || pathname === '/tenant1' || pathname === '/tenant2';
  const isDashboardArea = pathname.includes('/dashboard');

  // --- 關鍵邏輯：偵測跨租戶行為並強制登出 ---
  // 如果已經登入，但目前的 URL 租戶與 Cookie 紀錄的租戶不同
  if (isLoggedIn && authTenant && authTenant !== targetTenant) {
    // 建立一個重導向反應
    const loginPath = targetTenant === 'public' ? '/' : `/${targetTenant}`;
    const response = NextResponse.redirect(new URL(loginPath, request.url));

    // 強制清除登入狀態 Cookie (達成自動登出)
    response.cookies.delete('auth_tenant');
    response.cookies.delete('isLoggedIn');
    
    console.log(`租戶不符：從 ${authTenant} 切換至 ${targetTenant}，執行自動登出`);
    return response;
  }

  // --- 基礎保護邏輯 ---
  
  // A. 保護 Dashboard 區域：沒登入就踢回對應登入頁
  if (isDashboardArea && !isLoggedIn) {
    const loginPath = targetTenant === 'public' ? '/' : `/${targetTenant}`;
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  // B. 已登入者避免待在登入頁：自動進入對應 Dashboard
  if (isLoginPage && isLoggedIn && authTenant === targetTenant) {
    const dest = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
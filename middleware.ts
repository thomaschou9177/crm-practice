// /middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('favicon.ico')) {
    return NextResponse.next();
  }

  const authTenant = request.cookies.get('auth_tenant')?.value;
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value === 'true';

  // 解析目標租戶
  const pathSegments = pathname.split('/');
  let targetTenant = pathSegments[1] || 'public';
  if (targetTenant === 'dashboard') targetTenant = 'public';

  const isLoginPage = pathname === '/' || pathname === '/tenant1' || pathname === '/tenant2';
  const isDashboardArea = pathname === '/dashboard' || pathname.includes('/dashboard');

  // --- 關鍵修改：處理跨租戶 URL 手動更改 ---
  // 如果已登入 A，但使用者手動輸入了 B 的登入頁面 (例如從 tenant2/dashboard 改成 /tenant1)
  if (isLoginPage && isLoggedIn && authTenant && authTenant !== targetTenant) {
    // 不要直接跳過去，而是重導向回「目前已登入的 Dashboard」，並帶上想去的路徑
    const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    const url = new URL(currentDash, request.url);
    url.searchParams.set('pending_switch', pathname); // 告訴 TenantGuard 使用者想去哪
    url.searchParams.set('target_tenant', targetTenant); // ✅ 新增目標租戶
    return NextResponse.redirect(url);
  }

  // 保護 Dashboard 區域 (原有邏輯)
  if (isDashboardArea) {
    if (!isLoggedIn || !authTenant) {
      const loginPath = targetTenant === 'public' ? '/' : `/${targetTenant}`;
      return NextResponse.redirect(new URL(loginPath, request.url));
    }
    // 如果進入的 Dashboard 租戶與 Cookie 不符，同樣導向回正確的 Dashboard 並帶參數
    if (authTenant !== targetTenant) {
        const correctDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
        const url = new URL(correctDash, request.url);
        url.searchParams.set('pending_switch', pathname);
        return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}
// ✅ matcher 設定，避免影響 _next、api 等系統路徑
export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
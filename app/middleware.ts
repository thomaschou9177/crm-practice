// app/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. 排除不需要攔截的靜態資源與 API
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next();
  }
  // 取得 Cookie 資訊
  const authTenant = request.cookies.get('auth_tenant')?.value;
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value;

  // 解析 URL 取得目前的租戶 (例如從 /tenant1/dashboard 取得 tenant1)
  const pathSegments = pathname.split('/');
  // 如果網址是 /dashboard/... -> targetTenant 是 'public'
  // 如果網址是 /tenant1/dashboard -> targetTenant 是 'tenant1'
  let targetTenant = pathSegments[1]; 
  if (targetTenant === 'dashboard') {
    targetTenant = 'public';
  }
  // 保護所有包含 /dashboard 的路徑
  if (pathname.includes('/dashboard')) {
    
    // 狀況 A：完全沒登入
    if (!isLoggedIn || !authTenant) {
      const redirectUrl = targetTenant && targetTenant !== 'dashboard' 
        ? `/${targetTenant}` 
        : '/';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // 狀況 B：已登入，但嘗試跨租戶訪問 (例如用 tenant1 的帳號進 tenant2/dashboard)
    // 如果 URL 是 /tenant2/dashboard，但 Cookie 裡是 tenant1，則踢回自己的 dashboard
    if (targetTenant !== 'dashboard' && authTenant !== targetTenant) {
      console.warn(`非法跨租戶訪問：${authTenant} 嘗試進入 ${targetTenant}`);
      return NextResponse.redirect(new URL(`/${authTenant}/dashboard`, request.url));
    }
  }
  // --- 邏輯 B：已登入者自動跳轉 (防止已登入的人還待在登入頁面) ---
  const isLoginPage = pathname === '/' || pathname === '/tenant1' || pathname === '/tenant2';
  if (isLoginPage && isLoggedIn && authTenant) {
    const dest = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    return NextResponse.redirect(new URL(dest, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/tenant1/:path*',
    '/tenant2/:path*',
  ],
};
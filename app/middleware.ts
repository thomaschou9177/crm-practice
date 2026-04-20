// app/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. 排除靜態資源
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('favicon.ico')) {
    return NextResponse.next();
  }

  const authTenant = request.cookies.get('auth_tenant')?.value;
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value === 'true';

  const pathSegments = pathname.split('/');
  // 網址 /dashboard/... -> target 為 'public'
  // 網址 /tenant1/dashboard -> target 為 'tenant1'
  let targetTenant = pathSegments[1]|| 'public';
  if (targetTenant === 'dashboard') targetTenant = 'public';

  const isLoginPage = pathname === '/' || pathname === '/tenant1' || pathname === '/tenant2';
  const isDashboardPage = pathname.includes('/dashboard');

  // --- 邏輯 A：保護 Dashboard ---
  if (isDashboardPage) {
    // 沒登入或沒 Cookie：踢回登入頁
    if (!isLoggedIn || !authTenant) {
      const loginPath = targetTenant === 'public' ? '/' : `/${targetTenant}`;
      return NextResponse.redirect(new URL(loginPath, request.url));
    }

    // 登入身分與進入網址不符：導向正確的 Dashboard
    if (authTenant !== targetTenant) {
      const correctDest = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
      return NextResponse.redirect(new URL(correctDest, request.url));
    }
  }

  // --- 邏輯 B：已登入者避免待在登入頁 ---
  if (isLoginPage && isLoggedIn && authTenant) {
    const dest = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    // 只有當目的地與目前網址不同時才跳轉，防止無限循環
    if (pathname !== dest && pathname !== `/${authTenant}`) {
       return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/tenant1/:path*', '/tenant2/:path*'],
};
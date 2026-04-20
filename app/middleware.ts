// app/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// middleware.ts 修正建議
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('favicon.ico')) {
    return NextResponse.next();
  }

  // 取得 Cookie 並確保 isLoggedIn 是字串 'true'
  const authTenant = request.cookies.get('auth_tenant')?.value;
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value === 'true';

  // 判斷當前 URL 預期的是哪個租戶
  let targetTenant = '';
  if (pathname.startsWith('/dashboard')) {
    targetTenant = 'public';
  } else if (pathname.startsWith('/tenant1')) {
    targetTenant = 'tenant1';
  } else if (pathname.startsWith('/tenant2')) {
    targetTenant = 'tenant2';
  }

  const isLoginPage = pathname === '/' || pathname === '/tenant1' || pathname === '/tenant2';
  const isDashboardArea = pathname.includes('/dashboard');

  // --- 邏輯 A：保護 Dashboard 區域 ---
  if (isDashboardArea) {
    // 1. 沒登入：直接回該租戶的登入頁
    if (!isLoggedIn || !authTenant) {
      const loginPath = targetTenant === 'public' ? '/' : `/${targetTenant}`;
      return NextResponse.redirect(new URL(loginPath, request.url));
    }

    // 2. 登入身分不符 (例如用 tenant1 登入卻想進 /dashboard)
    if (authTenant !== targetTenant) {
      const correctDest = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
      return NextResponse.redirect(new URL(correctDest, request.url));
    }
  }

  // --- 邏輯 B：已登入者自動跳轉出登入頁 ---
  if (isLoginPage && isLoggedIn && authTenant) {
    const dest = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    // 只有在目的地與目前網址不同時才跳轉
    if (pathname !== dest) {
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/tenant1/:path*', '/tenant2/:path*'],
};
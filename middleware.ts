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

  // --- 規則 1：同租戶登入頁也要強制登出 ---
  if (isLoginPage && isLoggedIn && authTenant && authTenant === targetTenant) {
    const response = NextResponse.redirect(
      targetTenant === 'public' ? new URL('/', request.url) : new URL(`/${targetTenant}`, request.url)
    );
    response.cookies.delete('auth_tenant');
    response.cookies.delete('isLoggedIn');
    return response;
  }

  // --- 規則 2：跨租戶切換也要強制登出 ---
  if ((isLoginPage || isDashboardArea) && isLoggedIn && authTenant && authTenant !== targetTenant) {
    const response = NextResponse.redirect(
      targetTenant === 'public' ? new URL('/', request.url) : new URL(`/${targetTenant}`, request.url)
    );
    response.cookies.delete('auth_tenant');
    response.cookies.delete('isLoggedIn');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

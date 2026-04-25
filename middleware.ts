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

  // --- 規則：跨租戶或同租戶登入頁/dashboard → 交給 TenantGuard ---
  if ((isLoginPage || isDashboardArea) && isLoggedIn && authTenant && authTenant !== targetTenant) {
    const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    const url = new URL(currentDash, request.url);
    url.searchParams.set('pending_switch', pathname);
    url.searchParams.set('target_tenant', targetTenant);
    return NextResponse.redirect(url);
  }

  if ((isLoginPage || isDashboardArea) && isLoggedIn && authTenant && authTenant === targetTenant) {
    const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    const url = new URL(currentDash, request.url);
    url.searchParams.set('pending_switch', pathname);
    url.searchParams.set('target_tenant', targetTenant);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

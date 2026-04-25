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

  const pathSegments = pathname.split('/');
  let targetTenant = pathSegments[1] || 'public';
  if (targetTenant === 'dashboard') targetTenant = 'public';

  const isLoginPage = pathname === '/' || pathname === '/tenant1' || pathname === '/tenant2';
  const isDashboardArea = pathname === '/dashboard' || pathname.includes('/dashboard');

  // --- 規則 0：未登入阻擋 ---
  if (isDashboardArea && (!isLoggedIn || !authTenant)) {
    const origin = request.nextUrl.origin;
    let loginPage;
    if (pathname.startsWith('/tenant1')) {
      loginPage = new URL('/tenant1', origin);
    } else if (pathname.startsWith('/tenant2')) {
      loginPage = new URL('/tenant2', origin);
    } else {
      loginPage = new URL('/', origin); // public
    }
    return NextResponse.redirect(loginPage);
  }
  // --- 規則 1：跨租戶切換 ---
  if ((isLoginPage || isDashboardArea) && isLoggedIn && authTenant && authTenant !== targetTenant) {
    const origin = request.nextUrl.origin;
    const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    const url = new URL(currentDash, origin);
    url.searchParams.set('pending_switch', pathname);
    url.searchParams.set('target_tenant', targetTenant);
    return NextResponse.redirect(url);
  }

  // --- 規則 2：同租戶登入頁 ---
  if (isLoginPage && isLoggedIn && authTenant && authTenant === targetTenant) {
    const origin = request.nextUrl.origin;
    const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    const url = new URL(currentDash, origin);
    url.searchParams.set('pending_switch', pathname);
    url.searchParams.set('target_tenant', targetTenant);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

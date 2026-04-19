// app/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 取得 Cookie 資訊
  const authTenant = request.cookies.get('auth_tenant')?.value;
  const isLoggedIn = request.cookies.get('isLoggedIn')?.value;

  // 解析 URL 取得目前的租戶 (例如從 /tenant1/dashboard 取得 tenant1)
  const pathSegments = pathname.split('/');
  const targetTenant = pathSegments[1]; 

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

  return NextResponse.next();
}

export const config = {
  matcher: ['/:tenant/dashboard/:path*', '/dashboard/:path*'],
};
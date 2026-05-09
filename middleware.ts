// /middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname,searchParams } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('favicon.ico')) {
    return NextResponse.next();
  }

  // 從 cookie 讀取 sessionId
  const sessionId = request.cookies.get('sessionId')?.value;
  // 🐞 Debug: 印出收到的 sessionId
  console.log("🐞 middleware 收到 sessionId:", sessionId);
  // ✅ 改為 await 取得 Supabase 資料[cite: 10]
  const session = sessionId ? await getSession(sessionId) : null;
  // 🐞 Debug: 印出 getSession 查詢結果
  console.log("🐞 middleware getSession 結果:", session);

  const authTenant = session?.tenant;
  // 🐞 Debug: 印出 authTenant
  console.log("🐞 middleware 判斷 authTenant:", authTenant);
  // const isLoggedIn = Boolean(session?.isLoggedIn);

  // // 🚀 [修正] 讀取前端埋下的暫時放行標記
  // const hasTempBypass = request.cookies.has('temp_bypass');

  // 自動解析 URL 第一段作為 tenant
  const segments = pathname.split('/').filter(Boolean); // e.g. "/tenant3/dashboard" → ["tenant3","dashboard"]
  let targetTenant = segments[0] || 'public';
  if (targetTenant === 'dashboard') targetTenant = 'public';

  const isLoginPage = pathname === '/' || (segments.length === 1 && segments[0] !== 'dashboard');
  const isDashboardArea = pathname.includes('/dashboard');

  // 🐞 Debug: 印出 URL 與判斷結果
  console.log("🐞 middleware URL:", pathname, "targetTenant:", targetTenant, "isLoginPage:", isLoginPage, "isDashboardArea:", isDashboardArea);
  // ✅ 重要修正：如果已經帶有 pending_switch 參數，說明已經在處理跳轉中，放行讓 TenantGuard 處理
  if (searchParams.has('pending_switch')) {
    console.log("🐞 middleware 放行 pending_switch");
    return NextResponse.next();
  }

  // --- 規則 0：未登入阻擋 ---
  if (isDashboardArea && !authTenant) {

    // 🚀 [修改點 8] 白名單放行：如果網址帶有 auth_tenant，代表前端正在同步中，放行。
    if (searchParams.has('auth_tenant')) {
      return NextResponse.next();
    }

    // // 🚀 [修正] 如果有 temp_bypass 標記，視為安全回歸，予以放行
    // if (hasTempBypass) {
    //   const response = NextResponse.next();
    //   // 使用完畢立即清除，確保安全性
    //   response.cookies.delete('temp_bypass');
    //   return response;
    // }

    console.log("🐞 middleware 規則0 → 未登入阻擋, redirect 到登入頁");
    // ✅ 修正點 2：針對「連續刷新」的防護
    // 如果 URL 沒帶這參數，我們先嘗試原地刷新一次，不直接踢走
    // 這給了 TenantGuard 在客戶端把 sessionStorage 補回 Cookie 的時間
    if (!searchParams.has('retry')) {
      const retryUrl = new URL(request.url);
      retryUrl.searchParams.set('retry', '1');
      return NextResponse.redirect(retryUrl);
    }
    // 如果連重試一次都沒 Session，才真的踢回登入頁
    const origin = request.nextUrl.origin;
    const loginPage = targetTenant === 'public' ? new URL('/', origin) : new URL(`/${targetTenant}`, origin);
    return NextResponse.redirect(loginPage);
  }
  // --- 規則 1：跨租戶切換 ---
  if (authTenant && authTenant !== targetTenant) {
    console.log("🐞 middleware 規則1 → 跨租戶切換, authTenant:", authTenant, "targetTenant:", targetTenant);
    if (isDashboardArea || isLoginPage) {
      const origin = request.nextUrl.origin;
      const url = new URL(pathname, origin);
      url.searchParams.set('pending_switch', 'true');
      url.searchParams.set('target_tenant', targetTenant);
      url.searchParams.set('auth_tenant', authTenant);
      console.log("🐞 middleware redirect 加上 pending_switch:", url.toString());
      return NextResponse.redirect(url);
    }
  }

  // --- 規則 2：同租戶登入頁 ---
  if (isLoginPage && authTenant === targetTenant) {
    console.log("🐞 middleware 規則2 → 同租戶登入頁, redirect 到 dashboard");
    const origin = request.nextUrl.origin;
    const currentDash = authTenant === 'public' ? '/dashboard' : `/${authTenant}/dashboard`;
    return NextResponse.redirect(new URL(currentDash, origin));
  }
  console.log("🐞 middleware 最後放行 → NextResponse.next()");
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

// /middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { destroySession, getSession } from './lib/session';

export async function middleware(request: NextRequest) {
  const { pathname,searchParams } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('favicon.ico')) {
    return NextResponse.next();
  }
  // 自動解析 URL 第一段作為 tenant
  const segments = pathname.split('/').filter(Boolean); // e.g. "/tenant3/dashboard" → ["tenant3","dashboard"]
  // let targetTenant = segments[0] || 'public';
  // if (targetTenant === 'dashboard') targetTenant = 'public';
  const targetTenant = (segments[0] === 'dashboard') ? 'public' : segments[0];
  // 定義 Dashboard 與 登入頁 判斷
  const isDashboardArea = pathname.includes('/dashboard');
  const isLoginPage = (targetTenant === 'public' && pathname === '/') || 
                      (targetTenant !== 'public' && pathname === `/${targetTenant}`);
  // 🚀 【更靈活的寫法】動態掃描所有 session 開頭的 Cookie
  const allCookies = request.cookies.getAll();
  let responseToUse: NextResponse | null = null;

  for (const cookie of allCookies) {
    const name = cookie.name;
    
    // 找出所有非當前目標租戶的 Session Cookie
    const isPublicSessionMismatch = (targetTenant !== 'public' && name === 'session_public');
    const isTenantSessionMismatch = (name.startsWith('session_') && name !== `session_${targetTenant}` && name !== 'session_public');

    if (isPublicSessionMismatch || isTenantSessionMismatch) {
      const oldSessionId = cookie.value;
      console.log(`清理非當前租戶的 Cookie: ${name}`);

      // 1. 資料庫銷毀
      try { await destroySession(oldSessionId); } catch(e){}

      // 2. 準備下達瀏覽器刪除指令
      if (!responseToUse) responseToUse = NextResponse.next();
      responseToUse.cookies.set(name, '', { path: '/', expires: new Date(0) });
    }
  }
  // 🚀 [修改點]：根據租戶區分 Cookie 名稱 (若你打算實作租戶隔離)
  // 或者統一使用 sessionId，但由 TenantGuard 驗證 sessionStorage
  // 如果是 public 租戶，找 session_public；如果是 tenant1，找 session_tenant1
  const cookieName = targetTenant === 'public' ? 'session_public' : `session_${targetTenant}`;
  const sessionId = request.cookies.get(cookieName)?.value;
  // 🐞 Debug: 印出動態變量幫助排查
  console.log(`🐞 middleware [${targetTenant}] 嘗試讀取 Cookie: ${cookieName} =`, sessionId);
  const session = sessionId ? await getSession(sessionId) : null;
  // 🚨 【修正處】絕對不要在 session 為 null 時預設成 'public'！
  // 如果沒有 session，authTenant 就必須是 null，代表該租戶未登入。
  const authTenant = session ? session.tenant : null;
  // 🐞 Debug: 印出 URL 與判斷結果
  console.log(`🐞 Middleware 檢查: path=${pathname}, target=${targetTenant}, auth=${authTenant}`);
  // ✅ 重要修正：如果已經帶有 pending_switch 參數，說明已經在處理跳轉中，放行讓 TenantGuard 處理
  // --- 🚀 [最新修改處]：前端鎖定 Handshake 機制 ---
  // 當使用者進入 Dashboard，如果 URL 沒有同步標記，強制重導向帶上標記
  // 這確保了如果是「新分頁貼上網址」，一定會經過 TenantGuard 的 useEffect 檢查
  // if (isDashboardArea && 
  //     !searchParams.has('check_sync')) {
  //   const url = request.nextUrl.clone();
  //   url.searchParams.set('check_sync', '1');
  //   return NextResponse.redirect(url);
  // }

  // --- 🚀 [最新修改處 2]：簡化權限邏輯 (移除 pending_switch,retry) ---
  
  // 規則 A：訪問 Dashboard 區域時的嚴格守衛
  if (isDashboardArea) {
    // 沒登入，或是登入的租戶與目標不符
    if (!session || authTenant !== targetTenant) {
      const origin = request.nextUrl.origin;
      const loginPage = targetTenant === 'public' ? new URL('/', origin) : new URL(`/${targetTenant}`, origin);
      // 💡 加上 force_login 讓前端 Guard 知道這是被 Middleware 攔截踢回來的
      loginPage.searchParams.set('force_login', '1');
      console.log(`❌ Middleware 攔截：未授權存取 ${targetTenant}，重新導向至 ${loginPage.pathname}`);
      // 💡 【修正】如果前面有觸發清除舊 Cookie 的行為，要把清除 Cookie 的指令帶到這個 redirect 上
      const redirectResponse = NextResponse.redirect(loginPage);
      if (responseToUse) {
        responseToUse.cookies.getAll().forEach(cookie => {
          redirectResponse.cookies.set(cookie.name, '', { path: '/', expires: new Date(0) });
        });
      }
      return redirectResponse;
    }
  }
  // 🚀 [新增邏輯]：如果 URL 帶有 'force_login'，說明是前端 Guard 判斷沒 Session 踢回來的
  // 此時即便有 Cookie，也絕對不要自動導向 Dashboard
  const isForcedLogin = searchParams.has('force_login');
  // 規則 B：訪問登入頁時，如果已經登入該租戶，直接進 Dashboard
  if (isLoginPage && authTenant === targetTenant && !isForcedLogin) {
    // 如果不是被強制踢回來的，才執行自動登入跳轉
    console.log("🐞 middleware: 有 Cookie，自動導向 Dashboard");
    const origin = request.nextUrl.origin;
    const dashboardPath = targetTenant === 'public' ? '/dashboard' : `/${targetTenant}/dashboard`;
    const redirectResponse = NextResponse.redirect(new URL(dashboardPath, origin));
    // 帶上清除舊 Cookie 的行為
    if (responseToUse) {
      responseToUse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, '', { path: '/', expires: new Date(0) });
      });
    }
    return redirectResponse;
  }
    // console.log("🐞 middleware: 偵測到 force_login 標記，停留在登入頁");
    // return NextResponse.redirect(new URL(currentDash, origin));
    // 如果有清除舊 Cookie 的 response，就回傳它，否則放行
    return responseToUse || NextResponse.next();
  }

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};

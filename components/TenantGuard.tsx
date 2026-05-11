// components/TenantGuard.tsx
"use client";
import { handleLogout } from "@/app/dashboard/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const isNavigatingRef = useRef(false);

  // --- 邏輯 A：Session 同步與「新分頁」攔截 ---
  useEffect(() => {
    const syncSession = () => {
      const sid = sessionStorage.getItem('tab_session_id');
      
      // 🚀 [最新修改處]：處理新分頁貼上網址的情況
      if (!sid) {
        console.warn("🔍 無法獲取分頁 Session (可能是新分頁)，執行強制跳轉...");
        
        // 1. 強制清除 Cookie，確保 Middleware 下次攔截
        document.cookie = "sessionId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        
        // 2. 決定導向哪一個登入頁
        const loginPath = currentTenant === 'public' ? '/' : `/${currentTenant}`;
        
        // 3. 直接使用 window.location 跳轉，確保徹底重新載入
        window.location.href = loginPath;
        return;
      }

      // ✅ 正常刷新或合法進入：從 sessionStorage 恢復 Cookie
      document.cookie = `sessionId=${sid}; path=/; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure' : ''}`;
      
      // 🚀 清理 URL 上的輔助參數
      const params = new URLSearchParams(searchParams.toString());
      const needsCleanup = 
        params.has('check_sync') ||
        params.has('retry') || 
        params.has('auth_tenant') || 
        params.has('pending_switch');

      if (needsCleanup) {
        params.delete('check_sync');
        params.delete('retry');
        params.delete('auth_tenant');
        params.delete('pending_switch');
        params.delete('target_tenant');

        const newSearch = params.toString();
        const cleanPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState(null, '', cleanPath);
      }
    };

    syncSession();
  }, [searchParams, currentTenant]);

  // --- 邏輯 B：租戶切換監控 (選擇「否」的回航) ---
  useEffect(() => {
    const pendingSwitch = searchParams.get('pending_switch');
    if (pendingSwitch === 'true') {
      const targetTenant = searchParams.get('target_tenant');
      const authTenant = searchParams.get('auth_tenant');
      
      const confirmed = window.confirm(
        `您目前登入於 ${authTenant}，是否切換至 ${targetTenant}? (此操作將登出目前帳號)`
      );

      if (confirmed && formRef.current) {
        // 選「是」：正常提交 form 登出並轉換
        isNavigatingRef.current = true;
        const sid = sessionStorage.getItem('tab_session_id');
        const sidInput = formRef.current.querySelector('input[name="sessionId"]') as HTMLInputElement;
        if (sidInput && sid) sidInput.value = sid;
        
        // 準備跳轉前清除目前的 sid，因為要登入新租戶了
        sessionStorage.removeItem('tab_session_id');
        formRef.current.requestSubmit();
      } else {
        // --- 選擇「否」：直接跳回原租戶 Dashboard ---
        const originalTenant = authTenant || currentTenant;
        const path = originalTenant === "public" ? "/dashboard" : `/${originalTenant}/dashboard`;
        
        const returnUrl = new URL(path, window.location.origin);
        // 帶上 auth_tenant 讓 Middleware 放行一次，隨後由邏輯 A 接手恢復
        returnUrl.searchParams.set('auth_tenant', originalTenant as string);

        // 🚀 因為沒有 beforeunload 監聽，這裡 replace 不會觸發任何登出請求
        window.location.replace(returnUrl.toString());
      }
    }
  }, [searchParams, currentTenant]);

  // --- 邏輯 C：已移除 beforeunload 監聽 ---
  // 不再主動發送 navigator.sendBeacon
  useEffect(() => {
    console.log("🐞 TenantGuard: Active - 移除 beforeunload 監聽器以優化刷新體驗");
  }, []);

  return (
    <form ref={formRef} action={handleLogout} style={{ display: "none" }}>
      <input type="hidden" name="tenant" value={currentTenant} />
      <input type="hidden" name="sessionId" value="" />
      <input
        type="hidden"
        name="target_tenant"
        value={searchParams.get("target_tenant") || ""}
      />
    </form>
  );
}
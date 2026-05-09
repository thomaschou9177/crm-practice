// components/TenantGuard.tsx
"use client";
import { handleLogout } from "@/app/dashboard/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  // 🚀 [修改] 新增：用來標記是否為「受控的內部跳轉」，避免觸發 beforeunload 登出
  const isNavigatingRef = useRef(false);

  // --- 邏輯 A：Session 同步核心 (解決刷新不登出) ---
  useEffect(() => {
    const syncSession = () => {
      // 從分頁獨立的存儲空間抓取 ID
      const sid = sessionStorage.getItem('tab_session_id');
      console.log("🔍 TenantGuard 檢查 SessionStorage:", sid);
      if (sid) {
        
        // ✅ 將 ID 寫入 Cookie，讓 Middleware 可以驗證身分
        // 不設定 expires，這會使其成為 Session Cookie
        document.cookie = `sessionId=${sid}; path=/; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure' : ''}`;
        // 🐞 Debug: 確認 Cookie 寫入後的狀態
        console.log("🐞 Cookie after syncSession (寫入 sid):", document.cookie);
        // 🚀 核心優化：檢查是否有暫時性參數需要清理
        const params = new URLSearchParams(searchParams.toString());
        const needsCleanup = 
          params.has('retry') || 
          params.has('auth_tenant') || 
          params.has('pending_switch') ||
          params.has('target_tenant');

        if (needsCleanup) {
          // 移除所有用於中間過程的參數
          params.delete('retry');
          params.delete('auth_tenant');
          params.delete('pending_switch');
          params.delete('target_tenant');

          const newSearch = params.toString();
          const cleanPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');
          
          // 使用 replaceState 修改網址，不會觸發頁面刷新，讓使用者看不到參數殘留
          window.history.replaceState(null, '', cleanPath);
        }
      } else {
        // 如果連 sessionStorage 都沒了，確保 Cookie 也是空的
        document.cookie = "sessionId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        // 🐞 Debug: 確認 Cookie 清除後的狀態
        console.log("🐞 Cookie after syncSession (清除):", document.cookie);
      }
    };

    syncSession(); // 組件掛載時立即執行

    // // 監聽分頁聚焦，確保多個分頁切換時，Cookie 永遠是該分頁的 ID
    // window.addEventListener('focus', syncSession);
    // window.addEventListener('visibilitychange', () => {
    // if (document.visibilityState === 'visible') syncSession();
    // });
    // return () => {
    //   window.removeEventListener('focus', syncSession);
    //   window.removeEventListener('visibilitychange', syncSession);
    //   }

    }, [searchParams]);
  // --- 邏輯 B：租戶切換監控 (包含選擇「否」的回航邏輯) ---
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
        sessionStorage.setItem('skip_logout', 'true');
        const sid = sessionStorage.getItem('tab_session_id');
        const sidInput = formRef.current.querySelector('input[name="sessionId"]') as HTMLInputElement;
        if (sidInput && sid) sidInput.value = sid;
        formRef.current.requestSubmit();
        sessionStorage.removeItem('tab_session_id');
      } else {
        // --- 選擇「否」：回歸原位 ---
        // 🚀 [修改] 0. 決定安全回歸路徑
        const originalTenant = authTenant || currentTenant;
        const path = originalTenant === "public" ? "/dashboard" : `/${originalTenant}/dashboard`;
        
        // 🚀 [修改] 1. 設定標記，告訴 beforeunload 不要執行 API 登出
        isNavigatingRef.current = true;
        sessionStorage.setItem('skip_logout', 'true');

        // // 2. ✅ [關鍵] 設定一個極短效的 Cookie 讓 Middleware 放行一次，避免 URL 出現 auth_tenant
        // document.cookie = "temp_bypass=true; path=/; max-age=10";
      
        // 2. 🚀 [關鍵修改] 移除 temp_bypass Cookie。
        // 改為在網址加上 auth_tenant 參數。
        // Middleware 看到這個參數會放行，隨後「邏輯 A」會偵測到並自動把這個參數從網址列抹除。
        const returnUrl = new URL(path, window.location.origin);
        returnUrl.searchParams.set('auth_tenant', originalTenant as string);

        // 3. 執行跳轉
        // 使用 window.location.replace 確保環境乾淨重新觸發 Middleware 判定
        // 🚀 [修正] 使用 replace 強制觸發路徑變動
        window.location.replace(returnUrl.toString());
      }
    }
  }, [searchParams, currentTenant]);

  // --- 邏輯 C：新增的分頁關閉自動登出 (防止跳轉時誤觸發) ---
  useEffect(() => {
    // 🚀 [新增] 只要進入組件且沒有 pending 參數，延遲一點點就清理標記
    const hasPending = searchParams.has('pending_switch');
    // 每次進入/重新整理頁面，確保標記在完成載入後會被清理
    const cleanup = setTimeout(() => {
      if (!hasPending) {
        sessionStorage.removeItem('skip_logout');
        // 🚀 [新增] 同步重置 Ref 標記
        isNavigatingRef.current = false;
      }
    }, 2000);
    const handleUnload = () => {
      // 1. 🚀 [精確偵測行為]：在 unload 瞬間判斷導航類型
      const navEntries = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const navType = navEntries.length > 0 ? navEntries[0].type : '';
      // 排除刷新 (reload) 與 瀏覽器前進後退 (back_forward)
      const isStandardNavigation = navType === 'reload' || navType === 'back_forward';
      // 2. 🚀 [多重標記檢查]
      const isManualSkipping = isNavigatingRef.current === true;
      const isStorageSkipping = sessionStorage.getItem('skip_logout') === 'true';
      // 🚀 [修改] 判斷是否應該跳過登出：(Ref 標記 OR 刷新行為 OR sessionStorage 標記)
      // 🐞 Debug: 如果被攔截，開發者工具可能看不到，但這能幫助邏輯判斷
      if (isStandardNavigation || isManualSkipping || isStorageSkipping) {
        return; // 命中任何一項保護規則，直接終止，不發送登出 API
      }
      //3. 執行自動登出 (僅限真正「關閉分頁」或「輸入新網址離開」)
      const sid = sessionStorage.getItem('tab_session_id');
      if (!sid) return;

      const blob = new Blob([JSON.stringify({ sessionId: sid, source: "close-tab" })], { type: 'application/json' });
      navigator.sendBeacon("/api/logout", blob);
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearTimeout(cleanup);
      window.removeEventListener("beforeunload", handleUnload);
    }
  }, [searchParams]);
  
  // 🚀 [修改] 當路徑變動完成後，重置 Ref 標記
  useEffect(() => {
    isNavigatingRef.current = false;
  }, [searchParams]);

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

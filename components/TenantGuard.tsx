// components/TenantGuard.tsx
"use client";
import { handleLogout } from "@/app/dashboard/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  // ✅ 新增：用來標記是否為「正常的內部跳轉」，避免觸發登出
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
      } else {
        // 如果連 sessionStorage 都沒了，確保 Cookie 也是空的
        document.cookie = "sessionId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        // 🐞 Debug: 確認 Cookie 清除後的狀態
        console.log("🐞 Cookie after syncSession (清除):", document.cookie);
      }
    };

    syncSession(); // 組件掛載時立即執行

    // 監聽分頁聚焦，確保多個分頁切換時，Cookie 永遠是該分頁的 ID
    window.addEventListener('focus', syncSession);
    window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncSession();
    });
    return () => {
      window.removeEventListener('focus', syncSession);
      window.removeEventListener('visibilitychange', syncSession);
      }
    }, []);
  // --- 邏輯 B：租戶切換監控 (包含選擇「否」的回航邏輯) ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pendingSwitch = searchParams.get("pending_switch");
    const targetTenant = searchParams.get("target_tenant");
    const authTenant = searchParams.get("auth_tenant");

    if (pendingSwitch && targetTenant) {
      const confirmed = window.confirm(
        `您目前已登入 ${authTenant || currentTenant}，是否要登出並切換至 ${targetTenant}? (此操作將登出目前帳號)`
      );

      if (confirmed && formRef.current) {
        // --- 選擇「是」：執行登出切換 ---
        isNavigatingRef.current = true; // 標記為導航中，避免觸發自動登出
        
        const sid = sessionStorage.getItem('tab_session_id');
        const sidInput = formRef.current.querySelector('input[name="sessionId"]') as HTMLInputElement;
        if (sidInput && sid) sidInput.value = sid;
        
        formRef.current.requestSubmit();
        sessionStorage.removeItem('tab_session_id'); 
      } else {
        // --- 選擇「否」：維持原畫面邏輯 ---
        const originalTenant = authTenant || currentTenant;
        const origin = window.location.origin;
        const path = originalTenant === "public" ? "/dashboard" : `/${originalTenant}/dashboard`;
        
        // 1. 標記現在是「安全跳轉」，不要執行邏輯 C 的登出
        isNavigatingRef.current = true;

        // 2. 強制寫入一次 Cookie，確保 Middleware 抓得到
        const sid = sessionStorage.getItem('tab_session_id');
        if (sid) {
          document.cookie = `sessionId=${sid}; path=/; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure' : ''}`;
        }

        // 3. 構造帶有 auth_tenant 參數的 URL，觸發 Middleware 的白名單放行
        const safeUrl = new URL(path, origin);
        safeUrl.searchParams.set('auth_tenant', originalTenant);

        // 4. 使用原生 replace 跳轉，徹底消除舊的 pending_switch 參數並強制刷新身分
        setTimeout(() => {
          window.location.replace(safeUrl.toString());
        }, 50);
      }
    }
  }, [searchParams, currentTenant]);

  // --- 邏輯 C：新增的分頁關閉自動登出 (防止跳轉時誤觸發) ---
  useEffect(() => {
    const handleUnload = () => {
      // 🚀 核心修正：如果是因為邏輯 B 的跳轉引發的卸載，則不執行登出
      if (isNavigatingRef.current) {
        return;
      }

      const sid = sessionStorage.getItem('tab_session_id');
      if (!sid) return;

      const blob = new Blob([JSON.stringify({ sessionId: sid, source: "close-tab" })], { type: 'application/json' });
      navigator.sendBeacon("/api/logout", blob);
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
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

// components/TenantGuard.tsx
"use client";
import { handleLogout } from "@/app/dashboard/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  // --- 邏輯 A：Session 同步核心 (解決刷新不登出) ---
  useEffect(() => {
    const syncSession = () => {
      // 從分頁獨立的存儲空間抓取 ID
      const sid = sessionStorage.getItem('tab_session_id');
      
      if (sid) {
        // ✅ 將 ID 寫入 Cookie，讓 Middleware 可以驗證身分
        // 不設定 expires，這會使其成為 Session Cookie
        document.cookie = `sessionId=${sid}; path=/; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure' : ''}`;
      } else {
        // 如果連 sessionStorage 都沒了，確保 Cookie 也是空的
        document.cookie = "sessionId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
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
  // --- 邏輯 B：原有的租戶切換監控 ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 防止在錯誤頁或跨來源 context 執行
    const href = window.location.href;
    if (!href.startsWith(window.location.origin)) return;

    const pendingSwitch = searchParams.get("pending_switch");
    const targetTenant = searchParams.get("target_tenant");

    if (pendingSwitch && targetTenant) {
      const confirmed = window.confirm(
        `您目前已登入 ${currentTenant}，是否要登出並切換至 ${targetTenant}? (此操作將登出目前帳號)`
      );
      if (confirmed && formRef.current) {
        // 登出前，手動把 sessionStorage 的 ID 填入隱藏欄位
        const sid = sessionStorage.getItem('tab_session_id');
        const sidInput = formRef.current.querySelector('input[name="sessionId"]') as HTMLInputElement;
        if (sidInput && sid) sidInput.value = sid;
        formRef.current.requestSubmit();
        sessionStorage.removeItem('tab_session_id'); // 清除本地狀態
      } else {
        router.push(
          currentTenant === "public" ? "/dashboard" : `/${currentTenant}/dashboard`
        );
      }
    }
  }, [searchParams, currentTenant, router]);
  // --- 邏輯 C：新增的分頁關閉自動登出 ---
  useEffect(() => {
  const handleUnload = () => {
    const sid = sessionStorage.getItem('tab_session_id');
    if (!sid) return;

    // 使用 sendBeacon 確保在分頁關閉的瞬間，請求能發送到 /api/logout
    const blob = new Blob([JSON.stringify({ sessionId: sid })], { type: 'application/json' });
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

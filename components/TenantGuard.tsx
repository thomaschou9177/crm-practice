// components/TenantGuard.tsx
"use client";
import { handleLogout } from "@/app/dashboard/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  // --- 邏輯 A：原有的租戶切換監控 ---
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 防止在錯誤頁或跨來源 context 執行
    const href = window.location.href;
    if (!href.startsWith(window.location.origin)) return;

    const pendingSwitch = searchParams.get("pending_switch");
    const targetTenant = searchParams.get("target_tenant");

    if (pendingSwitch && targetTenant) {
      const confirmed = window.confirm(
        `您目前已登入 ${currentTenant}，是否要登出並切換至 ${targetTenant}?`
      );
      if (confirmed && formRef.current) {
        formRef.current.requestSubmit();
      } else {
        router.push(
          currentTenant === "public" ? "/dashboard" : `/${currentTenant}/dashboard`
        );
      }
    }
  }, [searchParams, currentTenant, router]);
  // --- 邏輯 B：新增的分頁關閉自動登出 ---
  useEffect(() => {
    const handleUnload = () => {
      // 使用 sendBeacon 確保瀏覽器關閉時仍能穩定發送登出請求
      navigator.sendBeacon("/api/logout");
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);
  return (
    <form ref={formRef} action={handleLogout} style={{ display: "none" }}>
      <input type="hidden" name="tenant" value={currentTenant} />
      <input
        type="hidden"
        name="target_tenant"
        value={searchParams.get("target_tenant") || ""}
      />
    </form>
  );
}

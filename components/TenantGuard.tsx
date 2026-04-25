// components/TenantGuard.tsx
"use client";
import { handleLogout } from "@/app/dashboard/actions"; // 或動態租戶的 actions，看你放在哪裡
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 防止在 chrome-error:// 或非本站域名執行
    if (!window.location.href.startsWith("https://crm-practice.vercel.app")) return;

    const pendingSwitch = searchParams.get("pending_switch");
    const targetTenant = searchParams.get("target_tenant");

    if (pendingSwitch && targetTenant) {
      const confirmed = window.confirm(
        `您目前已登入 ${currentTenant}，是否要登出並切換至 ${targetTenant}?`
      );
      if (confirmed && formRef.current) {
        formRef.current.requestSubmit();
      } else {
        // 使用者取消 → 回到原本 dashboard
        router.push(
          currentTenant === "public" ? "/dashboard" : `/${currentTenant}/dashboard`
        );
      }
    }
  }, [searchParams, currentTenant, router]);

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
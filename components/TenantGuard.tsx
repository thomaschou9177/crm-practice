// components/TenantGuard.tsx
'use client';

import { handleLogout } from '@/app/dashboard/actions';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingPath = searchParams.get('pending_switch');
  const targetTenant = searchParams.get('target_tenant');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (pendingPath) {
      const confirmSwitch = window.confirm(
        `您目前已登入 ${currentTenant}，是否要登出並切換至新頁面？`
      );

      if (confirmSwitch) {
        // ✅ 觸發隱藏表單 submit，交給 handleLogout
        formRef.current?.requestSubmit();
      } else {
        const newUrl =
          currentTenant === 'public'
            ? '/dashboard'
            : `/${currentTenant}/dashboard`;
        router.replace(newUrl);
      }
    }
  }, [pendingPath, currentTenant, router]);

  return (
    <form ref={formRef} action={handleLogout} style={{ display: 'none' }}>
      <input type="hidden" name="tenant" value={currentTenant} />
      {targetTenant && <input type="hidden" name="target_tenant" value={targetTenant} />}
    </form>
  );
}

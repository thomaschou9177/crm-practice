// components/TenantGuard.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingPath = searchParams.get('pending_switch');

  useEffect(() => {
    if (pendingPath) {
      const confirmSwitch = window.confirm(`您目前已登入 ${currentTenant}，是否要登出並切換至新頁面？`);

      if (confirmSwitch) {
        // 使用者選「是」：執行登出並轉跳  
          router.push(pendingPath);
      } else {
        // 使用者選「否」：留在原地，清除 URL 中的參數
        const newUrl = currentTenant === 'public' ? '/dashboard' : `/${currentTenant}/dashboard`;
        router.replace(newUrl);
      }
    }
  }, [pendingPath, currentTenant, router]);

  return null;
}
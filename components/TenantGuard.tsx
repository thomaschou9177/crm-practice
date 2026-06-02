// components/TenantGuard.tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  // 🟢【新增】控制是否驗證通過的狀態，用來做前端防閃爍遮罩
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // 🟢【核心修改】根據當前頁面的租戶，動態讀取專屬的 sessionStorage Key
    const cookieName = currentTenant === 'public' ? 'session_public' : `session_${currentTenant}`;
    const sid = sessionStorage.getItem(cookieName);

    // 🟢【新增】2. 核心防禦：如果沒值，代表此分頁是新開的（或未登入），立刻踢回該租戶的登入頁
    if (!sid) {
      console.warn("❌ 分頁無租戶 [${currentTenant}] 的 Session 紀錄，安全引導至登入頁");
      const loginPath = currentTenant === 'public' ? '/' : `/${currentTenant}`;
      
      // 使用 window.location.replace 確保瀏覽器歷史紀錄不會留下 Dashboard 錯誤頁
      window.location.replace(loginPath);
    } else {
      // 🟢【新增】3. 有值且對應租戶正確，允許顯示 Dashboard 內容
      setIsAuthorized(true);
    }
  }, [currentTenant]);

  // 🟢【新增】3. 在前端 JS 還沒驗證完畢前（約 0.02 秒），用全螢幕遮罩擋住，防止 SSR 畫面外洩或閃爍
  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500">正在驗證分頁安全憑證...</p>
        </div>
      </div>
    );
  }

  // ✅ 驗證通過，不渲染任何遮罩，讓下方的 Dashboard 內容正常顯示
  return null;
}
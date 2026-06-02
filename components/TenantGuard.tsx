// components/TenantGuard.tsx
"use client";
import { handleLogout } from "@/app/dashboard/actions";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TenantGuard({ currentTenant }: { currentTenant: string }) {
  const router = useRouter();
  // 🟢【新增】控制是否驗證通過的狀態，用來做前端防閃爍遮罩
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const [statusMessage, setStatusMessage] = useState("正在驗證分頁安全憑證...");

  useEffect(() => {
    const checkAndEnforceIsolation = async () => {
      // 1. 定義當前網址應該對應的專屬 Key
      const currentKey = currentTenant === 'public' ? 'session_public' : `session_${currentTenant}`;
      
      // 2. 🟢【核心新增：跨租戶主動登出檢測】
      // 找出 sessionStorage 裡面，有沒有留著「非當前租戶」的舊憑證
      let activeOldTenant: string | null = null;
      let oldSessionId: string | null = null;

      // 檢查是否殘留 public 憑證
      if (currentTenant !== 'public' && sessionStorage.getItem('session_public')) {
        activeOldTenant = 'public';
        oldSessionId = sessionStorage.getItem('session_public');
      } 
      // 檢查是否殘留其他 tenant1, tenant2... 憑證
      else {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('session_') && key !== currentKey && key !== 'session_public') {
            activeOldTenant = key.replace('session_', '');
            oldSessionId = sessionStorage.getItem(key);
            break;
          }
        }
      }

      // 3. 🟢【核心新增：執行跨租戶強制登出】
      // 如果發現了舊租戶的憑證，且使用者改網址來到了新租戶區域
      if (activeOldTenant && oldSessionId) {
        console.warn(`🚨 偵測到從 [${activeOldTenant}] 跨越至 [${currentTenant}]，正在強制登出舊連線...`);
        setStatusMessage(`正在安全登出 ${activeOldTenant} 並切換環境...`);

        // A. 建立模擬的 FormData 傳給後端 Action
        const formData = new FormData();
        formData.set('tenant', activeOldTenant);
        formData.set('sessionId', oldSessionId);

        // B. 依據舊租戶的身分，呼叫對應的後端銷毀函式
        try {
          if (activeOldTenant === 'public') {
            await handleLogout(formData);
          } else {
            await handleLogout(formData);
          }
        } catch (e) {
          // Next.js Server Action 內部 redirect 會拋出 error，此處捕獲以防阻斷前端
        }

        // C. 清除前端舊租戶的 sessionStorage，完成徹底決裂
        const oldKey = activeOldTenant === 'public' ? 'session_public' : `session_${activeOldTenant}`;
        sessionStorage.removeItem(oldKey);

        // D. 🟢 關鍵：因為是改網址過來的，舊的清掉後，新租戶此時必定也沒有金鑰，直接重定向到新租戶登入頁
        const loginPath = currentTenant === 'public' ? '/' : `/${currentTenant}`;
        window.location.replace(loginPath);
        return;
      }

      // 4. ✅【正常防禦判定】如果沒有跨租戶污染，正常檢查當前租戶是否有憑證
      const sid = sessionStorage.getItem(currentKey);

      if (!sid) {
        console.warn(`❌ 分頁無租戶 [${currentTenant}] 的 Session 紀錄，引導至登入頁`);
        const loginPath = currentTenant === 'public' ? '/' : `/${currentTenant}`;
        window.location.replace(loginPath);
      } else {
        // 有憑證且租戶正確，放行
        setIsAuthorized(true);
      }
    };

    checkAndEnforceIsolation();
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



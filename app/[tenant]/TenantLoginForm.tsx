// app/[tenant]/TenantLoginForm.tsx
"use client";

import { useActionState, useEffect, useState } from "react"; // ✅ 引入 useActionState
import { loginTenant } from "./dashboard/actions"; // ✅ 確保路徑正確

export default function TenantLoginForm({ tenant }: { tenant: string }) {
  // ✅ 使用 useActionState 綁定 Action
  const [state, formAction, isPending] = useActionState(loginTenant, null);
  // 🚀 新增：用來鎖定「正在整頁跳轉中」的畫面狀態
  const [isRedirecting, setIsRedirecting] = useState(false);
  // ✅ 新增：處理分頁獨立 Session 邏輯
  useEffect(() => {
    if (state?.success && state.sessionId) {
      // 1. 開啟跳轉鎖定，確保 Loading 訊息持續顯示到新頁面載入完成
      setIsRedirecting(true);
      // 2. 存入該分頁特有的 sessionStorage
      sessionStorage.setItem('tab_session_id', state.sessionId);
      
      // 🚀 [建議修改處]：使用「租戶專屬」的 Cookie 名稱
      // 這樣當 tenant1 登入時，不會蓋掉 public 的 session Cookie
      const cookieName = `session_${tenant}`;

      // 2. 同步到 Cookie 供 Middleware 驗證 (Session Cookie 模式)
      document.cookie = `${cookieName}=${state.sessionId}; path=/; SameSite=Lax; ${
        window.location.protocol === 'https:' ? 'Secure' : ''
      }`;

      // 3. 導向該租戶的 Dashboard
      // 建議使用 window.location.href 而不是 router.push 
      // 這樣可以確保整頁重新載入，讓 Middleware 重新執行並抓到最新的 Cookie
      window.location.href = state.redirectTo || (tenant === 'public' ? '/dashboard' : `/${tenant}/dashboard`);
    }
  }, [state, tenant]);
  // 🚀 整合「Action 處理中」與「成功後路由跳轉中」的總載入狀態
  const showLoading = isPending || isRedirecting;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      {/* 🚀 全畫面覆蓋的「登入中請等待」毛玻璃特效層 */}
      {showLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md transition-all duration-300">
          <div className="flex flex-col items-center space-y-4">
            {/* CSS 載入動畫圈圈 */}
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-lg font-bold text-slate-800 animate-pulse">
              系統登入中，請稍候...
            </p>
          </div>
        </div>
      )}
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold mb-4">{tenant} 專屬登入</h1>
        
        {/* ✅ 顯示來自 Server Action 的錯誤訊息 */}
        {state?.error && <p className="text-red-600 mb-2 text-center">{state.error}</p>}
        
        {/* ✅ form 改用 formAction，並移除 onSubmit */}
        <form action={formAction} className="space-y-4">
          {/* ✅ 必須加入隱藏欄位，讓 Action 知道是哪個租戶 */}
          <input type="hidden" name="tenant" value={tenant} />
          
          <input
            type="text"
            name="username" // ✅ 必須提供 name 屬性給 FormData 讀取
            placeholder="使用者名稱"
            required
            className="w-full border rounded px-3 py-2 text-gray-900"
          />
          <input
            type="password"
            name="password" // ✅ 必須提供 name 屬性給 FormData 讀取
            placeholder="密碼"
            required
            className="w-full border rounded px-3 py-2 text-gray-900"
          />
          
          <button
            type="submit"
            disabled={showLoading}
            className={`w-full py-2 rounded text-white font-bold transition-all ${
              showLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {showLoading ? "登入中..." : "登入"}
          </button>
        </form>
      </div>
    </main>
  );
}
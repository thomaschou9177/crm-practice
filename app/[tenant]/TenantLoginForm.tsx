// app/[tenant]/TenantLoginForm.tsx
"use client";

import { useActionState } from "react"; // ✅ 引入 useActionState
import { loginTenant } from "./dashboard/actions"; // ✅ 確保路徑正確

export default function TenantLoginForm({ tenant }: { tenant: string }) {
  // ✅ 使用 useActionState 綁定 Action
  // state 將接收來自 loginTenant 回傳的 { error: "..." }
  const [state, formAction, isPending] = useActionState(loginTenant, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
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
            disabled={isPending}
            className={`w-full py-2 rounded text-white font-bold transition-all ${
              isPending ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPending ? "登入中..." : "登入"}
          </button>
        </form>
      </div>
    </main>
  );
}
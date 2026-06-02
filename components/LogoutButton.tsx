"use client"; // 宣告為 Client Component

import { handleLogout } from "@/app/dashboard/actions";

export default function LogoutButton({ tenant }: { tenant: string }) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // 1. 根據目前組件拿到的 tenant，組合出專屬的 sessionStorage Key
    const keyName = tenant === 'public' ? 'session_public' : `session_${tenant}`;

    // 2. 從分頁記憶體取出專屬該租戶的 sessionId
    const sid = sessionStorage.getItem(keyName);

    // 3. 填入隱藏欄位供後端 Server Action 銷毀資料庫紀錄
    const input = e.currentTarget.querySelector('input[name="sessionId"]') as HTMLInputElement;
    if (sid && input) {
      input.value = sid;
    }
    // 4. 🚀【全新安全機制】既然要登出了，直接在前端順手把 sessionStorage 清空！
    sessionStorage.removeItem(keyName);
  };

  return (
    <form action={handleLogout} onSubmit={handleSubmit}>
      <input type="hidden" name="tenant" value={tenant} />
      <input type="hidden" name="sessionId" value="" />
      <button type="submit" className="bg-white border px-4 py-2 rounded font-bold shadow-sm">
        Logout
      </button>
    </form>
  );
}
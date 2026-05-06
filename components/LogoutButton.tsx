"use client"; // 宣告為 Client Component

import { handleLogout } from "@/app/dashboard/actions";

export default function LogoutButton() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // 從 sessionStorage 抓取 ID 並填入隱藏欄位
    const sid = sessionStorage.getItem('tab_session_id');
    const input = e.currentTarget.querySelector('input[name="sessionId"]') as HTMLInputElement;
    if (sid && input) {
      input.value = sid;
    }
  };

  return (
    <form action={handleLogout} onSubmit={handleSubmit}>
      <input type="hidden" name="tenant" value="public" />
      <input type="hidden" name="sessionId" value="" />
      <button type="submit" className="bg-white border px-4 py-2 rounded font-bold shadow-sm">
        Logout
      </button>
    </form>
  );
}
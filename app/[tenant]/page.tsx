// app/[tenant]/page.tsx
"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";

// 定義每個 tenant 的帳號密碼
const TENANT_USERS: Record<string, { username: string; password: string }[]> = {
  tenant1: [
    { username: "tenant1admin", password: "t1password123" },
    { username: "tenant1user", password: "t1user123" },
    { username: "tenant1test", password: "t1test123" },
  ],
  tenant2: [
    { username: "tenant2admin", password: "t2password123" },
    { username: "tenant2user", password: "t2user123" },
    { username: "tenant2test", password: "t2test123" },
  ],
};

export default function TenantLogin({ params }: { params: { tenant: string } }) {
  const router = useRouter();
  const tenant = params.tenant; // tenant1 或 tenant2
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validUsers = TENANT_USERS[tenant] || [];
    const user = validUsers.find(
      (u) => u.username === username && u.password === password
    );

    if (user) {
      alert(`登入成功！Tenant: ${tenant}, 使用者: ${user.username}`);
      router.push(`/${tenant}/dashboard`); // 導向 tenant 專屬的 dashboard
    } else {
      setError("帳號或密碼錯誤");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl border border-gray-100">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {tenant} 專屬登入
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            請輸入 {tenant} 的帳號密碼
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700">
              使用者名稱
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">
              密碼
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-200"
          >
            登入
          </button>
        </form>
      </div>
    </main>
  );
}

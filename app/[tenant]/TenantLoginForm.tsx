// app/[tenant]/TenantLoginForm.tsx (Client Component)
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TENANT_USERS: Record<string, { username: string; password: string }[]> = {
  tenant1: [
    { username: "tenant1admin", password: "t1password123" },
    { username: "tenant1user", password: "t1user123" },
  ],
  tenant2: [
    { username: "tenant2admin", password: "t2password123" },
    { username: "tenant2user", password: "t2user123" },
  ],
};

export default function TenantLoginForm({ tenant }: { tenant: string }) {
  console.log(tenant);
  const router = useRouter();
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
      router.push(`/${tenant}/dashboard`);
    } else {
      setError("帳號或密碼錯誤");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold mb-4">{tenant} 專屬登入</h1>
        {error && <p className="text-red-600 mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="使用者名稱"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <input
            type="password"
            placeholder="密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded"
          >
            登入
          </button>
        </form>
      </div>
    </main>
  );
}

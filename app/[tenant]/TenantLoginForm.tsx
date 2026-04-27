// app/[tenant]/TenantLoginForm.tsx (Client Component)
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TenantLoginForm({ tenant }: { tenant: string }) {
  console.log(tenant);
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success,setSuccess]=useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      // 呼叫 /api/login，由 API 驗證帳號密碼並建立 session
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, tenant }),
      });

      if (res.ok) {
        // 顯示登入成功訊息
        setSuccess(`登入成功！Tenant: ${tenant}, 使用者: ${username}`);
        // 登入成功 → 導向對應租戶的 dashboard
        if (tenant === "public") {
          router.push("/dashboard");
        } else {
          router.push(`/${tenant}/dashboard`);
        }
      } else {
        const data = await res.json();
        setError(data.error || "登入失敗");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("系統錯誤，請稍後再試");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold mb-4">{tenant} 專屬登入</h1>
        {error && <p className="text-red-600 mb-2">{error}</p>}
        {success && <p className="text-green-600 mb-2">{success}</p>}
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

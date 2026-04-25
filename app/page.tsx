// app/page.tsx
'use client';

import { useRouter } from 'next/navigation'; // Import the router
import React, { useState } from 'react';
import { loginPublic } from './dashboard/actions';

const translations = {
  en: {
    title: "CRM Login",
    subtitle: "Enter your credentials to access the system",
    username: "Username",
    password: "Password",
    signIn: "Sign In",
    // demoAccounts: "Valid Demo Accounts",
    error: "Invalid username or password. Please try again.",
    success: "Login Successful! Welcome, "
  },
  zh: {
    title: "CRM 系統登入",
    subtitle: "請輸入您的憑據以進入系統",
    username: "使用者名稱",
    password: "密碼",
    signIn: "登入",
    // demoAccounts: "有效測試帳號",
    error: "使用者名稱或密碼錯誤，請再試一次。",
    success: "登入成功！歡迎，"
  },
  jp: {
    title: "CRM ログイン",
    subtitle: "システムにアクセスするために資格情報を入力してください",
    username: "ユーザー名",
    password: "パスワード",
    signIn: "サインイン",
    // demoAccounts: "有効なデモアカウント",
    error: "ユーザー名またはパスワードが無効です。もう一度お試しください。",
    success: "ログインに成功しました！ようこそ、"
  }
};
// Hardcoded valid credentials
const VALID_USERS = [
  { username: 'admin', password: 'password123' },
  { username: 'user', password: 'user123' },
  { username: 'test', password: 'test123' },
];

export default function Home() {
  const router = useRouter(); // Initialize router
  const [lang, setLang] = useState<'en' | 'zh' | 'jp'>('en');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const t = translations[lang];
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check if the input matches any of our 3 sets
    const user = VALID_USERS.find(
      (u) => u.username === username && u.password === password
    );

    if (user) {
      alert(`${t.success}${user.username}`);
      router.push('/dashboard')
      // In a real app, you would use 'next/navigation' to redirect here
      // router.push('/dashboard'); 
    } else {
      setError(t.error);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6">
      {/* Language Switcher */}
      <div className="absolute top-6 right-6 flex gap-2">
        {(['en', 'zh', 'jp'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              lang === l 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {l === 'en' ? 'EN' : l === 'zh' ? '繁中' : '日本語'}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl border border-gray-100">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t.title}</h1>
          <p className="mt-3 text-sm text-gray-500">{t.subtitle}</p>
        </div>
        
        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200 text-center">
            {error}
          </div>
        )}

        {/* ✅ 改成使用 Server Action */}
        <form action={loginPublic} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700">{t.username}</label>
            <input 
              type="text" 
              name="username"
              required 
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder={t.username}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700">{t.password}</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder={t.password}
            />
          </div>

          <button 
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-200"
          >
            {t.signIn}
          </button>
        </form>

        {/* <div className="mt-8 border-t border-gray-100 pt-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{t.demoAccounts}</p>
          <div className="mt-2 flex justify-center gap-3 text-xs text-gray-500">
            <span>admin</span>
            <span className="text-gray-300">|</span>
            <span>user</span>
            <span className="text-gray-300">|</span>
            <span>test</span>
          </div>
        </div> */}
      </div>
    </main>
  );
}
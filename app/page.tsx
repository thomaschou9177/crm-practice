// app/page.tsx
'use client';

import { useActionState, useEffect, useState } from 'react';
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
    success: "Login Successful! Welcome, ",
    loading: "Signing in, please wait..." // 🚀 新增 Loading 翻譯
  },
  zh: {
    title: "CRM 系統登入",
    subtitle: "請輸入您的憑據以進入系統",
    username: "使用者名稱",
    password: "密碼",
    signIn: "登入",
    // demoAccounts: "有效測試帳號",
    error: "使用者名稱或密碼錯誤，請再試一次。",
    success: "登入成功！歡迎，",
    loading: "系統登入中，請稍候..." // 🚀 新增 Loading 翻譯

  },
  jp: {
    title: "CRM ログイン",
    subtitle: "システムにアクセスするために資格情報を入力してください",
    username: "ユーザー名",
    password: "パスワード",
    signIn: "サインイン",
    // demoAccounts: "有効なデモアカウント",
    error: "ユーザー名またはパスワードが無効です。もう一度お試しください。",
    success: "ログインに成功しました！ようこそ、",
    loading: "サインイン中、しばらくお待ちください..." // 🚀 新增 Loading 翻譯
  }
};
// Hardcoded valid credentials
// const VALID_USERS = [
//   { username: 'admin', password: 'password123' },
//   { username: 'user', password: 'user123' },
//   { username: 'test', password: 'test123' },
// ];

export default function Home() {
  // const router = useRouter(); // Initialize router
  const [lang, setLang] = useState<'en' | 'zh' | 'jp'>('en');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [state, formAction, isPending] = useActionState(loginPublic, null);
  const t = translations[lang];
  // 🚀 新增一個狀態：用來鎖定「正在跳轉中」的畫面，防止 Server Action 結束後提示字消失
  const [isRedirecting, setIsRedirecting] = useState(false);
  // ✅ 新增：監聽登入結果
  useEffect(() => {
    // 1. 新增：偵測瀏覽器「上一頁」行為
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // 如果頁面是從快取（BFCache）復原過來的，強制關閉 Loading 狀態
        setIsRedirecting(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    if (state?.success) {
      // 1. 進入跳轉鎖定狀態
      setIsRedirecting(true); // 🚀 登入成功，立刻鎖定畫面進入跳轉狀態

      // 2. 寫入 sessionStorage 與 Cookie (比照租戶登入邏輯)
      if (state.sessionId) {
        sessionStorage.setItem('tab_session_id', state.sessionId);
        document.cookie = `session_public=${state.sessionId}; path=/; SameSite=Lax; ${
          window.location.protocol === 'https:' ? 'Secure' : ''
        }`;
      }

      // 3. 執行整頁跳轉（這時畫面會維持 Loading 直到 Dashboard 渲染完成）
      window.location.href = state.redirectTo || '/dashboard';
    }
    // 3. 新增：元件卸載時移除監聽器
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [state]);
  // 🚀 整合「點擊送出中」與「成功後跳轉中」的總載入狀態
  const showLoading = isPending || isRedirecting;
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      
      {/* 🚀 全畫面覆蓋的「登入中請等待」毛玻璃特效層 */}
      {showLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md transition-all duration-300">
          <div className="flex flex-col items-center space-y-4">
            {/* 這裡放一個精美的 CSS 載入動畫圈圈 */}
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-lg font-bold text-slate-800 animate-pulse">
              {t.loading}
            </p>
          </div>
        </div>
      )}
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
        
        {state?.error && (
          <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200 text-center">
            {state.error}
          </div>
        )}

        {/* ✅ 改成使用 Server Action */}
        <form action={formAction} className="mt-8 space-y-5">
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
              name="password"  
              required 
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder={t.password}
            />
          </div>

          <button 
            type="submit"
            disabled={showLoading} // ✅ 防止重複提交
            className={`w-full rounded-xl py-4 font-bold text-white transition-all shadow-lg ${
              showLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-blue-200'
            }`}
          >
            {showLoading ? t.loading : t.signIn}
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
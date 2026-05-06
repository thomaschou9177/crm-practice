// lib/session.ts
import { createClient } from '@supabase/supabase-js';

// const supabase = createClient(
//   process.env.SUPABASE_URL!,
//   process.env.SUPABASE_ANON_KEY!
// );

// 1. 先定義型別
export type SessionData = {
  tenant: string;
  isLoggedIn: boolean;
  user?: { name: string };
};

/**
 * ✅ 優化點：延遲初始化 Supabase Client
 * 這樣在 Vercel 編譯掃描檔案時，不會因為抓不到環境變數而直接崩潰。
 */
const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // 只有在實際運行且缺少變數時才報錯，編譯期間若沒用到則不會觸發
    throw new Error('Missing Supabase environment variables: SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return createClient(url, key);
};
// 建立 session[cite: 11]
export async function createSession(data: SessionData): Promise<string> {
  const supabase = getSupabase(); // 執行時才初始化
  const sessionId = crypto.randomUUID();
  // 🐞 Debug: 印出要建立的 sid 與 payload
  console.log("🐞 createSession → 新 sid:", sessionId, "payload:", data);
  const { error } = await supabase
    .from('sessions')
    .insert([{ id: sessionId, payload: data }]);

  if (error) {
    console.error('Supabase Session Create Error:', error);
    throw new Error('無法建立 Session');
  }
  // 🐞 Debug: 確認建立成功
  console.log("🐞 createSession → 成功建立 sid:", sessionId);
  return sessionId;
}

// 取得 session[cite: 10, 11]
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const supabase = getSupabase(); // 執行時才初始化
  try{
    // 🐞 Debug: 印出查詢 sid
    console.log("🐞 getSession → 查詢 sid:", sessionId);
    const { data, error } = await supabase
      .from('sessions')
      .select('id,payload')
      .eq('id', sessionId)
      .single();

    // 🐞 Debug: 印出查詢結果
    console.log("🐞 getSession → 查詢結果 data:", data, "error:", error);
    if (error || !data) {
      console.warn("🐞 getSession → 查不到 sid:", sessionId);
      return null;
    }
    return data.payload as SessionData;
  }catch(error){
    // 捕捉可能的異常（例如資料表不存在或連線問題）
    console.error('Get Session Error:', error);
    return null;
  }
}

// 刪除 session[cite: 11]
export async function destroySession(sessionId: string): Promise<void> {
  const supabase = getSupabase(); // 執行時才初始化
  // 🐞 Debug: 印出要刪除的 sid
  console.log("🐞 destroySession → 刪除 sid:", sessionId);
  const { error } =await supabase.from('sessions').delete().eq('id', sessionId);
  if (error) {
    console.error("🐞 destroySession → 刪除失敗:", error);
  } else {
    console.log("🐞 destroySession → 刪除成功 sid:", sessionId);
  }
}
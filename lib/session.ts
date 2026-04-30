// lib/session.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export type SessionData = {
  tenant: string;
  isLoggedIn: boolean;
  user?: { name: string };
};

// 建立 session[cite: 11]
export async function createSession(data: SessionData): Promise<string> {
  const sessionId = crypto.randomUUID();
  const { error } = await supabase
    .from('sessions')
    .insert([{ id: sessionId, payload: data }]);

  if (error) {
    console.error('Supabase Session Create Error:', error);
    throw new Error('無法建立 Session');
  }
  return sessionId;
}

// 取得 session[cite: 10, 11]
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('payload')
    .eq('id', sessionId)
    .single();

  if (error || !data) return null;
  return data.payload as SessionData;
}

// 刪除 session[cite: 11]
export async function destroySession(sessionId: string): Promise<void> {
  await supabase.from('sessions').delete().eq('id', sessionId);
}
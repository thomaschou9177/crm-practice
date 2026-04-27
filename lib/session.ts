// lib/session.ts
type SessionData = {
  tenant: string;
  isLoggedIn: boolean;
  user?: { name: string };
};

const sessionStore = new Map<string, SessionData>();

// 建立 session
export function createSession(data: SessionData): string {
  const sessionId = crypto.randomUUID();
  sessionStore.set(sessionId, data);
  return sessionId;
}

// 取得 session
export function getSession(sessionId: string): SessionData | null {
  return sessionStore.get(sessionId) || null;
}

// 刪除 session
export function destroySession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

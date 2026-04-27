// lib/session.ts
const sessionStore = new Map<string, any>();

export function createSession(data: any) {
  const sessionId = crypto.randomUUID();
  sessionStore.set(sessionId, data);
  return sessionId;
}

export function getSession(sessionId: string) {
  return sessionStore.get(sessionId);
}

export function destroySession(sessionId: string) {
  sessionStore.delete(sessionId);
}

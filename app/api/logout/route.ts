// app/api/logout/route.ts
import { destroySession } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionId = cookieHeader
    .split('; ')
    .find(c => c.startsWith('sessionId='))
    ?.split('=')[1];

  if (sessionId) {
    destroySession(sessionId);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('sessionId');
  return response;
}

// /middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // 🚀 放行 Next.js 內部資源、API 路由以及 favicon
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.includes('favicon.ico')
  ) {
    return NextResponse.next();
  }

  // 🚀 不做任何 Cookie 攔截與重導向，把頁面完全交給前端渲染
  return NextResponse.next();
  }

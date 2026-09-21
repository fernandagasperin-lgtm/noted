import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, authConfigured, isValidSession } from '@/lib/auth';

export const config = {
  // everything except the login screen, its endpoint, and static assets
  matcher: ['/((?!login|api/login|_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  if (!authConfigured()) {
    // Local development runs without a password; a deployed instance must not.
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        'Configure APP_PASSWORD e APP_SECRET nas variaveis de ambiente para liberar o acesso.',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }
    return NextResponse.next();
  }

  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSession, sessionConfigured } from '@/lib/session';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

/** Reachable without a session: signing in, first-run setup, accepting an invite. */
const PUBLIC_PATHS = [
  '/login',
  '/invite',
  '/api/login',
  '/api/setup',
  '/api/auth/status',
  '/api/invites/accept',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!sessionConfigured()) {
    return new NextResponse(
      'Configure APP_SECRET nas variaveis de ambiente para liberar o acesso.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  if (isPublic(pathname)) return NextResponse.next();

  // The signature is checked here; who the user is gets loaded in the route itself,
  // because the middleware runs on the Edge runtime and cannot reach the database.
  if (await readSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'nao autenticado' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

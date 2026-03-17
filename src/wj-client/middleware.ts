import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/request';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
  localeCookie: {
    name: 'wj-locale',
  },
});

// Old finance routes → new unified /dashboard/finance page
const financeRedirectMap: Record<string, string> = {
  '/dashboard/transaction': 'transaction',
  '/dashboard/report': 'report',
  '/dashboard/budget': 'budget',
};

export default function middleware(request: NextRequest) {
  // Strip locale prefix to check the path
  const pathname = request.nextUrl.pathname;
  const localePattern = new RegExp(`^/(${locales.join('|')})`);
  const pathWithoutLocale = pathname.replace(localePattern, '');

  const tabValue = financeRedirectMap[pathWithoutLocale];
  if (tabValue) {
    const url = request.nextUrl.clone();
    // Replace old path with /dashboard/finance, preserving locale prefix
    url.pathname = pathname.replace(pathWithoutLocale, '/dashboard/finance');
    // Preserve existing query params and add tab
    url.searchParams.set('tab', tabValue);
    return NextResponse.redirect(url, 308);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

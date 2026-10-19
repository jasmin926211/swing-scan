import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Name of the backend's httpOnly session cookie. Its presence is only a hint for routing; the backend
// checks the session on every data request and answers 401 if it is missing or expired.
const SESSION_COOKIE = "ct_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.has(SESSION_COOKIE);

  if (pathname === "/signin" || pathname === "/signup") {
    // ?expired=1 comes from a 401: the cookie is stale, so drop it instead of bouncing back to /markets.
    if (request.nextUrl.searchParams.has("expired")) {
      const res = NextResponse.next();
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
    return signedIn ? NextResponse.redirect(new URL("/markets", request.url)) : NextResponse.next();
  }
  if (!signedIn) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Members-only pages, plus the sign-in pages (to skip them when already signed in).
  matcher: ["/markets/:path*", "/stock/:path*", "/fno/:path*", "/pulse/:path*", "/signin", "/signup"],
};

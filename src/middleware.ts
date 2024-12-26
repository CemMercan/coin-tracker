import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Kullanıcının oturum durumunu kontrol et
  const isLoggedIn = request.cookies.has("auth_token")
  const isAuthPage = request.nextUrl.pathname === "/"
  const isProtectedRoute = 
    request.nextUrl.pathname.startsWith("/home") || 
    request.nextUrl.pathname.startsWith("/dashboard")

  // Kullanıcı giriş yapmamış ve korumalı sayfaya erişmeye çalışıyorsa
  if (!isLoggedIn && isProtectedRoute) {
    // Kullanıcının geldiği sayfayı kaydet
    const from = request.nextUrl.pathname
    const url = new URL("/", request.url)
    url.searchParams.set("from", from)
    url.searchParams.set("error", "auth_required")
    
    const response = NextResponse.redirect(url)
    response.cookies.delete("auth_token") // Eski token varsa temizle
    
    return response
  }

  // Kullanıcı giriş yapmış ve giriş sayfasına erişmeye çalışıyorsa
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/home", request.url))
  }

  return NextResponse.next()
}

// Hangi yolların middleware tarafından kontrol edileceğini belirt
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
} 
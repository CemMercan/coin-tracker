import { NextResponse } from "next/server"
import type { LoginRequest } from "@/types/user"
import { db } from "@/lib/db"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const body: LoginRequest = await request.json()
    const { username, password, rememberMe } = body

    // Kullanıcı kontrolü
    const isValid = await db.validateUser(username, password)
    if (!isValid) {
      return NextResponse.json(
        { error: "Kullanıcı adı veya şifre hatalı" },
        { status: 401 }
      )
    }

    // Auth token oluştur ve response ile birlikte cookie'yi ayarla
    const response = NextResponse.json({ success: true, username })
    
    // Auth token cookie'sini ayarla
    response.cookies.set("auth_token", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })

    // Eğer "Beni Hatırla" seçeneği işaretlenmişse kullanıcı bilgilerini kaydet
    if (rememberMe) {
      // Güvenlik için şifreyi base64 ile encode ediyoruz
      const encodedPassword = Buffer.from(password).toString('base64')
      
      response.cookies.set("remembered_user", JSON.stringify({
        username,
        password: encodedPassword
      }), {
        httpOnly: false, // Client-side'dan erişilebilmesi için false
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 // 30 gün
      })
    } else {
      // Remember me işaretli değilse, varolan cookie'yi temizle
      response.cookies.delete("remembered_user")
    }

    return response
  } catch (error) {
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    )
  }
} 
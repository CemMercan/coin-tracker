import { NextResponse } from "next/server"

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })
    response.cookies.delete("auth_token")
    return response
  } catch (error) {
    return NextResponse.json(
      { error: "Çıkış yapılırken bir hata oluştu" },
      { status: 500 }
    )
  }
} 
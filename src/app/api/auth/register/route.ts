import { NextResponse } from "next/server"
import type { RegisterRequest } from "@/types/user"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body: RegisterRequest = await request.json()
    const { username, password } = body

    try {
      const newUser = await db.createUser(username, password)
      return NextResponse.json({ success: true, username: newUser.username })
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    )
  }
} 
"use client"

import { LoginForm } from "@/components/auth/login-form"

export default function Home() {
  return (
    <main className="flex flex-col justify-center items-center p-24 min-h-screen">
      <LoginForm />
    </main>
  )
}

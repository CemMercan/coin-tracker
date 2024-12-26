"use client"

import { CoinList } from "@/components/coins/coin-list"
import { Header } from "@/components/layout/header"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <CoinList />
      </main>
    </div>
  )
} 
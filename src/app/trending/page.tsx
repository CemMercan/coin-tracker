"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/layout/header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TrendingCoin {
  item: {
    id: string
    name: string
    symbol: string
    thumb: string
    market_cap_rank: number
    price_btc: number
    score: number
  }
}

export default function TrendingPage() {
  const [trending, setTrending] = useState<TrendingCoin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchTrending()
  }, [])

  const fetchTrending = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        "https://api.coingecko.com/api/v3/search/trending"
      )
      const data = await response.json()
      setTrending(data.coins)
    } catch (error) {
      setError("Veriler yüklenirken bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center">Yükleniyor...</div>
  if (error) return <div className="text-center text-red-500">{error}</div>

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-6">En Çok Aranan Coinler</h1>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Coin</TableHead>
                <TableHead className="text-right">Piyasa Sıralaması</TableHead>
                <TableHead className="text-right">BTC Fiyatı</TableHead>
                <TableHead className="text-right">Popülerlik Skoru</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trending.map((coin, index) => (
                <TableRow key={coin.item.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <img
                        src={coin.item.thumb}
                        alt={coin.item.name}
                        className="w-6 h-6"
                      />
                      <span className="font-medium">{coin.item.name}</span>
                      <span className="text-gray-500 uppercase">
                        {coin.item.symbol}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {coin.item.market_cap_rank || "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    {coin.item.price_btc.toFixed(10)}
                  </TableCell>
                  <TableCell className="text-right">{coin.item.score + 1}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
} 
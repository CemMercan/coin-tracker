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
import { Button } from "@/components/ui/button"
import { LineChart } from "lucide-react"

interface Category {
  id: string
  name: string
  market_cap: number
  volume_24h: number
  top_3_coins: string[]
  market_cap_change_24h: number
  market_cap_change_7d: number
  market_cap_change_1h: number
  coin_count: number
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/categories")
      if (!response.ok) {
        throw new Error("Veriler yüklenirken bir hata oluştu")
      }
      const data = await response.json()
      setCategories(data)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatPercentage = (percent: number) => {
    return (percent || 0).toFixed(1) + "%"
  }

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )

  if (error) return (
    <div className="text-center p-8">
      <p className="text-red-500 mb-4">{error}</p>
      <Button onClick={fetchCategories} variant="outline">
        Tekrar Dene
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">En Çok Kazananlar</TableHead>
                <TableHead className="text-right">1sa</TableHead>
                <TableHead className="text-right">24sa</TableHead>
                <TableHead className="text-right">7g</TableHead>
                <TableHead className="text-right">Piyasa Değeri</TableHead>
                <TableHead className="text-right">24 Saatlik Hacim</TableHead>
                <TableHead className="text-right">Coin sayısı</TableHead>
                <TableHead className="text-right">Son 7 Gün</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category, index) => (
                <TableRow key={category.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">
                    {category.name}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      {category.top_3_coins.map((coin, i) => (
                        <img
                          key={i}
                          src={coin}
                          alt="coin"
                          className="w-6 h-6 rounded-full"
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className={`text-right ${
                    category.market_cap_change_1h > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {formatPercentage(category.market_cap_change_1h)}
                  </TableCell>
                  <TableCell className={`text-right ${
                    category.market_cap_change_24h > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {formatPercentage(category.market_cap_change_24h)}
                  </TableCell>
                  <TableCell className={`text-right ${
                    category.market_cap_change_7d > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {formatPercentage(category.market_cap_change_7d)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(category.market_cap)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(category.volume_24h)}
                  </TableCell>
                  <TableCell className="text-right">
                    {category.coin_count}
                  </TableCell>
                  <TableCell className="text-right">
                    <LineChart className="inline-block h-4 w-4 text-gray-500" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  )
} 
import { NextResponse } from "next/server"

const BASE_URL = 'https://api.coingecko.com/api/v3'

export async function GET() {
  try {
    const response = await fetch(
      `${BASE_URL}/coins/categories?order=market_cap_desc`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 300 }, // 5 dakika cache
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      
      if (response.status === 429) {
        throw new Error("API rate limit aşıldı. Lütfen biraz bekleyin.")
      }
      throw new Error("Veriler yüklenirken bir hata oluştu.")
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Proxy API error:', error)
    return NextResponse.json(
      { error: error.message || 'Veriler yüklenirken bir hata oluştu.' },
      { status: error.status || 500 }
    )
  }
} 
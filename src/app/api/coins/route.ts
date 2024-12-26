import { NextResponse } from "next/server"

const BASE_URL = 'https://api.coincap.io/v2'

// In-memory cache
let cachedData: any = null
let lastFetchTime = 0
const CACHE_DURATION = 2000 // 2 saniye

export async function GET(request: Request) {
  try {
    const now = Date.now()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '25')
    const offset = (page - 1) * perPage

    // Cache'den veri döndür
    if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
      return NextResponse.json(cachedData)
    }

    const response = await fetch(
      `${BASE_URL}/assets?limit=${perPage}&offset=${offset}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      throw new Error("Veriler yüklenirken bir hata oluştu.")
    }

    const { data } = await response.json()
    
    // CoinCap verilerini dönüştür
    const formattedData = data.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: `https://assets.coincap.io/assets/icons/${coin.symbol.toLowerCase()}@2x.png`,
      current_price: Number(parseFloat(coin.priceUsd).toFixed(8)),
      market_cap: Number(parseFloat(coin.marketCapUsd)),
      market_cap_rank: parseInt(coin.rank),
      price_change_percentage_24h: Number(parseFloat(coin.changePercent24Hr).toFixed(2)),
      total_volume: Number(parseFloat(coin.volumeUsd24Hr)),
      last_updated: new Date().toISOString()
    }))
    
    // Cache güncelle
    cachedData = formattedData
    lastFetchTime = now

    return NextResponse.json(formattedData)
  } catch (error: any) {
    console.error('Proxy API error:', error)

    // Hata durumunda cache varsa cache'den döndür
    if (cachedData) {
      console.log('Hata oluştu, cache kullanılıyor')
      return NextResponse.json(cachedData)
    }

    return NextResponse.json(
      { error: error.message || 'Veriler yüklenirken bir hata oluştu.' },
      { status: error.status || 500 }
    )
  }
} 
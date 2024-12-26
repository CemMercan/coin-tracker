"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Star, TrendingUp, TrendingDown, Coins } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Coin {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  price_change_percentage_24h: number
  total_volume: number
  last_updated: string
}

interface PriceChange {
  [key: string]: {
    previousPrice: number;
    flash: 'increase' | 'decrease' | null;
    lastChange?: 'increase' | 'decrease';
    timeout?: NodeJS.Timeout;
  }
}

interface WebSocketPrice {
  [key: string]: {
    price: string;
  }
}

export function CoinList() {
  const [coins, setCoins] = useState<Coin[]>([])
  const [priceChanges, setPriceChanges] = useState<PriceChange>({})
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const perPage = 25
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3
  const retryDelay = 1000 // 1 saniye
  const [autoRefresh, setAutoRefresh] = useState(true)
  const refreshInterval = 10000 // 10 saniye
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const UPDATE_INTERVAL = 5000; // 5 saniye
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [topGainers, setTopGainers] = useState<Coin[]>([])
  const [lastGainersUpdate, setLastGainersUpdate] = useState<Date | null>(null)
  const [topLosers, setTopLosers] = useState<Coin[]>([])
  const [lastLosersUpdate, setLastLosersUpdate] = useState<Date | null>(null)

  // WebSocket bağlantısı için ref kullan
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchCoins = async () => {
    try {
      if (!coins.length) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const response = await fetch(
        `/api/coins?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error("Veriler yüklenirken bir hata oluştu.")
      }

      const data = await response.json()
      if (!Array.isArray(data)) {
        throw new Error("Geçersiz API yanıtı")
      }

      // Mevcut WebSocket fiyatlarını koru
      const updatedData = data.map(newCoin => {
        const existingCoin = coins.find(c => c.id === newCoin.id)
        if (existingCoin) {
          return {
            ...newCoin,
            current_price: existingCoin.current_price
          }
        }
        return newCoin
      })

      // Sayfa 1'den büyükse ve duplicate kontrolü yaparak ekle
      setCoins(prevCoins => {
        if (page === 1) return updatedData

        // Yeni ve mevcut coinleri birleştir
        const combinedCoins = [...prevCoins, ...updatedData]
        
        // Benzersiz coin id'lerine göre filtrele
        const uniqueCoins = Array.from(
          new Map(combinedCoins.map(coin => [coin.id, coin])).values()
        )

        // Market cap rank'e göre sırala
        return uniqueCoins.sort((a, b) => a.market_cap_rank - b.market_cap_rank)
      })

      updatePriceChanges(updatedData)
      setTotalPages(Math.ceil(10000 / perPage))
      setRetryCount(0)
      setError("")
      setLastUpdateTime(new Date())
    } catch (error: any) {
      console.error("API Hatası:", error)
      if (error.message === "Failed to fetch") {
        setError("Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.")
      } else {
        setError(error.message || "Veriler yüklenirken bir hata oluştu.")
      }

      if (retryCount < maxRetries) {
        setRetryCount(count => count + 1)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const connectWebSocket = useCallback(() => {
    try {
      // Eğer aktif bir bağlantı varsa, yeni bağlantı kurma
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('WebSocket zaten bağlı')
        return
      }

      // Varolan bağlantıyı temizle
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      console.log('WebSocket bağlantısı kuruluyor...')
      const ws = new WebSocket('wss://ws.coincap.io/prices?assets=ALL')

      ws.onopen = () => {
        console.log('WebSocket bağlantısı başarılı')
        wsRef.current = ws
        setSocket(ws)
        // İlk verileri al
        fetchCoins()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (!data || typeof data !== 'object') {
            console.log('Geçersiz veri formatı:', event.data)
            return
          }

          setCoins(prevCoins => {
            let hasUpdates = false
            const updatedCoins = prevCoins.map(coin => {
              const coinId = coin.id.toLowerCase()
              const newPrice = data[coinId]
              
              if (newPrice) {
                const parsedPrice = Number(parseFloat(newPrice).toFixed(8))
                if (!isNaN(parsedPrice) && Math.abs(parsedPrice - coin.current_price) > 0.00000001) {
                  hasUpdates = true
                  console.log(`${coin.name}: ${coin.current_price} -> ${parsedPrice}`)
                  
                  // Fiyat değişimini işaretle
                  setPriceChanges(prev => ({
                    ...prev,
                    [coin.id]: {
                      previousPrice: coin.current_price,
                      flash: parsedPrice > coin.current_price ? 'increase' : 'decrease',
                      lastChange: parsedPrice > coin.current_price ? 'increase' : 'decrease'
                    }
                  }))

                  // Flash efektini temizle
                  setTimeout(() => {
                    setPriceChanges(prev => ({
                      ...prev,
                      [coin.id]: { 
                        ...prev[coin.id], 
                        flash: null,
                        lastChange: prev[coin.id]?.lastChange 
                      }
                    }))
                  }, 1000)

                  return {
                    ...coin,
                    current_price: parsedPrice,
                    price_change_percentage_24h: Number(((parsedPrice - coin.current_price) / coin.current_price * 100).toFixed(2))
                  }
                }
              }
              return coin
            })

            if (hasUpdates) {
              setLastUpdateTime(new Date())
              return updatedCoins
            }
            return prevCoins
          })
        } catch (error) {
          console.error('Veri işleme hatası:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket hatası:', error)
        handleReconnect()
      }

      ws.onclose = (event) => {
        console.log('WebSocket bağlantısı kapandı:', event.code, event.reason)
        handleReconnect()
      }

    } catch (error) {
      console.error('WebSocket bağlantı hatası:', error)
      handleReconnect()
    }
  }, [])

  const handleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (autoRefresh) {
      console.log('3 saniye sonra yeniden bağlanılacak...')
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket()
      }, 3000)
    }
  }, [autoRefresh, connectWebSocket])

  // WebSocket bağlantısını yönet
  useEffect(() => {
    if (autoRefresh) {
      connectWebSocket()
    } else {
      // AutoRefresh kapalıysa bağlantıyı kapat
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [autoRefresh, connectWebSocket])

  // İlk yükleme ve sayfa değişiminde verileri getir
  useEffect(() => {
    fetchCoins()
  }, [page])

  // Periyodik güncelleme
  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (autoRefresh && coins.length > 0) {
      intervalId = setInterval(fetchCoins, UPDATE_INTERVAL)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [autoRefresh, page, coins.length])

  const updatePriceChanges = (newCoins: Coin[]) => {
    const changes: PriceChange = { ...priceChanges }
    
    newCoins.forEach(coin => {
      const previous = changes[coin.id]?.previousPrice
      if (previous !== undefined && previous !== coin.current_price) {
        // Önceki flaş efektini temizle
        if (changes[coin.id]?.timeout) {
          clearTimeout(changes[coin.id].timeout)
        }

        // Yeni flaş efektini ayarla
        changes[coin.id] = {
          previousPrice: coin.current_price,
          flash: coin.current_price > previous ? 'increase' : 'decrease',
          timeout: setTimeout(() => {
            setPriceChanges(prev => ({
              ...prev,
              [coin.id]: { ...prev[coin.id], flash: null }
            }))
          }, 1000) // 1 saniye sonra efekti kaldır
        }
      } else {
        changes[coin.id] = {
          previousPrice: coin.current_price,
          flash: null
        }
      }
    })

    setPriceChanges(changes)
  }

  // Yeniden deneme butonu
  const handleRetry = () => {
    setError("")
    setRetryCount(0)
    fetchCoins()
  }

  const filteredCoins = coins.filter(
    (coin) =>
      coin.name.toLowerCase().includes(search.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(search.toLowerCase())
  )

  const formatPrice = (price: number) => {
    if (price >= 1) {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(price)
    } else {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 8,
        maximumFractionDigits: 8
      }).format(price)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("tr-TR").format(num)
  }

  const formatPercentage = (percent: number) => {
    return percent?.toFixed(2) + "%"
  }

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      Object.values(priceChanges).forEach(change => {
        if (change.timeout) {
          clearTimeout(change.timeout)
        }
      })
    }
  }, [])

  // İzleme listesini local storage'a kaydet
  useEffect(() => {
    if (watchlist.length > 0) {
      localStorage.setItem('watchlist', JSON.stringify(watchlist));
    }
  }, [watchlist]);

  // Coin'i izleme listesine ekle/çıkar
  const toggleWatchlist = (coinId: string) => {
    setWatchlist(prev => {
      if (prev.includes(coinId)) {
        return prev.filter(id => id !== coinId)
      }
      return [...prev, coinId]
    })
  }

  // İzleme listesindeki coinler
  const watchlistCoins = coins.filter(coin => watchlist.includes(coin.id))

  // En çok artanları güncelleme fonksiyonu
  const updateTopMovers = useCallback(() => {
    const gainers = coins
      .filter(coin => coin.price_change_percentage_24h > 0)
      .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
      .slice(0, 20);

    const losers = coins
      .filter(coin => coin.price_change_percentage_24h < 0)
      .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
      .slice(0, 20);

    setTopGainers(gainers);
    setTopLosers(losers);
    setLastGainersUpdate(new Date());
    setLastLosersUpdate(new Date());
  }, [coins]);

  // Günlük güncelleme için useEffect
  useEffect(() => {
    updateTopMovers();
    
    // Her 1 dakikada bir güncelle
    const timer = setInterval(() => {
      updateTopMovers();
    }, 60000); // 60 saniye

    return () => clearInterval(timer);
  }, [updateTopMovers]);

  // useEffect ile localStorage işlemlerini yapalım
  useEffect(() => {
    // Local storage'dan izleme listesini al
    const saved = localStorage.getItem('watchlist');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setWatchlist(parsed);
      } catch (error) {
        console.error('Watchlist parsing error:', error);
        setWatchlist([]);
      }
    }
  }, []); // Sadece component mount olduğunda çalışsın

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
  
  if (error) return (
    <div className="text-center p-8">
      <p className="text-red-500 mb-4">{error}</p>
      <Button onClick={handleRetry} variant="outline">
        Tekrar Dene
      </Button>
    </div>
  )

  return (
    <div className="container py-4 md:py-8 mx-auto px-0">
      <div className="px-2 md:px-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-xl p-3 shadow-sm border">
          <div className="relative w-full md:w-[400px]">
            <Input
              placeholder="Coin ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 bg-background/50 border-muted h-11 md:h-12"
            />
            <svg
              className="absolute left-3 top-3 md:top-3.5 h-5 w-5 text-muted-foreground/60"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 bg-background/50 px-4 py-2.5 md:py-3 rounded-lg border-muted border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                  className="md:scale-110"
                />
                <Label htmlFor="auto-refresh" className="text-sm md:text-base font-medium">
                  Canlı Güncelleme
                </Label>
              </div>

              {autoRefresh && (
                <div className="flex items-center gap-2 pl-2 md:pl-3 border-l border-border">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs md:text-sm whitespace-nowrap">
                    <span className="text-green-500 font-medium">
                      {lastUpdateTime?.toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })} - {lastUpdateTime?.toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="all" className="mb-6">
        <TabsList className="grid w-[98%] mx-auto md:w-full grid-cols-4 mb-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            <span className="hidden md:inline">Tüm Coinler</span>
          </TabsTrigger>
          <TabsTrigger value="gainers" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="hidden md:inline">En Çok Artanlar</span>
            {topGainers.length > 0 && (
              <span className="hidden md:inline text-green-500 font-medium">
                ({topGainers.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="losers" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="hidden md:inline">En Çok Azalanlar</span>
            {topLosers.length > 0 && (
              <span className="hidden md:inline text-red-500 font-medium">
                ({topLosers.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-400" />
            <span className="hidden md:inline">İzleme Listesi</span>
            {watchlist.length > 0 && (
              <span className="hidden md:inline">
                <span className="bg-primary/20 px-2 py-0.5 rounded-full text-xs">
                  {watchlist.length}
                </span>
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="rounded-md border overflow-x-auto w-[98%] mx-auto md:w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24px] p-1 md:p-4 sticky left-0 bg-background z-10"></TableHead>
                  <TableHead className="w-[30px] p-1 md:p-4">#</TableHead>
                  <TableHead className="p-1 md:p-4 min-w-[80px] md:min-w-[130px]">Coin</TableHead>
                  <TableHead className="p-1 md:p-4 text-right min-w-[70px] md:min-w-[100px]">Fiyat</TableHead>
                  <TableHead className="p-1 md:p-4 text-right min-w-[60px] md:min-w-[80px]">24s %</TableHead>
                  <TableHead className="p-1 md:p-4 text-right hidden md:table-cell min-w-[130px]">Hacim (24s)</TableHead>
                  <TableHead className="p-1 md:p-4 text-right hidden md:table-cell min-w-[130px]">Piyasa Değeri</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoins.map((coin, index) => (
                  <TableRow 
                    key={`${coin.id}-${index}`}
                    className={`
                      transition-colors duration-300
                      ${priceChanges[coin.id]?.flash === 'increase' ? 'flash-green' : ''}
                      ${priceChanges[coin.id]?.flash === 'decrease' ? 'flash-red' : ''}
                      ${!priceChanges[coin.id]?.flash && priceChanges[coin.id]?.lastChange === 'increase' ? 'bg-green-50 dark:bg-green-950/20' : ''}
                      ${!priceChanges[coin.id]?.flash && priceChanges[coin.id]?.lastChange === 'decrease' ? 'bg-red-50 dark:bg-red-950/20' : ''}
                    `}
                  >
                    <TableCell className="p-1 md:p-4 sticky left-0 bg-background z-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 md:h-8 md:w-8"
                        onClick={() => toggleWatchlist(coin.id)}
                      >
                        <Star 
                          className={`h-3 w-3 md:h-4 md:w-4 ${
                            watchlist.includes(coin.id) 
                              ? "fill-yellow-400 text-yellow-400" 
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-sm md:text-base font-medium w-[30px] md:w-[50px]">
                      {coin.market_cap_rank}
                    </TableCell>
                    <TableCell className="p-1 md:p-4">
                      <div className="flex gap-1 md:gap-2 items-center min-w-[80px] md:min-w-[120px]">
                        <img
                          src={coin.image}
                          alt={coin.name}
                          className="w-4 h-4 md:w-6 md:h-6"
                        />
                        <span className="font-medium hidden md:inline">{coin.name}</span>
                        <span className="font-medium text-xs md:text-base md:hidden">{coin.symbol.toUpperCase()}</span>
                        <span className="text-muted-foreground text-xs md:text-sm uppercase hidden md:inline">
                          {coin.symbol}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap min-w-[70px] md:min-w-[100px]">
                      {formatPrice(coin.current_price)}
                    </TableCell>
                    <TableCell
                      className={`p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap min-w-[60px] md:min-w-[80px] ${
                        coin.price_change_percentage_24h > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatPercentage(coin.price_change_percentage_24h)}
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap hidden md:table-cell min-w-[130px]">
                      {formatPrice(coin.total_volume)}
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap hidden md:table-cell min-w-[130px]">
                      {formatPrice(coin.market_cap)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loadingMore}
              className="w-full max-w-[200px] bg-primary/5 hover:bg-primary/10"
            >
              {page === totalPages ? (
                "Tümü gösteriliyor"
              ) : loadingMore ? (
                <div className="flex items-center gap-2">
                  Yükleniyor
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              ) : (
                "Daha fazla"
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="gainers">
          <div className="px-2 md:px-0">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4 mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-semibold">Günün En Çok Artış Gösteren Coinleri</h2>
                <span className="text-green-500 font-medium">({topGainers.length})</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Son güncelleme: {lastGainersUpdate?.toLocaleTimeString('tr-TR')}
              </div>
            </div>
          </div>
          <div className="rounded-md border overflow-x-auto w-[98%] mx-auto md:w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24px] p-1 md:p-4 sticky left-0 bg-background z-10"></TableHead>
                  <TableHead className="w-[30px] p-1 md:p-4">#</TableHead>
                  <TableHead className="p-1 md:p-4 min-w-[80px] md:min-w-[130px]">Coin</TableHead>
                  <TableHead className="p-1 md:p-4 text-right min-w-[70px] md:min-w-[100px]">Fiyat</TableHead>
                  <TableHead className="p-1 md:p-4 text-right min-w-[60px] md:min-w-[80px]">24s %</TableHead>
                  <TableHead className="p-1 md:p-4 text-right hidden md:table-cell min-w-[130px]">Hacim (24s)</TableHead>
                  <TableHead className="p-1 md:p-4 text-right hidden md:table-cell min-w-[130px]">Piyasa Değeri</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topGainers.map((coin, index) => (
                  <TableRow 
                    key={`${coin.id}-${index}`}
                    className={`
                      transition-colors duration-300
                      ${priceChanges[coin.id]?.flash === 'increase' ? 'flash-green' : ''}
                      ${priceChanges[coin.id]?.flash === 'decrease' ? 'flash-red' : ''}
                      ${!priceChanges[coin.id]?.flash && priceChanges[coin.id]?.lastChange === 'increase' ? 'bg-green-50 dark:bg-green-950/20' : ''}
                      ${!priceChanges[coin.id]?.flash && priceChanges[coin.id]?.lastChange === 'decrease' ? 'bg-red-50 dark:bg-red-950/20' : ''}
                    `}
                  >
                    <TableCell className="p-1 md:p-4 sticky left-0 bg-background z-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 md:h-8 md:w-8"
                        onClick={() => toggleWatchlist(coin.id)}
                      >
                        <Star 
                          className={`h-3 w-3 md:h-4 md:w-4 ${
                            watchlist.includes(coin.id) 
                              ? "fill-yellow-400 text-yellow-400" 
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-sm md:text-base font-medium w-[30px] md:w-[50px]">
                      {coin.market_cap_rank}
                    </TableCell>
                    <TableCell className="p-1 md:p-4">
                      <div className="flex gap-1 md:gap-2 items-center min-w-[80px] md:min-w-[120px]">
                        <img
                          src={coin.image}
                          alt={coin.name}
                          className="w-4 h-4 md:w-6 md:h-6"
                        />
                        <span className="font-medium hidden md:inline">{coin.name}</span>
                        <span className="font-medium text-xs md:text-base md:hidden">{coin.symbol.toUpperCase()}</span>
                        <span className="text-muted-foreground text-xs md:text-sm uppercase hidden md:inline">
                          {coin.symbol}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap min-w-[70px] md:min-w-[100px]">
                      {formatPrice(coin.current_price)}
                    </TableCell>
                    <TableCell
                      className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap min-w-[60px] md:min-w-[80px] text-green-600"
                    >
                      +{formatPercentage(coin.price_change_percentage_24h)}
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap hidden md:table-cell min-w-[130px]">
                      {formatPrice(coin.total_volume)}
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap hidden md:table-cell min-w-[130px]">
                      {formatPrice(coin.market_cap)}
                    </TableCell>
                  </TableRow>
                ))}
                {topGainers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Henüz artış gösteren coin bulunmuyor.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="losers">
          <div className="px-2 md:px-0">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-4 mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-semibold">Günün En Çok Düşüş Gösteren Coinleri</h2>
                <span className="text-red-500 font-medium">({topLosers.length})</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Son güncelleme: {lastLosersUpdate?.toLocaleTimeString('tr-TR')}
              </div>
            </div>
          </div>
          <div className="rounded-md border overflow-x-auto w-[98%] mx-auto md:w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24px] p-1 md:p-4 sticky left-0 bg-background z-10"></TableHead>
                  <TableHead className="w-[30px] p-1 md:p-4">#</TableHead>
                  <TableHead className="p-1 md:p-4 min-w-[80px] md:min-w-[130px]">Coin</TableHead>
                  <TableHead className="p-1 md:p-4 text-right min-w-[70px] md:min-w-[100px]">Fiyat</TableHead>
                  <TableHead className="p-1 md:p-4 text-right min-w-[60px] md:min-w-[80px]">24s %</TableHead>
                  <TableHead className="p-1 md:p-4 text-right hidden md:table-cell min-w-[130px]">Hacim (24s)</TableHead>
                  <TableHead className="p-1 md:p-4 text-right hidden md:table-cell min-w-[130px]">Piyasa Değeri</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLosers.map((coin, index) => (
                  <TableRow 
                    key={`${coin.id}-${index}`}
                    className={`
                      transition-colors duration-300
                      ${priceChanges[coin.id]?.flash === 'increase' ? 'flash-green' : ''}
                      ${priceChanges[coin.id]?.flash === 'decrease' ? 'flash-red' : ''}
                      ${!priceChanges[coin.id]?.flash && priceChanges[coin.id]?.lastChange === 'increase' ? 'bg-green-50 dark:bg-green-950/20' : ''}
                      ${!priceChanges[coin.id]?.flash && priceChanges[coin.id]?.lastChange === 'decrease' ? 'bg-red-50 dark:bg-red-950/20' : ''}
                    `}
                  >
                    <TableCell className="p-1 md:p-4 sticky left-0 bg-background z-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 md:h-8 md:w-8"
                        onClick={() => toggleWatchlist(coin.id)}
                      >
                        <Star 
                          className={`h-3 w-3 md:h-4 md:w-4 ${
                            watchlist.includes(coin.id) 
                              ? "fill-yellow-400 text-yellow-400" 
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-sm md:text-base font-medium w-[30px] md:w-[50px]">
                      {coin.market_cap_rank}
                    </TableCell>
                    <TableCell className="p-1 md:p-4">
                      <div className="flex gap-1 md:gap-2 items-center min-w-[80px] md:min-w-[120px]">
                        <img
                          src={coin.image}
                          alt={coin.name}
                          className="w-4 h-4 md:w-6 md:h-6"
                        />
                        <span className="font-medium hidden md:inline">{coin.name}</span>
                        <span className="font-medium text-xs md:text-base md:hidden">{coin.symbol.toUpperCase()}</span>
                        <span className="text-muted-foreground text-xs md:text-sm uppercase hidden md:inline">
                          {coin.symbol}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap min-w-[70px] md:min-w-[100px]">
                      {formatPrice(coin.current_price)}
                    </TableCell>
                    <TableCell
                      className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap min-w-[60px] md:min-w-[80px] text-red-600"
                    >
                      {formatPercentage(coin.price_change_percentage_24h)}
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap hidden md:table-cell min-w-[130px]">
                      {formatPrice(coin.total_volume)}
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap hidden md:table-cell min-w-[130px]">
                      {formatPrice(coin.market_cap)}
                    </TableCell>
                  </TableRow>
                ))}
                {topLosers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Henüz düşüş gösteren coin bulunmuyor.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="watchlist">
          <div className="rounded-md border overflow-x-auto w-[98%] mx-auto md:w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24px] p-1 md:p-4 sticky left-0 bg-background z-10"></TableHead>
                  <TableHead className="w-[30px] p-1 md:p-4">#</TableHead>
                  <TableHead className="p-1 md:p-4">Coin</TableHead>
                  <TableHead className="p-1 md:p-4 text-right">Fiyat</TableHead>
                  <TableHead className="p-1 md:p-4 text-right">24s %</TableHead>
                  <TableHead className="p-1 md:p-4 text-right hidden md:table-cell">Hacim (24s)</TableHead>
                  <TableHead className="p-1 md:p-4 text-right hidden md:table-cell">Piyasa Değeri</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlistCoins.map((coin, index) => (
                  <TableRow key={`${coin.id}-${index}`} className={`
                    transition-colors duration-300
                    ${priceChanges[coin.id]?.flash === 'increase' ? 'flash-green' : ''}
                    ${priceChanges[coin.id]?.flash === 'decrease' ? 'flash-red' : ''}
                    ${!priceChanges[coin.id]?.flash && priceChanges[coin.id]?.lastChange === 'increase' ? 'bg-green-50 dark:bg-green-950/20' : ''}
                    ${!priceChanges[coin.id]?.flash && priceChanges[coin.id]?.lastChange === 'decrease' ? 'bg-red-50 dark:bg-red-950/20' : ''}
                  `}>
                    <TableCell className="p-1 md:p-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 md:h-8 md:w-8"
                        onClick={() => toggleWatchlist(coin.id)}
                      >
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </Button>
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-sm md:text-base font-medium w-[30px] md:w-[50px]">
                      {coin.market_cap_rank}
                    </TableCell>
                    <TableCell className="p-1 md:p-4">
                      <div className="flex gap-1 md:gap-2 items-center min-w-[80px] md:min-w-[120px]">
                        <img
                          src={coin.image}
                          alt={coin.name}
                          className="w-4 h-4 md:w-6 md:h-6"
                        />
                        <span className="font-medium hidden md:inline">{coin.name}</span>
                        <span className="font-medium text-xs md:text-base md:hidden">{coin.symbol.toUpperCase()}</span>
                        <span className="text-muted-foreground text-xs md:text-sm uppercase hidden md:inline">
                          {coin.symbol}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap min-w-[70px] md:min-w-[100px]">
                      {formatPrice(coin.current_price)}
                    </TableCell>
                    <TableCell
                      className={`p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap min-w-[60px] md:min-w-[80px] ${
                        coin.price_change_percentage_24h > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatPercentage(coin.price_change_percentage_24h)}
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap hidden md:table-cell min-w-[130px]">
                      {formatPrice(coin.total_volume)}
                    </TableCell>
                    <TableCell className="p-1 md:p-4 text-right text-xs md:text-base whitespace-nowrap hidden md:table-cell min-w-[130px]">
                      {formatPrice(coin.market_cap)}
                    </TableCell>
                  </TableRow>
                ))}
                {watchlistCoins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      İzleme listeniz boş. Coin'lerin yanındaki yıldız ikonuna tıklayarak izleme listesine ekleyebilirsiniz.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
} 
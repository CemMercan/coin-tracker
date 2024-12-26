"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Checkbox } from "@/components/ui/checkbox"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    // Kayıtlı kullanıcı bilgilerini kontrol et
    const rememberedUser = document.cookie
      .split("; ")
      .find(row => row.startsWith("remembered_user="))
    
    if (rememberedUser) {
      try {
        const { username: savedUsername, password: encodedPassword } = JSON.parse(decodeURIComponent(rememberedUser.split("=")[1]))
        const decodedPassword = atob(encodedPassword)
        setUsername(savedUsername)
        setPassword(decodedPassword)
        setRememberMe(true)
      } catch (error) {
        console.error("Kayıtlı kullanıcı bilgileri okunamadı:", error)
      }
    }
  }, [])

  const handleLogin = async () => {
    if (!username || !password) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Kullanıcı adı ve şifre alanları boş bırakılamaz.",
      })
      return
    }

    try {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password, rememberMe }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Giriş yapılamadı")
      }

      // Başarılı giriş sonrası yönlendirme
      const from = searchParams.get("from") || "/home"
      toast({
        title: "Başarılı",
        description: "Giriş başarıyla yapıldı, yönlendiriliyorsunuz...",
      })
      router.push(from)
    } catch (error: any) {
      setError(error.message || "Bir hata oluştu")
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Bir hata oluştu",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!username || !password) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Kullanıcı adı ve şifre alanları boş bırakılamaz.",
      })
      return
    }

    try {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Kayıt yapılamadı")
      }

      toast({
        title: "Başarılı",
        description: "Kayıt başarıyla tamamlandı, giriş yapılıyor...",
      })

      // Başarılı kayıt sonrası otomatik giriş yap
      await handleLogin()
    } catch (error: any) {
      setError(error.message || "Bir hata oluştu")
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Bir hata oluştu",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Giriş Yap</CardTitle>
        <CardDescription>
          Hesabınıza giriş yapmak için bilgilerinizi giriniz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 items-center w-full">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="username">Kullanıcı Adı</Label>
            <Input
              id="username"
              placeholder="Kullanıcı adınızı giriniz"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              type="password"
              placeholder="Şifrenizi giriniz"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="rememberMe" 
              checked={rememberMe}
              onCheckedChange={(checked: boolean) => setRememberMe(checked)}
            />
            <Label 
              htmlFor="rememberMe" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Beni Hatırla
            </Label>
          </div>
          {error && (
            <p className="text-sm text-center text-red-500">{error}</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button
          className="w-full"
          onClick={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? "Kayıt Yapılıyor..." : "Kayıt Ol"}
        </Button>
      </CardFooter>
    </Card>
  )
} 
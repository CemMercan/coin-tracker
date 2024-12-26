"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Star, TrendingUp, Grid2X2, Flame, Menu } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/components/ui/use-toast"
import { ThemeToggle } from "@/components/theme-toggle"

const menuItems = [
  {
    title: "Tümü",
    icon: Star,
    href: "/home",
  },
  {
    title: "Vurgunlar",
    icon: TrendingUp,
    href: "/trending",
  },
  {
    title: "Kategoriler",
    icon: Grid2X2,
    href: "/categories",
  },
  {
    title: "Virtuals Protocol Ecosystem",
    icon: Flame,
    href: "/virtuals",
  },
  {
    title: "AI Agent Launchpad",
    icon: Flame,
    href: "/ai-agent",
  },
  {
    title: "Terminal of Truths",
    icon: Flame,
    href: "/terminal",
  },
]

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Çıkış yapılırken bir hata oluştu")
      }

      toast({
        title: "Başarılı",
        description: "Başarıyla çıkış yapıldı, yönlendiriliyorsunuz...",
      })

      router.push("/")
    } catch (error) {
      console.error("Çıkış yapılırken hata:", error)
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Çıkış yapılırken bir hata oluştu.",
      })
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex gap-1 md:gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="gap-2"
                asChild
              >
                <Link href={item.href}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline-block">{item.title}</span>
                </Link>
              </Button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
} 
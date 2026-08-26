"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  Smile, 
  BookOpen, 
  Moon, 
  LineChart, 
  Brain, 
  Award, 
  MessageSquare, 
  Settings, 
  LogOut,
  User
} from "lucide-react"

interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<any>
}

const menuItems: SidebarItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Daily Check-In", href: "/dashboard/check-in", icon: Smile },
  { name: "AI Journal", href: "/dashboard/journal", icon: BookOpen },
  { name: "Sleep Tracker", href: "/dashboard/sleep", icon: Moon },
  { name: "Insights & Forecast", href: "/dashboard/insights", icon: LineChart },
  { name: "Digital Twin", href: "/dashboard/digital-twin", icon: Brain },
  { name: "Recommendations", href: "/dashboard/recommendations", icon: Award },
  { name: "AI Companion", href: "/dashboard/companion", icon: MessageSquare },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState("User")
  
  useEffect(() => {
    // Check if token exists in localStorage (simple auth gate)
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
      return
    }
    
    // Fetch user name
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/auth/me", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })
        if (res.status === 200) {
          const data = await res.json()
          setUserName(data.name)
        } else {
          // Token might have expired
          localStorage.removeItem("token")
          router.push("/login")
        }
      } catch (err) {
        console.error("Auth fetch failed:", err)
      }
    }
    fetchUser()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("token")
    router.push("/login")
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200 flex items-center gap-2">
          <Brain className="w-8 h-8 text-blue-600" />
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            SoulSync
          </span>
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        {/* Profile Footer */}
        <div className="p-4 border-t border-gray-200 flex flex-col gap-2">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              {userName[0]}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">SoulSync Member</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 text-red-500" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header (Mobile menu etc.) */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-800">
              {menuItems.find(item => pathname === item.href)?.name || "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">Tagline: Understand your patterns. Sync with yourself.</span>
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 md:hidden">
              <User className="w-5 h-5" />
            </div>
          </div>
        </header>

        {/* Page children */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

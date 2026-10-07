"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
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
  Sparkles,
  HeartHandshake,
  CalendarCheck,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import { getInitials } from "@/lib/formatters"
import ThemeToggle from "@/components/layout/ThemeToggle"

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const menuItems: NavItem[] = [
  { name: "Dashboard",          href: "/dashboard",                 icon: LayoutDashboard },
  { name: "Daily Check-In",     href: "/dashboard/check-in",        icon: Smile },
  { name: "AI Journal",         href: "/dashboard/journal",         icon: BookOpen },
  { name: "Sleep Tracker",      href: "/dashboard/sleep",           icon: Moon },
  { name: "Dream Analyzer",     href: "/dashboard/dreams",          icon: Sparkles },
  { name: "Digital Twin",       href: "/dashboard/digital-twin",    icon: Brain },
  { name: "Insights",           href: "/dashboard/insights",        icon: LineChart },
  { name: "Recommendations",    href: "/dashboard/recommendations", icon: Award },
  { name: "AI Companion",       href: "/dashboard/companion",       icon: MessageSquare },
  { name: "Digital Therapist",  href: "/dashboard/therapist",       icon: HeartHandshake },
  { name: "Book Doctor",        href: "/dashboard/appointments",    icon: CalendarCheck },
  { name: "Settings",           href: "/dashboard/settings",        icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const userName = user?.name || "User"

  return (
    <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center shadow-glow-sm">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gradient-primary">
            SoulSync
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                text-sm font-medium transition-all duration-200
                ${isActive
                  ? "text-soul-purple bg-soul-purple/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-soul-purple"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className={`w-[18px] h-[18px] ${isActive ? "text-soul-purple" : ""}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        {/* Theme Toggle */}
        <div className="px-3 py-2">
          <ThemeToggle />
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center text-white text-xs font-bold">
            {getInitials(userName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
            <p className="text-[11px] text-muted-foreground truncate">SoulSync Member</p>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export { menuItems }

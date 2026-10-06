"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Smile,
  BookOpen,
  Moon,
  MessageSquare,
} from "lucide-react"

const mobileItems = [
  { name: "Home",     href: "/dashboard",          icon: LayoutDashboard },
  { name: "Check-In", href: "/dashboard/check-in",  icon: Smile },
  { name: "Journal",  href: "/dashboard/journal",   icon: BookOpen },
  { name: "Sleep",    href: "/dashboard/sleep",     icon: Moon },
  { name: "Chat",     href: "/dashboard/companion", icon: MessageSquare },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border">
      <div className="flex items-center justify-around py-2 px-1">
        {mobileItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg
                transition-colors duration-200 min-w-[56px]
                ${isActive
                  ? "text-soul-purple"
                  : "text-muted-foreground"
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-soul-purple mt-0.5" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

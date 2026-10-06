"use client"

import React from "react"
import { usePathname } from "next/navigation"
import Sidebar, { menuItems } from "@/components/layout/Sidebar"
import MobileNav from "@/components/layout/MobileNav"
import PageTransition from "@/components/layout/PageTransition"
import { useAuth } from "@/context/AuthContext"
import { redirect } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading skeleton while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-64 bg-card border-r border-border hidden md:block" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-soul-purple to-soul-teal animate-pulse-glow" />
            <p className="text-sm text-muted-foreground">Syncing your data...</p>
          </div>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    redirect("/login")
  }

  const currentPage = menuItems.find((item) => pathname === item.href)?.name || "Dashboard"

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-card/50 glass border-b border-border flex items-center justify-between px-6 shrink-0">
          <h1 className="text-base font-semibold text-foreground">{currentPage}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Understand your patterns. Sync with yourself.
          </p>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  )
}

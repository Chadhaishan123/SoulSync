import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "SoulSync — Understand your patterns. Sync with yourself.",
  description: "AI-powered mental wellness platform that matches daily wellness metrics with context-aware patterns to generate a personalized Digital Twin.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}

import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { AuthProvider } from "@/context/AuthContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { Toaster } from "react-hot-toast"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "SoulSync — Understand your patterns. Sync with yourself.",
  description:
    "AI-powered mental wellness platform that analyzes mood, sleep, stress, energy, journaling, and environmental context to detect patterns, generate insights, predict trends, and build a personalized behavioral Digital Twin.",
  keywords: [
    "mental wellness",
    "mood tracking",
    "AI companion",
    "digital twin",
    "behavioral analytics",
    "NLP journal",
    "sleep tracking",
  ],
  openGraph: {
    title: "SoulSync — AI-Powered Mental Wellness",
    description: "Understand your patterns. Sync with yourself.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "hsl(240 18% 8%)",
                  color: "hsl(240 10% 92%)",
                  border: "1px solid hsl(256 40% 20%)",
                  borderRadius: "12px",
                  fontSize: "14px",
                },
                success: {
                  iconTheme: {
                    primary: "#00d4aa",
                    secondary: "hsl(240 18% 8%)",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "#ff6b8a",
                    secondary: "hsl(240 18% 8%)",
                  },
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

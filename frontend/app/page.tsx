import Link from "next/link"
import { Brain, Sparkles, LineChart, Shield, ShieldCheck } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="bg-gradient-to-b from-blue-50 to-white min-h-screen flex flex-col justify-between">
      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Brain className="w-8 h-8 text-blue-600" />
          <span className="text-2xl font-bold text-gray-900">SoulSync</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2 transition-colors">
            Login
          </Link>
          <Link href="/register" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto w-full px-6 py-12 md:py-20 flex-1 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
            <Sparkles className="w-4 h-4" />
            AI-Powered Mental Wellness Twin
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight">
            Understand your patterns. <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Sync with yourself.
            </span>
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
            SoulSync tracks your daily mood, sleep, stress, energy, journal entries, and local weather patterns to build a dynamic digital twin of your personal wellness trends. No diagnostic labels, just actionable self-reflection.
          </p>
          <div className="flex gap-4 pt-4">
            <Link href="/register" className="bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold px-6 py-3 rounded-lg shadow-md transition-colors">
              Start Free Today
            </Link>
            <Link href="/login" className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 text-lg font-semibold px-6 py-3 rounded-lg shadow-sm transition-colors">
              Explore Demo
            </Link>
          </div>
        </div>

        {/* Feature Grid Graphic */}
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 grid gap-6">
          <div className="flex gap-4 items-start">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">SoulSync Digital Twin</h3>
              <p className="text-sm text-gray-500">A dynamic reflection profile clustering behavioral trends, identifying anomalies, and charting correlations.</p>
            </div>
          </div>
          
          <div className="flex gap-4 items-start border-t border-gray-100 pt-6">
            <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Emotional Weather Forecast</h3>
              <p className="text-sm text-gray-500">Visual representations of daily fluctuations (☀️ Stable, ☁️ High Stress, 🌧️ Difficult Period) instead of dry numbers.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start border-t border-gray-100 pt-6">
            <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
              <LineChart className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Pattern Explorer</h3>
              <p className="text-sm text-gray-500">Interactively compare variables like sleep hours versus mood ratings to discover what parameters affect your day.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Safety Notice Banner */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2 text-amber-600 font-medium">
            <ShieldCheck className="w-4 h-4" />
            Disclaimer: SoulSync is a wellness and self-reflection tracker, not a medical or diagnostic service.
          </div>
          <p>© 2026 SoulSync Platforms. Built with Advanced Agentic Coding.</p>
        </div>
      </footer>
    </div>
  )
}

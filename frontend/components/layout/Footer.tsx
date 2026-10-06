"use client"

import React from "react"
import Link from "next/link"
import { Brain, ShieldCheck, Heart } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gradient-primary">SoulSync</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              AI-powered mental wellness platform that tracks your daily metrics,
              detects behavioral patterns, and builds a personalized Digital Twin
              of your wellness trends.
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Product</h4>
            <div className="space-y-2">
              <Link href="#features" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link href="#how-it-works" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</Link>
              <Link href="#ai" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">AI & ML</Link>
              <Link href="/register" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Get Started</Link>
            </div>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <div className="space-y-2">
              <span className="block text-sm text-muted-foreground">Privacy Policy</span>
              <span className="block text-sm text-muted-foreground">Terms of Service</span>
              <span className="block text-sm text-muted-foreground">Data Rights</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-amber-500/80">
            <ShieldCheck className="w-4 h-4" />
            <span>SoulSync is a wellness tracker, not a medical or diagnostic service.</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            © {new Date().getFullYear()} SoulSync Platforms. Built with
            <Heart className="w-3 h-3 text-soul-coral" />
            & Advanced Agentic Coding.
          </p>
        </div>
      </div>
    </footer>
  )
}

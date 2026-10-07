"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Brain, ArrowRight, Mail, Lock } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import toast from "react-hot-toast"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("soulsync_last_user")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.email) setEmail(parsed.email)
      }
    } catch {}
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(email, password)
      toast.success("Welcome back!")
      router.push("/dashboard")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid email or password"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-soul-purple/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-soul-teal/6 rounded-full blur-[100px]" />
      </div>

      {/* Floating Orbs */}
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[20%] w-3 h-3 rounded-full bg-soul-purple/30"
      />
      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        className="absolute bottom-32 right-[25%] w-2 h-2 rounded-full bg-soul-teal/40"
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md glass rounded-2xl p-8 space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-flex">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center shadow-glow mx-auto"
            >
              <Brain className="w-7 h-7 text-white" />
            </motion.div>
          </Link>
          <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
          <p className="text-sm text-muted-foreground">Log in to sync with your patterns.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            icon={<Mail className="w-4 h-4" />}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            icon={<Lock className="w-4 h-4" />}
          />

          <div className="flex justify-end -mt-1">
            <Link
              href="/forgot-password"
              className="text-xs text-soul-purple hover:text-soul-purple-light transition-colors font-medium hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            isLoading={loading}
            className="w-full"
            size="lg"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Log In
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-soul-purple hover:text-soul-purple-light font-semibold transition-colors">
            Register here
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

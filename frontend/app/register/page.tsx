"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Brain, ArrowRight, Mail, Lock, User } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import PasswordStrength from "@/components/features/PasswordStrength"
import toast from "react-hot-toast"

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    if (!/[A-Z]/.test(password)) {
      toast.error("Password must include at least one uppercase letter")
      return
    }
    if (!/[a-z]/.test(password)) {
      toast.error("Password must include at least one lowercase letter")
      return
    }
    if (!/[0-9]/.test(password)) {
      toast.error("Password must include at least one number")
      return
    }
    setLoading(true)

    try {
      await register(name, email, password)
      toast.success("Account created! Welcome to SoulSync 🧠")
      router.push("/onboarding")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-soul-teal/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-soul-purple/6 rounded-full blur-[100px]" />
      </div>

      {/* Floating Orbs */}
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-32 right-[20%] w-3 h-3 rounded-full bg-soul-teal/30"
      />
      <motion.div
        animate={{ y: [0, 12, 0], x: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-20 left-[15%] w-2 h-2 rounded-full bg-soul-purple/40"
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
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-soul-teal to-soul-purple flex items-center justify-center shadow-glow-accent mx-auto"
            >
              <Brain className="w-7 h-7 text-white" />
            </motion.div>
          </Link>
          <h2 className="text-2xl font-bold text-foreground">Create Your Account</h2>
          <p className="text-sm text-muted-foreground">Start building your Digital Twin today.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
            icon={<User className="w-4 h-4" />}
          />

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            icon={<Mail className="w-4 h-4" />}
          />

          <div className="space-y-1">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Create a password"
              icon={<Lock className="w-4 h-4" />}
              hint="At least 8 chars with uppercase, lowercase & number"
            />
            <PasswordStrength password={password} />
          </div>

          <Button
            type="submit"
            isLoading={loading}
            className="w-full"
            size="lg"
            variant="accent"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Create Account
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-soul-teal hover:text-soul-teal-light font-semibold transition-colors">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

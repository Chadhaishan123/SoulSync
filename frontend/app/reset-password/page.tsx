"use client"

import React, { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Brain, Lock, ArrowRight, CheckCircle2, KeyRound } from "lucide-react"
import { api } from "@/lib/api"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import toast from "react-hot-toast"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenFromUrl = searchParams.get("token") || ""

  const [token, setToken] = useState(tokenFromUrl)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token.trim()) {
      toast.error("Password reset token is required")
      return
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      await api.auth.resetPassword(token.trim(), password)
      setSuccess(true)
      toast.success("Password reset successfully! 🎉")
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-soul-purple/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-soul-teal/6 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md glass rounded-2xl p-8 space-y-6"
      >
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center shadow-glow mx-auto">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Set New Password</h2>
          <p className="text-sm text-muted-foreground">
            Enter your new secure password below to regain access to your account.
          </p>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!tokenFromUrl && (
              <Input
                label="Reset Token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                placeholder="Paste token from reset link"
              />
            )}

            <Input
              label="New Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="At least 8 characters"
              icon={<Lock className="w-4 h-4" />}
            />

            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm new password"
              icon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              isLoading={loading}
              className="w-full"
              size="lg"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Reset Password
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Password Successfully Updated</p>
              <p className="text-xs text-muted-foreground">
                Redirecting you to the login page in a moment...
              </p>
            </div>
            <Link href="/login">
              <Button variant="primary" className="w-full">
                Log In Now
              </Button>
            </Link>
          </div>
        )}

        <div className="text-center pt-2">
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Remember your credentials? Log In
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading reset page...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}

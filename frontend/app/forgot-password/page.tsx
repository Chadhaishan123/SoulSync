"use client"

import React, { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Brain, ArrowLeft, Mail, Send, CheckCircle2, KeyRound, ExternalLink } from "lucide-react"
import { api } from "@/lib/api"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Card from "@/components/ui/Card"
import toast from "react-hot-toast"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [resetLink, setResetLink] = useState<string | null>(null)
  const [responseDetail, setResponseDetail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error("Please enter your registered email address")
      return
    }

    setLoading(true)
    try {
      const res = await api.auth.forgotPassword(email.trim())
      setResponseDetail(res.detail)
      if (res.reset_link) {
        setResetLink(res.reset_link)
      } else if (res.dev_token) {
        setResetLink(`/reset-password?token=${res.dev_token}`)
      }
      setSubmitted(true)
      toast.success("Password reset request processed! 📬")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to process request")
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
        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/login" className="inline-flex">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center shadow-glow mx-auto"
            >
              <KeyRound className="w-7 h-7 text-white" />
            </motion.div>
          </Link>
          <h2 className="text-2xl font-bold text-foreground">Forgot Password</h2>
          <p className="text-sm text-muted-foreground">
            Enter your registered email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Registered Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              icon={<Mail className="w-4 h-4" />}
            />

            <Button
              type="submit"
              isLoading={loading}
              className="w-full"
              size="lg"
              icon={<Send className="w-4 h-4" />}
            >
              Send Reset Link
            </Button>
          </form>
        ) : (
          <div className="space-y-5 text-center">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Reset Link Dispatched</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If an account exists for <strong className="text-foreground">{email}</strong>, a password reset link has been sent. Please check your inbox and spam folder.
              </p>
            </div>

            {/* Direct preview link for convenience */}
            {resetLink && (
              <div className="p-3.5 rounded-xl bg-soul-purple/10 border border-soul-purple/30 text-left space-y-2">
                <span className="text-[11px] font-bold text-soul-purple uppercase tracking-wider block">
                  Direct Reset Access:
                </span>
                <p className="text-xs text-muted-foreground">
                  You can proceed directly using the link below:
                </p>
                <Link
                  href={resetLink.startsWith("http") ? new URL(resetLink).pathname + new URL(resetLink).search : resetLink}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-soul-purple hover:underline"
                >
                  Proceed to Reset Password <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setSubmitted(false)
                setEmail("")
                setResetLink(null)
              }}
            >
              Try Another Email
            </Button>
          </div>
        )}

        {/* Back to Login */}
        <div className="text-center pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Log In
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

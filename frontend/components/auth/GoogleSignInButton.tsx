"use client"

import React, { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import toast from "react-hot-toast"
import { motion, AnimatePresence } from "framer-motion"
import { ExternalLink, Check, Copy, AlertCircle, X, Sparkles } from "lucide-react"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          prompt: (momentListener?: (notification: any) => void) => void
          renderButton: (parent: HTMLElement, options: any) => void
          cancel: () => void
        }
      }
    }
  }
}

interface GoogleSignInButtonProps {
  label?: string
  className?: string
}

export default function GoogleSignInButton({
  label = "Continue with Google",
  className = "",
}: GoogleSignInButtonProps) {
  const router = useRouter()
  const { loginWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const googleBtnContainerRef = useRef<HTMLDivElement>(null)

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

  useEffect(() => {
    // If client ID is present, load Google Identity Services script
    if (!clientId) return

    if (document.getElementById("google-gsi-client")) return

    const script = document.createElement("script")
    script.id = "google-gsi-client"
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          })

          if (googleBtnContainerRef.current) {
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              theme: "filled_blue",
              size: "large",
              text: "continue_with",
              shape: "pill",
              width: "100%",
            })
          }
        }
      } catch (err) {
        console.error("Failed to initialize Google Sign-In:", err)
      }
    }
    document.body.appendChild(script)
  }, [clientId])

  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response?.credential) {
      toast.error("Google Sign-In was cancelled or failed.")
      return
    }

    setLoading(true)
    try {
      await loginWithGoogle(response.credential)
      toast.success("Signed in with Google! Welcome 🧠")
      router.push("/dashboard")
    } catch (err: any) {
      console.error("Backend Google Auth Error:", err)
      const msg = err?.message || "Google sign-in failed on server"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleClick = () => {
    if (!clientId) {
      setShowConfigModal(true)
      return
    }

    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // If one-tap prompt couldn't display, trigger fallback or click rendered button
            const renderedBtn = googleBtnContainerRef.current?.querySelector('div[role="button"]') as HTMLElement
            if (renderedBtn) {
              renderedBtn.click()
            }
          }
        })
      } else {
        toast.error("Google services are loading, please try again in a moment.")
      }
    } catch (err) {
      console.error("Google Prompt error:", err)
      setShowConfigModal(true)
    }
  }

  const copyConfigHelp = () => {
    const guide = `SoulSync Google OAuth Setup:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create 'OAuth 2.0 Client ID' (Type: Web Application)
3. Add Authorized JavaScript origins:
   - https://soul-sync-xq9c.vercel.app
   - http://localhost:3000
4. Add Authorized redirect URIs:
   - https://soul-sync-xq9c.vercel.app
5. Copy Client ID and set in Vercel environment:
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   And in Render backend:
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`

    navigator.clipboard.writeText(guide)
    setCopied(true)
    toast.success("Setup instructions copied to clipboard!")
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <>
      <div className={`relative w-full ${className}`}>
        {/* Hidden container for Google GSI native button fallback */}
        <div ref={googleBtnContainerRef} className="hidden" aria-hidden="true" />

        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 active:scale-[0.99] transition-all text-sm font-semibold text-foreground shadow-sm group"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-soul-purple border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{loading ? "Authenticating..." : label}</span>
        </button>
      </div>

      {/* Setup Guide Modal (Displayed if NEXT_PUBLIC_GOOGLE_CLIENT_ID is not yet set) */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg glass rounded-2xl p-6 border border-white/10 shadow-2xl space-y-5 bg-card/95 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setShowConfigModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Google Sign-In Setup</h3>
                  <p className="text-xs text-muted-foreground">How to activate 1-click Google Login for SoulSync</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground bg-white/5 p-4 rounded-xl border border-white/5 leading-relaxed">
                <p className="text-foreground font-semibold">To enable Google Login on your live site:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Open{" "}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-soul-purple hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      Google Cloud Console <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Click <strong>Create Credentials</strong> &gt; <strong>OAuth Client ID</strong> (Web application).</li>
                  <li>
                    Under <strong>Authorized JavaScript origins</strong>, add:
                    <div className="mt-1 font-mono text-[11px] bg-black/40 p-1.5 rounded text-soul-teal border border-soul-teal/20">
                      https://soul-sync-xq9c.vercel.app
                    </div>
                  </li>
                  <li>
                    Copy your <strong>Client ID</strong> and add it to your environment variables:
                    <div className="mt-1 font-mono text-[11px] bg-black/40 p-2 rounded text-soul-purple-light border border-soul-purple/20 space-y-1">
                      <div><strong>Vercel:</strong> NEXT_PUBLIC_GOOGLE_CLIENT_ID</div>
                      <div><strong>Render:</strong> GOOGLE_CLIENT_ID</div>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={copyConfigHelp}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-foreground transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-soul-teal" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Step-by-Step Guide"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-soul-purple hover:bg-soul-purple-light text-white text-xs font-semibold shadow-glow transition-all"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}


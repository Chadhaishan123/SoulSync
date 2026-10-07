"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { api, clearTokens, setTokens } from "@/lib/api"
import type { MeResponse } from "@/types/auth"

interface AuthState {
  user: MeResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setUser(null)
        setIsLoading(false)
        return
      }
      const me = await api.user.getMe()
      setUser(me)
    } catch {
      clearTokens()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase()
    try {
      const data = await api.auth.login(cleanEmail, password)
      setTokens(data.tokens.access_token, data.tokens.refresh_token)
      const me = await api.user.getMe()
      setUser(me)
      try {
        localStorage.setItem("soulsync_last_user", JSON.stringify({ name: me.name, email: cleanEmail }))
      } catch {}
    } catch (err: any) {
      // Resilient recovery: If backend container restarted and wiped ephemeral SQLite,
      // verify if user is missing and auto-reprovision account with their credentials.
      const isAuthErr = err?.status === 401 || err?.message?.toLowerCase().includes("incorrect")
      if (isAuthErr) {
        try {
          let savedName = cleanEmail.split("@")[0].charAt(0).toUpperCase() + cleanEmail.split("@")[0].slice(1)
          try {
            const raw = localStorage.getItem("soulsync_last_user")
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed.email === cleanEmail && parsed.name) {
                savedName = parsed.name
              }
            }
          } catch {}

          const regData = await api.auth.register(savedName, cleanEmail, password)
          setTokens(regData.tokens.access_token, regData.tokens.refresh_token)
          const me = await api.user.getMe()
          setUser(me)
          return
        } catch (regErr: any) {
          if (regErr?.status === 409 || regErr?.message?.includes("already exists")) {
            throw new Error("Incorrect password for this account")
          }
          throw err
        }
      }
      throw err
    }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase()
    const data = await api.auth.register(name, cleanEmail, password)
    setTokens(data.tokens.access_token, data.tokens.refresh_token)
    try {
      localStorage.setItem("soulsync_last_user", JSON.stringify({ name, email: cleanEmail }))
    } catch {}
    const me = await api.user.getMe()
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    await fetchUser()
  }, [fetchUser])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export default AuthContext

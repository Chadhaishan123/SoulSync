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
      const cleanEmail = me.email?.toLowerCase().trim()
      if (cleanEmail) {
        try {
          const raw = localStorage.getItem(`soulsync_profile_${cleanEmail}`)
          if (raw) {
            const saved = JSON.parse(raw)
            if (saved.name) me.name = saved.name
            if (saved.timezone && (!me.profile.timezone || me.profile.timezone === "UTC")) {
              me.profile.timezone = saved.timezone
            }
            if (saved.sleep_goal_minutes !== undefined && saved.sleep_goal_minutes !== null) {
              me.profile.sleep_goal_minutes = saved.sleep_goal_minutes
            }
            if (saved.reminder_hour !== undefined && saved.reminder_hour !== null) {
              me.profile.reminder_hour = saved.reminder_hour
            }
            if (saved.location_enabled !== undefined) me.profile.location_enabled = saved.location_enabled
            if (saved.environment_enabled !== undefined) me.profile.environment_enabled = saved.environment_enabled
            if (saved.nlp_analysis_enabled !== undefined) me.profile.nlp_analysis_enabled = saved.nlp_analysis_enabled
            if (saved.notifications_enabled !== undefined) me.profile.notifications_enabled = saved.notifications_enabled
            if (saved.last_latitude !== undefined && saved.last_latitude !== null) me.profile.last_latitude = saved.last_latitude
            if (saved.last_longitude !== undefined && saved.last_longitude !== null) me.profile.last_longitude = saved.last_longitude
            if (saved.last_city) me.profile.last_city = saved.last_city
          }
        } catch {}
      }
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

      // Read local cached profile to prevent resetting customized settings
      let savedProfile: any = null
      try {
        const raw = localStorage.getItem(`soulsync_profile_${cleanEmail}`)
        if (raw) savedProfile = JSON.parse(raw)
      } catch {}

      if (savedProfile) {
        if (savedProfile.name) me.name = savedProfile.name
        if (savedProfile.timezone) me.profile.timezone = savedProfile.timezone
        if (savedProfile.sleep_goal_minutes !== undefined) me.profile.sleep_goal_minutes = savedProfile.sleep_goal_minutes
        if (savedProfile.reminder_hour !== undefined) me.profile.reminder_hour = savedProfile.reminder_hour
        if (savedProfile.location_enabled !== undefined) me.profile.location_enabled = savedProfile.location_enabled
        if (savedProfile.environment_enabled !== undefined) me.profile.environment_enabled = savedProfile.environment_enabled
        if (savedProfile.nlp_analysis_enabled !== undefined) me.profile.nlp_analysis_enabled = savedProfile.nlp_analysis_enabled
        if (savedProfile.notifications_enabled !== undefined) me.profile.notifications_enabled = savedProfile.notifications_enabled
        if (savedProfile.last_latitude !== undefined && savedProfile.last_latitude !== null) me.profile.last_latitude = savedProfile.last_latitude
        if (savedProfile.last_longitude !== undefined && savedProfile.last_longitude !== null) me.profile.last_longitude = savedProfile.last_longitude
        if (savedProfile.last_city) me.profile.last_city = savedProfile.last_city

        // Resync customizations to backend in background if backend profile had blank defaults
        api.user.updateProfile({
          name: savedProfile.name || me.name,
          timezone: savedProfile.timezone || me.profile.timezone,
          sleep_goal_minutes: savedProfile.sleep_goal_minutes ?? me.profile.sleep_goal_minutes ?? 480,
          reminder_hour: savedProfile.reminder_hour ?? me.profile.reminder_hour ?? 20,
        }).catch(() => {})
      } else {
        // Cache initial profile for this user
        try {
          localStorage.setItem(`soulsync_profile_${cleanEmail}`, JSON.stringify({
            name: me.name,
            timezone: me.profile.timezone,
            sleep_goal_minutes: me.profile.sleep_goal_minutes,
            reminder_hour: me.profile.reminder_hour,
            location_enabled: me.profile.location_enabled,
            environment_enabled: me.profile.environment_enabled,
            nlp_analysis_enabled: me.profile.nlp_analysis_enabled,
            notifications_enabled: me.profile.notifications_enabled,
            last_latitude: me.profile.last_latitude,
            last_longitude: me.profile.last_longitude,
            last_city: me.profile.last_city,
          }))
        } catch {}
      }



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
          let savedProfile: any = null
          try {
            const rawProf = localStorage.getItem(`soulsync_profile_${cleanEmail}`)
            if (rawProf) {
              savedProfile = JSON.parse(rawProf)
              if (savedProfile.name) savedName = savedProfile.name
            }
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

          if (savedProfile) {
            if (savedProfile.name) me.name = savedProfile.name
            if (savedProfile.timezone) me.profile.timezone = savedProfile.timezone
            if (savedProfile.sleep_goal_minutes !== undefined) me.profile.sleep_goal_minutes = savedProfile.sleep_goal_minutes
            if (savedProfile.reminder_hour !== undefined) me.profile.reminder_hour = savedProfile.reminder_hour

            // Restore in backend
            await api.user.updateProfile({
              name: savedProfile.name || me.name,
              timezone: savedProfile.timezone || me.profile.timezone,
              sleep_goal_minutes: savedProfile.sleep_goal_minutes ?? 480,
              reminder_hour: savedProfile.reminder_hour ?? 20,
            }).catch(() => {})
          }



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
      localStorage.setItem(`soulsync_profile_${cleanEmail}`, JSON.stringify({
        name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        sleep_goal_minutes: 480,
        reminder_hour: 20,
        location_enabled: false,
        environment_enabled: false,
        nlp_analysis_enabled: true,
        notifications_enabled: true,
      }))
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

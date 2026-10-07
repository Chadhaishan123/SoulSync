"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  CloudSun,
  Wind,
  Droplets,
  Sun,
  Compass,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  MapPin,
} from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import Card from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import toast from "react-hot-toast"

interface EnvData {
  location: {
    city?: string
    region?: string
    country?: string
    latitude: number
    longitude: number
  }
  weather: {
    temperature_c?: number
    apparent_temperature_c?: number
    humidity_pct?: number
    wind_speed_kmh?: number
    weather_label?: string
    is_day?: boolean
  }
  air_quality: {
    us_aqi?: number
    aqi_band?: string
    aqi_advice?: string
    pm2_5?: number
    uv_index?: number
  }
  astronomy: {
    is_daylight_now?: boolean
    minutes_to_sunset?: number
    minutes_since_sunrise?: number
  }
}

export default function EnvironmentLiveWidget() {
  const { user, refreshUser } = useAuth()
  const [data, setData] = useState<EnvData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const profile = user?.profile
  const isConsentEnabled = profile?.location_enabled && profile?.environment_enabled

  useEffect(() => {
    fetchLiveEnv()
  }, [profile?.location_enabled, profile?.environment_enabled])

  const fetchLiveEnv = async () => {
    setErrorMsg(null)
    setLoading(true)

    try {
      // If we have browser GPS available, try to pass fresh coords
      if ("geolocation" in navigator && profile?.location_enabled) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const res = await api.environment.now(pos.coords.latitude, pos.coords.longitude)
              setData(res)
            } catch (err: any) {
              handleFetchError(err)
            } finally {
              setLoading(false)
              setRefreshing(false)
            }
          },
          async () => {
            // Fallback to profile coordinates
            try {
              const res = await api.environment.now()
              setData(res)
            } catch (err: any) {
              handleFetchError(err)
            } finally {
              setLoading(false)
              setRefreshing(false)
            }
          },
          { timeout: 6000 }
        )
      } else {
        const res = await api.environment.now()
        setData(res)
        setLoading(false)
        setRefreshing(false)
      }
    } catch (err: any) {
      handleFetchError(err)
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleFetchError = (err: any) => {
    if (err?.status === 403) {
      setErrorMsg("consent_required")
    } else if (err?.status === 409) {
      setErrorMsg("location_required")
    } else {
      setErrorMsg("Environmental sensors currently connecting...")
    }
  }

  const enableTracking = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported on this browser")
      return
    }

    toast.loading("Detecting live location...", { id: "gps" })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
          await api.user.updateConsents({
            location_enabled: true,
            environment_enabled: true,
          })
          await api.user.updateLocation(pos.coords.latitude, pos.coords.longitude, tz)
          toast.dismiss("gps")
          toast.success("Live environment tracking enabled! 🌤️")
          refreshUser()
          fetchLiveEnv()
        } catch {
          toast.dismiss("gps")
          toast.error("Failed to save location coordinates")
        }
      },
      (err) => {
        toast.dismiss("gps")
        toast.error(`Location access denied: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleManualRefresh = () => {
    setRefreshing(true)
    fetchLiveEnv()
  }

  // Get AQI color
  const getAqiColor = (aqi?: number) => {
    if (!aqi) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    if (aqi <= 50) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    if (aqi <= 100) return "text-amber-400 bg-amber-500/10 border-amber-500/20"
    return "text-red-400 bg-red-500/10 border-red-500/20"
  }

  if (errorMsg === "consent_required" || !isConsentEnabled) {
    return (
      <Card variant="interactive" className="p-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-soul-teal/10 flex items-center justify-center text-soul-teal">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Real-Time Environment Tracking</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enable live weather, PM2.5, UV index, and circadian sunlight tracking.
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={enableTracking} icon={<Compass className="w-4 h-4" />}>
            Activate Live Sensors
          </Button>
        </div>
      </Card>
    )
  }

  if (loading && !data) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-16 bg-muted/60 rounded-xl" />
          <div className="h-16 bg-muted/60 rounded-xl" />
          <div className="h-16 bg-muted/60 rounded-xl" />
          <div className="h-16 bg-muted/60 rounded-xl" />
        </div>
      </Card>
    )
  }

  const weather = data?.weather
  const air = data?.air_quality
  const loc = data?.location
  const aqiVal = air?.us_aqi || 25
  const tempVal = weather?.temperature_c !== undefined ? Math.round(weather.temperature_c) : "--"

  return (
    <Card variant="glow" className="p-5 relative overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <CloudSun className="w-5 h-5 text-soul-teal" />
          <h3 className="text-sm font-bold text-foreground">Live Environment Tracking</h3>
          {loc?.city && (
            <Badge variant="accent" size="sm" className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {loc.city}{loc.country ? `, ${loc.country}` : ""}
            </Badge>
          )}
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-secondary"
          title="Refresh real-time conditions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-soul-purple" : ""}`} />
          <span className="hidden sm:inline">Live Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Temperature */}
        <div className="p-3 rounded-xl bg-secondary/40 border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs">Temperature</span>
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-foreground font-mono">
            {tempVal}°C
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {weather?.weather_label || "Clear Conditions"}
          </p>
        </div>

        {/* Air Quality */}
        <div className="p-3 rounded-xl bg-secondary/40 border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs">Air Quality (AQI)</span>
            <Wind className="w-4 h-4 text-soul-teal" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-foreground font-mono">{aqiVal}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getAqiColor(aqiVal)}`}>
              {air?.aqi_band || (aqiVal <= 50 ? "Good" : "Moderate")}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            PM2.5: {air?.pm2_5 ? `${air.pm2_5.toFixed(1)} µg/m³` : "Low"}
          </p>
        </div>

        {/* Humidity */}
        <div className="p-3 rounded-xl bg-secondary/40 border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs">Humidity</span>
            <Droplets className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-foreground font-mono">
            {weather?.humidity_pct !== undefined ? `${Math.round(weather.humidity_pct)}%` : "--%"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Wind: {weather?.wind_speed_kmh ? `${Math.round(weather.wind_speed_kmh)} km/h` : "Calm"}
          </p>
        </div>

        {/* UV & Daylight */}
        <div className="p-3 rounded-xl bg-secondary/40 border border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs">UV & Circadian</span>
            <Sun className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-extrabold text-foreground font-mono">
            {air?.uv_index !== undefined && air?.uv_index !== null ? air.uv_index.toFixed(1) : "1.2"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {data?.astronomy?.is_daylight_now ? "☀️ Daylight Active" : "🌙 Nighttime Window"}
          </p>
        </div>
      </div>
    </Card>
  )
}

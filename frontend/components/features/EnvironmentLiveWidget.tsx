"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CloudSun,
  Wind,
  Droplets,
  Sun,
  Compass,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Search,
  X,
  Check,
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

interface GeocodingResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
  timezone?: string
}

// Default fallback coordinates by common timezones
const TZ_COORDS: Record<string, { lat: number; lon: number; city: string }> = {
  "Asia/Kolkata": { lat: 28.6139, lon: 77.209, city: "New Delhi" },
  "Asia/Calcutta": { lat: 28.6139, lon: 77.209, city: "New Delhi" },
  "Asia/Delhi": { lat: 28.6139, lon: 77.209, city: "New Delhi" },
  "Asia/Mumbai": { lat: 19.076, lon: 72.8777, city: "Mumbai" },
  "America/New_York": { lat: 40.7128, lon: -74.006, city: "New York" },
  "America/Los_Angeles": { lat: 34.0522, lon: -118.2437, city: "Los Angeles" },
  "America/Chicago": { lat: 41.8781, lon: -87.6298, city: "Chicago" },
  "Europe/London": { lat: 51.5074, lon: -0.1278, city: "London" },
  "Europe/Paris": { lat: 48.8566, lon: 2.3522, city: "Paris" },
  "Europe/Berlin": { lat: 52.52, lon: 13.405, city: "Berlin" },
  "Asia/Dubai": { lat: 25.2048, lon: 55.2708, city: "Dubai" },
  "Asia/Singapore": { lat: 1.3521, lon: 103.8198, city: "Singapore" },
  "Asia/Tokyo": { lat: 35.6762, lon: 139.6503, city: "Tokyo" },
  "Australia/Sydney": { lat: -33.8688, lon: 151.2093, city: "Sydney" },
}

export default function EnvironmentLiveWidget() {
  const { user, refreshUser } = useAuth()
  const [data, setData] = useState<EnvData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // City search modal / popover
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const profile = user?.profile
  const cleanEmail = user?.email?.toLowerCase().trim() || "anonymous"
  const isConsentEnabled = Boolean(profile?.location_enabled && profile?.environment_enabled)

  // Local storage key for persistent caching
  const cacheKey = `soulsync_env_${cleanEmail}`

  // 1. Initial hydration from cache for instant display
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.weather?.temperature_c !== undefined) {
          setData(parsed)
          setLoading(false)
        }
      }
    } catch {}
  }, [cacheKey])

  // 2. Fetch live weather whenever user or consents update
  const fetchLiveEnv = useCallback(async () => {
    setErrorMsg(null)
    if (!data) setLoading(true)

    try {
      // Step A: If stored coordinates exist, fetch with them directly
      if (profile?.last_latitude && profile?.last_longitude) {
        try {
          const res = await api.environment.now(profile.last_latitude, profile.last_longitude)
          setData(res)
          localStorage.setItem(cacheKey, JSON.stringify(res))
          setLoading(false)
          setRefreshing(false)
          return
        } catch {
          // Stored coords might have failed upstream, continue to fresh attempt
        }
      }

      // Step B: Try browser GPS if supported
      if (typeof window !== "undefined" && "geolocation" in navigator && profile?.location_enabled) {
        const gpsPromise = new Promise<{ lat: number; lon: number }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            (err) => reject(err),
            { timeout: 4000, enableHighAccuracy: false }
          )
        })

        try {
          const coords = await gpsPromise
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
          await api.user.updateLocation(coords.lat, coords.lon, tz).catch(() => {})
          const res = await api.environment.now(coords.lat, coords.lon)
          setData(res)
          localStorage.setItem(cacheKey, JSON.stringify(res))
          setLoading(false)
          setRefreshing(false)
          return
        } catch {
          // GPS denied or timed out; fall through to fallback
        }
      }

      // Step C: Fallback to IP Geolocation
      try {
        const ipRes = await fetch("https://ipapi.co/json/", { cache: "no-store" })
        if (ipRes.ok) {
          const ipData = await ipRes.json()
          if (ipData.latitude && ipData.longitude) {
            const tz = ipData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
            await api.user.updateLocation(ipData.latitude, ipData.longitude, tz).catch(() => {})
            const res = await api.environment.now(ipData.latitude, ipData.longitude)
            setData(res)
            localStorage.setItem(cacheKey, JSON.stringify(res))
            setLoading(false)
            setRefreshing(false)
            return
          }
        }
      } catch {
        // IP geolocation unavailable
      }

      // Step D: Fallback to Timezone mapping or backend default
      const sysTz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      const tzDefault = TZ_COORDS[sysTz] || TZ_COORDS["Asia/Kolkata"]
      const res = await api.environment.now(tzDefault.lat, tzDefault.lon)
      setData(res)
      localStorage.setItem(cacheKey, JSON.stringify(res))
    } catch (err: any) {
      if (err?.status === 403) {
        setErrorMsg("consent_required")
      } else {
        setErrorMsg(err?.message || "Sensors connecting...")
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [profile?.last_latitude, profile?.last_longitude, profile?.location_enabled, profile?.timezone, cacheKey, data])

  useEffect(() => {
    if (isConsentEnabled) {
      fetchLiveEnv()
    } else {
      setLoading(false)
    }
  }, [isConsentEnabled, fetchLiveEnv])

  // One-click activation with GPS + IP fallback
  const enableTracking = async () => {
    toast.loading("Connecting live environmental sensors...", { id: "activate-env" })

    try {
      // 1. Enable consents first
      await api.user.updateConsents({
        location_enabled: true,
        environment_enabled: true,
      })

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

      // 2. Try browser GPS
      let resolvedLat: number | null = null
      let resolvedLon: number | null = null

      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 4000,
              enableHighAccuracy: true,
            })
          })
          resolvedLat = pos.coords.latitude
          resolvedLon = pos.coords.longitude
        } catch {}
      }

      // 3. Fallback to IP geolocation if GPS wasn't permitted or timed out
      if (resolvedLat === null || resolvedLon === null) {
        try {
          const ipRes = await fetch("https://ipapi.co/json/")
          if (ipRes.ok) {
            const ipData = await ipRes.json()
            if (ipData.latitude && ipData.longitude) {
              resolvedLat = ipData.latitude
              resolvedLon = ipData.longitude
            }
          }
        } catch {}
      }

      // 4. Default to timezone coordinate if GPS and IP both blocked
      if (resolvedLat === null || resolvedLon === null) {
        const fallback = TZ_COORDS[tz] || TZ_COORDS["Asia/Kolkata"]
        resolvedLat = fallback.lat
        resolvedLon = fallback.lon
      }

      // 5. Save location & fetch weather
      await api.user.updateLocation(resolvedLat, resolvedLon, tz)
      const res = await api.environment.now(resolvedLat, resolvedLon)
      setData(res)
      localStorage.setItem(cacheKey, JSON.stringify(res))

      toast.dismiss("activate-env")
      toast.success(
        `Live environment tracking active for ${res.location?.city || "your area"}! 🌤️`
      )
      refreshUser()
    } catch (err: any) {
      toast.dismiss("activate-env")
      toast.error(err?.message || "Failed to activate environment sensors")
    }
  }

  // Handle manual city search
  const handleSearchCities = async (query: string) => {
    setSearchQuery(query)
    if (!query || query.trim().length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          query.trim()
        )}&count=6&language=en&format=json`
      )
      if (res.ok) {
        const json = await res.json()
        setSearchResults(json.results || [])
      }
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Apply selected city
  const handleSelectCity = async (city: GeocodingResult) => {
    toast.loading(`Setting location to ${city.name}...`, { id: "set-city" })
    try {
      await api.user.updateConsents({
        location_enabled: true,
        environment_enabled: true,
      })

      const tz = city.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      await api.user.updateLocation(city.latitude, city.longitude, tz)
      const res = await api.environment.now(city.latitude, city.longitude)
      setData(res)
      localStorage.setItem(cacheKey, JSON.stringify(res))

      toast.dismiss("set-city")
      toast.success(`Weather updated for ${city.name}! 🌤️`)
      setSearchOpen(false)
      refreshUser()
    } catch {
      toast.dismiss("set-city")
      toast.error("Failed to update city location")
    }
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
    if (aqi <= 150) return "text-orange-400 bg-orange-500/10 border-orange-500/20"
    return "text-red-400 bg-red-500/10 border-red-500/20"
  }

  // City Search Modal
  const cityModal = (
    <AnimatePresence>
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-soul-teal" />
                <h3 className="text-base font-bold text-foreground">Select Your City</h3>
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Search any city worldwide to get real-time Open-Meteo weather and AQI without requiring browser GPS permissions.
            </p>

            <div className="relative mb-4">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="e.g. Delhi, Mumbai, London, New York..."
                value={searchQuery}
                onChange={(e) => handleSearchCities(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-soul-teal/50"
              />
            </div>

            {isSearching && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                Searching cities...
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((city) => (
                <button
                  key={`${city.id}-${city.name}`}
                  onClick={() => handleSelectCity(city)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors flex items-center justify-between group"
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground group-hover:text-soul-teal">
                      {city.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[city.admin1, city.country].filter(Boolean).join(", ")}
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-soul-teal opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}

              {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No matching cities found. Try another spelling.
                </div>
              )}

              {searchQuery.length < 2 && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Popular Locations
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: "New Delhi", lat: 28.6139, lon: 77.209, tz: "Asia/Kolkata", country: "India" },
                      { name: "Mumbai", lat: 19.076, lon: 72.8777, tz: "Asia/Kolkata", country: "India" },
                      { name: "Bengaluru", lat: 12.9716, lon: 77.5946, tz: "Asia/Kolkata", country: "India" },
                      { name: "London", lat: 51.5074, lon: -0.1278, tz: "Europe/London", country: "UK" },
                      { name: "New York", lat: 40.7128, lon: -74.006, tz: "America/New_York", country: "USA" },
                      { name: "San Francisco", lat: 37.7749, lon: -122.4194, tz: "America/Los_Angeles", country: "USA" },
                    ].map((loc) => (
                      <button
                        key={loc.name}
                        onClick={() =>
                          handleSelectCity({
                            id: 0,
                            name: loc.name,
                            latitude: loc.lat,
                            longitude: loc.lon,
                            timezone: loc.tz,
                            country: loc.country,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-secondary/70 hover:bg-soul-teal/20 text-xs text-foreground hover:text-soul-teal transition-colors"
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  // RENDER: Consent not granted yet
  if (!isConsentEnabled) {
    return (
      <>
        <Card variant="interactive" className="p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-soul-teal/10 flex items-center justify-center text-soul-teal shrink-0">
                <CloudSun className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Real-Time Environment Tracking</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track live weather, PM2.5 air quality, UV index, and circadian sunlight patterns.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="primary"
                onClick={enableTracking}
                icon={<Compass className="w-4 h-4" />}
                className="flex-1 sm:flex-initial"
              >
                Activate Live Sensors
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearchOpen(true)
                  setTimeout(() => searchInputRef.current?.focus(), 100)
                }}
                icon={<MapPin className="w-4 h-4" />}
              >
                Set City
              </Button>
            </div>
          </div>
        </Card>
        {cityModal}
      </>
    )
  }

  // RENDER: Loading state with no cached data
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

  // RENDER: Error state when no data could be retrieved
  if (errorMsg && !data) {
    return (
      <>
        <Card variant="interactive" className="p-5 border-amber-500/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">Connecting to Live Environmental Feeds</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your browser or network didn&apos;t provide GPS coordinates. Set your city manually to start live tracking.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={fetchLiveEnv} icon={<RefreshCw className="w-4 h-4" />}>
                Retry
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setSearchOpen(true)
                  setTimeout(() => searchInputRef.current?.focus(), 100)
                }}
                icon={<MapPin className="w-4 h-4" />}
              >
                Set City
              </Button>
            </div>
          </div>
        </Card>
        {cityModal}
      </>
    )
  }

  const weather = data?.weather
  const air = data?.air_quality
  const loc = data?.location
  const aqiVal = air?.us_aqi ?? 28
  const tempVal = weather?.temperature_c !== undefined ? Math.round(weather.temperature_c) : 24

  return (
    <>
      <Card variant="glow" className="p-5 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CloudSun className="w-5 h-5 text-soul-teal" />
            <h3 className="text-sm font-bold text-foreground">Live Environment Tracking</h3>
            {loc?.city && (
              <Badge variant="accent" size="sm" className="flex items-center gap-1 font-medium">
                <MapPin className="w-3 h-3 text-soul-teal" />
                {loc.city}
                {loc.country ? `, ${loc.country}` : ""}
              </Badge>
            )}
            <button
              onClick={() => {
                setSearchOpen(true)
                setTimeout(() => searchInputRef.current?.focus(), 100)
              }}
              className="text-[11px] text-muted-foreground hover:text-soul-teal flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-secondary/60 ml-0.5"
              title="Change your city location"
            >
              <span>(Change)</span>
            </button>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors px-2.5 py-1 rounded-md hover:bg-secondary"
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
              <span className="text-xs font-medium">Temperature</span>
              <Sun className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono">
              {tempVal}°C
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {weather?.weather_label || "Clear sky"}
            </p>
          </div>

          {/* Air Quality */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Air Quality (AQI)</span>
              <Wind className="w-4 h-4 text-soul-teal" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold text-foreground font-mono">{aqiVal}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getAqiColor(aqiVal)}`}>
                {air?.aqi_band || (aqiVal <= 50 ? "Good" : aqiVal <= 100 ? "Moderate" : "Unhealthy")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              PM2.5: {air?.pm2_5 ? `${air.pm2_5.toFixed(1)} µg/m³` : "Low"}
            </p>
          </div>

          {/* Humidity */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Humidity</span>
              <Droplets className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono">
              {weather?.humidity_pct !== undefined ? `${Math.round(weather.humidity_pct)}%` : "65%"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Wind: {weather?.wind_speed_kmh ? `${Math.round(weather.wind_speed_kmh)} km/h` : "Calm"}
            </p>
          </div>

          {/* UV & Daylight */}
          <div className="p-3 rounded-xl bg-secondary/40 border border-border">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">UV & Circadian</span>
              <Sun className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-extrabold text-foreground font-mono">
              {air?.uv_index !== undefined && air?.uv_index !== null ? air.uv_index.toFixed(1) : "0.0"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {data?.astronomy?.is_daylight_now ? "☀️ Daylight Active" : "🌙 Nighttime Window"}
            </p>
          </div>
        </div>
      </Card>
      {cityModal}
    </>
  )
}

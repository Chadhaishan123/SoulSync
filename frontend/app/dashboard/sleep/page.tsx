"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Moon, Plus, Star, Play, Square, Clock, Sparkles, CheckCircle2 } from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Slider from "@/components/ui/Slider"
import Modal from "@/components/ui/Modal"
import SleepRingChart from "@/components/charts/SleepRingChart"
import { formatDate, formatMinutesToHours } from "@/lib/formatters"
import type { SleepRecord } from "@/types/sleep"
import toast from "react-hot-toast"

const SLEEP_SESSION_KEY = "soulsync_sleep_session_start"

export default function SleepPage() {
  const [records, setRecords] = useState<SleepRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showManualForm, setShowManualForm] = useState(false)
  const [hours, setHours] = useState(7)
  const [minutes, setMinutes] = useState(30)
  const [quality, setQuality] = useState(3)
  const [saving, setSaving] = useState(false)

  // Live sleep session stopwatch state
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null)
  const [elapsedString, setElapsedString] = useState<string>("00h 00m 00s")
  const [showWakeModal, setShowWakeModal] = useState(false)
  const [wakeDurationMinutes, setWakeDurationMinutes] = useState(0)
  const [wakeQuality, setWakeQuality] = useState(4)

  useEffect(() => {
    loadRecords()
    // Check if a sleep session is currently active
    const savedSession = localStorage.getItem(SLEEP_SESSION_KEY)
    if (savedSession) {
      setSessionStartTime(savedSession)
    }
  }, [])

  // Timer loop for active sleep session
  useEffect(() => {
    if (!sessionStartTime) return

    const updateElapsed = () => {
      const startMs = new Date(sessionStartTime).getTime()
      const nowMs = Date.now()
      const diffMs = Math.max(0, nowMs - startMs)

      const totalSec = Math.floor(diffMs / 1000)
      const h = Math.floor(totalSec / 3600)
      const m = Math.floor((totalSec % 3600) / 60)
      const s = totalSec % 60

      setElapsedString(
        `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`
      )
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [sessionStartTime])

  const loadRecords = async () => {
    try {
      const data = await api.sleep.list()
      setRecords(data)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  // Start live sleep session
  const startLiveSleep = () => {
    const nowIso = new Date().toISOString()
    localStorage.setItem(SLEEP_SESSION_KEY, nowIso)
    setSessionStartTime(nowIso)
    toast.success("Sleep session started. Sweet dreams! 🌙", { icon: "😴" })
  }

  // Stop sleep session & open rating modal
  const stopLiveSleep = () => {
    if (!sessionStartTime) return
    const startMs = new Date(sessionStartTime).getTime()
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startMs) / (1000 * 60)))
    setWakeDurationMinutes(elapsedMinutes)
    setShowWakeModal(true)
  }

  // Save live sleep session
  const saveLiveSleep = async () => {
    setSaving(true)
    try {
      await api.sleep.create({
        sleep_date: new Date().toISOString().split("T")[0],
        duration_minutes: wakeDurationMinutes,
        quality_rating: wakeQuality,
      })
      localStorage.removeItem(SLEEP_SESSION_KEY)
      setSessionStartTime(null)
      setShowWakeModal(false)
      toast.success(`Sleep logged: ${formatMinutesToHours(wakeDurationMinutes)} recorded! ☀️`)
      loadRecords()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save sleep session")
    } finally {
      setSaving(false)
    }
  }

  const cancelSleepSession = () => {
    if (confirm("Discard this sleep recording without saving?")) {
      localStorage.removeItem(SLEEP_SESSION_KEY)
      setSessionStartTime(null)
      toast("Sleep session cancelled")
    }
  }

  const handleManualSave = async () => {
    setSaving(true)
    try {
      await api.sleep.create({
        sleep_date: new Date().toISOString().split("T")[0],
        duration_minutes: hours * 60 + minutes,
        quality_rating: quality,
      })
      toast.success("Sleep logged! 😴")
      setShowManualForm(false)
      loadRecords()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const latestSleep = records[0]
  const avgDuration =
    records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.duration_minutes, 0) / records.length)
      : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Moon className="w-6 h-6 text-indigo-400" />
            Sleep Tracker
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Record real-time sleep sessions or manually log past nights.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowManualForm(!showManualForm)}
          icon={<Plus className="w-4 h-4" />}
        >
          {showManualForm ? "Close Form" : "Log Manually"}
        </Button>
      </div>

      {/* ── LIVE SLEEP SESSION STOPWATCH ── */}
      <Card variant="glow" className="p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                sessionStartTime
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_25px_rgba(99,102,241,0.3)] animate-pulse"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <Moon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">
                  {sessionStartTime ? "Active Sleep Session" : "Live Sleep Tracker"}
                </h3>
                {sessionStartTime && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    RECORDING LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {sessionStartTime
                  ? `Recording since ${new Date(sessionStartTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Stop when you wake up.`
                  : "Turn on before bed — records the exact time you sleep until you switch it off."}
              </p>
            </div>
          </div>

          {sessionStartTime ? (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground text-center sm:text-right">
                {elapsedString}
              </div>
              <Button
                variant="primary"
                onClick={stopLiveSleep}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-black font-bold"
                icon={<Square className="w-4 h-4 fill-current" />}
              >
                ☀️ Wake Up & Stop
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={startLiveSleep}
              size="lg"
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              icon={<Play className="w-4 h-4 fill-current" />}
            >
              🌙 Start Sleep Session
            </Button>
          )}
        </div>

        {sessionStartTime && (
          <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
            <span>You can close the tab or turn off your screen; your session will continue tracking.</span>
            <button onClick={cancelSleepSession} className="text-red-400 hover:underline">
              Cancel session
            </button>
          </div>
        )}
      </Card>

      {/* Manual Log Form */}
      {showManualForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <Card variant="interactive">
            <h3 className="text-sm font-bold text-foreground mb-4">Manual Sleep Entry</h3>
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Slider
                    label="Hours"
                    value={hours}
                    onChange={setHours}
                    min={0}
                    max={14}
                    formatValue={(v) => `${v}h`}
                  />
                </div>
                <div className="flex-1">
                  <Slider
                    label="Minutes"
                    value={minutes}
                    onChange={setMinutes}
                    min={0}
                    max={55}
                    step={5}
                    formatValue={(v) => `${v}m`}
                  />
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Sleep Quality
                </span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setQuality(s)}
                      className={`p-2 rounded-lg transition-all ${
                        s <= quality ? "text-amber-400" : "text-muted-foreground/30"
                      }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowManualForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleManualSave} isLoading={saving}>
                  Save Manual Record
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Average Sleep
          </span>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {avgDuration ? formatMinutesToHours(avgDuration) : "No data"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {records.length} logged nights
          </p>
        </Card>

        <Card>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Last Night
          </span>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {latestSleep ? formatMinutesToHours(latestSleep.duration_minutes) : "No data"}
          </div>
          {latestSleep && (
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= latestSleep.quality_rating
                      ? "text-amber-400 fill-current"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="flex items-center justify-center">
          <SleepRingChart
            durationMinutes={latestSleep?.duration_minutes || 0}
            goalMinutes={480}
            qualityRating={latestSleep?.quality_rating}
          />
        </Card>
      </div>

      {/* Recent Records */}
      <Card>
        <h3 className="text-sm font-bold text-foreground mb-4">Sleep History</h3>
        {records.length > 0 ? (
          <div className="space-y-3">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{formatDate(r.sleep_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMinutesToHours(r.duration_minutes)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= r.quality_rating
                          ? "text-amber-400 fill-current"
                          : "text-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No sleep records yet. Start a live session before bed or log manually!
          </p>
        )}
      </Card>

      {/* Wake Up & Rate Modal */}
      <Modal
        isOpen={showWakeModal}
        onClose={() => setShowWakeModal(false)}
        title="Good Morning! ☀️"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You slept for{" "}
            <strong className="text-foreground">{formatMinutesToHours(wakeDurationMinutes)}</strong>.
            How rested do you feel?
          </p>

          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Sleep Quality Rating
            </span>
            <div className="flex gap-3 justify-center py-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setWakeQuality(s)}
                  className={`p-2 rounded-xl transition-all ${
                    s <= wakeQuality ? "text-amber-400 scale-110" : "text-muted-foreground/30"
                  }`}
                >
                  <Star className="w-8 h-8 fill-current" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowWakeModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={saveLiveSleep}
              isLoading={saving}
              className="flex-1"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Save Sleep
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}

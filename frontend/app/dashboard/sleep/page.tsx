"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Moon, Plus, Star } from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Slider from "@/components/ui/Slider"
import SleepRingChart from "@/components/charts/SleepRingChart"
import { formatDate, formatMinutesToHours } from "@/lib/formatters"
import type { SleepRecord } from "@/types/sleep"
import toast from "react-hot-toast"

export default function SleepPage() {
  const [records, setRecords] = useState<SleepRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [hours, setHours] = useState(7)
  const [minutes, setMinutes] = useState(30)
  const [quality, setQuality] = useState(3)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadRecords()
  }, [])

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

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.sleep.create({
        sleep_date: new Date().toISOString().split("T")[0],
        duration_minutes: hours * 60 + minutes,
        quality_rating: quality,
      })
      toast.success("Sleep logged! 😴")
      setShowForm(false)
      loadRecords()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const latestSleep = records[0]
  const avgDuration = records.length > 0
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
            Track your sleep to discover mood–sleep correlations.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} icon={<Plus className="w-4 h-4" />}>
          Log Sleep
        </Button>
      </div>

      {/* Log Form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <Card variant="glow">
            <h3 className="text-sm font-bold text-foreground mb-4">Log Last Night&apos;s Sleep</h3>
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
                <span className="text-sm font-medium text-foreground mb-2 block">Quality Rating</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setQuality(star)}
                      className="text-2xl transition-colors"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= quality
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted fill-transparent"
                        }`}
                      />
                    </motion.button>
                  ))}
                </div>
              </div>
              <Button onClick={handleSave} isLoading={saving} className="w-full">
                Save Sleep Record
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="flex flex-col items-center py-8">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Last Night
          </span>
          {latestSleep ? (
            <SleepRingChart
              durationMinutes={latestSleep.duration_minutes}
              goalMinutes={480}
              qualityRating={latestSleep.quality_rating}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No sleep data yet</p>
          )}
        </Card>
        <Card className="flex flex-col items-center py-8">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Average Sleep
          </span>
          {avgDuration > 0 ? (
            <SleepRingChart
              durationMinutes={avgDuration}
              goalMinutes={480}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Log more nights</p>
          )}
        </Card>
      </div>

      {/* History */}
      <Card>
        <h3 className="text-sm font-bold text-foreground mb-4">Recent Records</h3>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No sleep records yet.</p>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 10).map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/50"
              >
                <span className="text-sm text-foreground font-medium">
                  {formatDate(rec.sleep_date)}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatMinutesToHours(rec.duration_minutes)}
                  </span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= rec.quality_rating ? "fill-amber-400 text-amber-400" : "text-muted"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  )
}

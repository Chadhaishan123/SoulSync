"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  LineChart as LineChartIcon,
  Calendar,
  Clock,
  Sparkles,
  Zap,
  Activity,
  Heart,
  FileText,
  Tag,
  Plus,
  TrendingUp,
} from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { SkeletonChart } from "@/components/ui/Skeleton"
import AnomalyAlert from "@/components/features/AnomalyAlert"
import TrendBanner from "@/components/features/TrendBanner"
import ClusterBadge from "@/components/features/ClusterBadge"
import MoodTrendChart from "@/components/charts/MoodTrendChart"
import { useAuth } from "@/context/AuthContext"
import { MOOD_EMOJIS } from "@/lib/constants"
import { formatDate, formatRelative } from "@/lib/formatters"
import type { DashboardData, MoodEntry } from "@/types/mood"

export default function InsightsPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [checkins, setCheckins] = useState<MoodEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [insights, entries] = await Promise.allSettled([
          api.insights.dashboard(),
          api.checkins.list(),
        ])

        if (insights.status === "fulfilled") setData(insights.value)

        // 1. Remote entries from backend
        const remoteList: MoodEntry[] =
          entries.status === "fulfilled" && Array.isArray(entries.value) ? entries.value : []

        // 2. Local entries from localStorage
        const localList: MoodEntry[] = []
        if (typeof window !== "undefined") {
          const keysToTry: string[] = ["soulsync_checkins", "soulsync_last_checkin"]
          if (user?.email) {
            const clean = user.email.trim().toLowerCase()
            keysToTry.unshift(`soulsync_checkins_${clean}`, `soulsync_last_checkin_${clean}`)
          }

          // Scan any other soulsync checkin keys
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.startsWith("soulsync_checkin") && !keysToTry.includes(k)) {
              keysToTry.push(k)
            }
          }

          for (const key of keysToTry) {
            try {
              const raw = localStorage.getItem(key)
              if (!raw) continue
              const parsed = JSON.parse(raw)
              if (Array.isArray(parsed)) {
                localList.push(...parsed)
              } else if (parsed && typeof parsed === "object" && parsed.mood_score) {
                localList.push(parsed)
              }
            } catch {}
          }
        }

        // 3. Deduplicate across remote and local records
        const combinedMap = new Map<string, MoodEntry>()
        for (const item of [...remoteList, ...localList]) {
          if (!item || !item.mood_score) continue
          const key = item.recorded_at || String(item.id) || String(item.local_date)
          if (!combinedMap.has(key)) {
            combinedMap.set(key, item)
          }
        }

        const merged = Array.from(combinedMap.values())
        // Sort descending (newest first for display)
        merged.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())

        setCheckins(merged)
      } catch {
        // graceful
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6 pb-12"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LineChartIcon className="w-6 h-6 text-soul-purple" />
            Insights & Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Machine learning analysis of your wellness data — K-Means clustering, Isolation Forest anomaly detection, and Random Forest trend prediction.
          </p>
        </div>
        <Link href="/dashboard/check-in">
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
            New Check-In
          </Button>
        </Link>
      </div>

      {/* Summary Row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Cluster */}
        <Card className="text-center py-6">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Behavioral Cluster (K-Means)
          </span>
          <div className="mt-3">
            <ClusterBadge
              pattern={data?.digital_twin?.current_pattern || "Balanced"}
              totalDays={data?.digital_twin?.total_days || checkins.length}
              size="lg"
            />
          </div>
          {data?.digital_twin?.clusters && (
            <div className="mt-4 space-y-1.5">
              {Object.entries(data.digital_twin.clusters).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-xs px-3">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="text-foreground font-medium">{count} days</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Trend */}
        <Card className="py-6">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Trend Prediction (Random Forest)
          </span>
          {data?.trend_prediction ? (
            <div className="mt-3">
              <TrendBanner trend={data.trend_prediction} />
            </div>
          ) : (
            <div className="mt-3 text-center py-2">
              <Badge variant="purple" size="sm">Baseline Building</Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Log consecutive check-ins to train trend forecasts.
              </p>
            </div>
          )}
        </Card>

        {/* Anomaly */}
        <Card className="py-6">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Anomaly Detection (Isolation Forest)
          </span>
          {data?.anomaly ? (
            data.anomaly.is_anomaly ? (
              <AnomalyAlert anomaly={data.anomaly} className="mt-3" />
            ) : (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">
                  No anomalies detected — within baseline
                </span>
              </div>
            )
          ) : (
            <div className="mt-3 text-center py-2">
              <Badge variant="default" size="sm">Stable Equilibrium</Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Nervous system within normal variance bounds.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Mood Trend Chart */}
      <Card>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground">Mood, Stress & Energy Over Time</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tracking {checkins.length} check-in{checkins.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] rounded-full bg-soul-purple" />
            <span className="text-[10px] text-muted-foreground font-medium">Mood</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] rounded-full bg-soul-teal" />
            <span className="text-[10px] text-muted-foreground font-medium">Energy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] rounded-full bg-soul-coral" />
            <span className="text-[10px] text-muted-foreground font-medium">Stress</span>
          </div>
        </div>
        <MoodTrendChart data={checkins} height={300} />
      </Card>

      {/* ── HISTORICAL CHECK-IN LOG ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-soul-teal" />
              Historical Check-In Log
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete archive of your past mood check-ins, sleep quality, and journaled context.
            </p>
          </div>
          <Badge variant="default" size="sm">
            {checkins.length} Total Record{checkins.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {checkins.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sm text-muted-foreground mb-3">
              No check-ins recorded yet. Log your first check-in to start tracking your mental wellness history!
            </p>
            <Link href="/dashboard/check-in">
              <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
                Record First Check-In
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {checkins.map((entry, idx) => {
              const moodMeta = MOOD_EMOJIS[entry.mood_score] || { emoji: "✨", label: "Good" }

              return (
                <motion.div
                  key={entry.id || entry.recorded_at || idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                >
                  <Card className="p-4 hover:border-soul-purple/40 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl" role="img" aria-label="Mood Emoji">
                          {moodMeta.emoji}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              Mood {entry.mood_score}/10 • {moodMeta.label}
                            </span>
                            {entry.primary_emotion && (
                              <Badge variant="purple" size="sm">
                                {entry.primary_emotion}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 text-muted-foreground/70" />
                            {formatDate(entry.recorded_at)} • {formatRelative(entry.recorded_at)}
                          </span>
                        </div>
                      </div>

                      {/* Vitals breakdown */}
                      <div className="flex items-center gap-3 text-xs">
                        {entry.energy_level !== undefined && entry.energy_level !== null && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-soul-teal/10 border border-soul-teal/20 text-soul-teal">
                            <Zap className="w-3 h-3" />
                            <span>Energy: {entry.energy_level}/10</span>
                          </div>
                        )}
                        {entry.stress_level !== undefined && entry.stress_level !== null && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-soul-coral/10 border border-soul-coral/20 text-soul-coral">
                            <Activity className="w-3 h-3" />
                            <span>Stress: {entry.stress_level}/10</span>
                          </div>
                        )}
                        {entry.sleep_quality !== undefined && entry.sleep_quality !== null && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <Heart className="w-3 h-3" />
                            <span>Sleep: {entry.sleep_quality}/10</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tags and Note */}
                    {((entry.context_tags && entry.context_tags.length > 0) || entry.note || entry.notes) && (
                      <div className="mt-3 space-y-2">
                        {entry.context_tags && entry.context_tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {entry.context_tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 border border-border/50 text-muted-foreground"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {(entry.note || entry.notes) && (
                          <p className="text-xs text-muted-foreground italic bg-muted/20 p-2.5 rounded-xl border border-border/30">
                            "{entry.note || entry.notes}"
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

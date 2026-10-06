"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { LineChart as LineChartIcon } from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import { SkeletonChart } from "@/components/ui/Skeleton"
import AnomalyAlert from "@/components/features/AnomalyAlert"
import TrendBanner from "@/components/features/TrendBanner"
import ClusterBadge from "@/components/features/ClusterBadge"
import MoodTrendChart from "@/components/charts/MoodTrendChart"
import type { DashboardData, MoodEntry } from "@/types/mood"

export default function InsightsPage() {
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
        if (entries.status === "fulfilled") setCheckins(entries.value)
      } catch {
        //
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
      className="max-w-4xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LineChartIcon className="w-6 h-6 text-soul-purple" />
          Insights & Analytics
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Machine learning analysis of your wellness data — K-Means clustering, Isolation Forest anomaly detection, and Random Forest trend prediction.
        </p>
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
              totalDays={data?.digital_twin?.total_days}
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
          {data?.trend_prediction && (
            <div className="mt-3">
              <TrendBanner trend={data.trend_prediction} />
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
                  No anomalies detected — you&apos;re within baseline
                </span>
              </div>
            )
          ) : null}
        </Card>
      </div>

      {/* Mood Trend Chart */}
      <Card>
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground">Mood, Stress & Energy Over Time</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tracking {checkins.length} check-ins
          </p>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] rounded-full bg-soul-purple" />
            <span className="text-[10px] text-muted-foreground">Mood</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] rounded-full bg-soul-teal" />
            <span className="text-[10px] text-muted-foreground">Energy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] rounded-full bg-soul-coral" />
            <span className="text-[10px] text-muted-foreground">Stress</span>
          </div>
        </div>
        <MoodTrendChart data={checkins} height={300} />
      </Card>
    </motion.div>
  )
}

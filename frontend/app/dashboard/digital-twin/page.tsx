"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Brain, Dna, Layers } from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import ProgressRing from "@/components/ui/ProgressRing"
import ClusterBadge from "@/components/features/ClusterBadge"
import DigitalTwinChat from "@/components/features/DigitalTwinChat"
import { SkeletonCard } from "@/components/ui/Skeleton"
import type { DashboardData } from "@/types/mood"

export default function DigitalTwinPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const insights = await api.insights.dashboard()
        setData(insights)
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
      <div className="max-w-3xl mx-auto space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const twin = data?.digital_twin
  const clusters = twin?.clusters || {}
  const totalDays = twin?.total_days || 0
  const pattern = twin?.current_pattern || "Balanced"

  const clusterEntries = Object.entries(clusters)
  const maxClusterDays = Math.max(...clusterEntries.map(([, v]) => v), 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Brain className="w-6 h-6 text-soul-purple" />
          Digital Twin
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your behavioral profile computed by K-Means clustering on daily wellness vectors (mood, stress, energy, sleep quality).
        </p>
      </div>

      {/* Hero Card */}
      <Card variant="glow" padding="lg">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Animated Orb */}
          <div className="relative">
            <motion.div
              className="w-40 h-40 rounded-full bg-gradient-to-br from-soul-purple/20 to-soul-teal/20 flex items-center justify-center"
              animate={{
                boxShadow: [
                  "0 0 30px rgba(124, 92, 252, 0.2)",
                  "0 0 60px rgba(124, 92, 252, 0.3)",
                  "0 0 30px rgba(124, 92, 252, 0.2)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                className="w-28 h-28 rounded-full bg-gradient-to-br from-soul-purple/30 to-soul-teal/30 flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center shadow-glow">
                  <Dna className="w-8 h-8 text-white" />
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Info */}
          <div className="text-center md:text-left space-y-3">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <Badge variant="purple" size="sm">Active Profile</Badge>
            </div>
            <ClusterBadge pattern={pattern} totalDays={totalDays} size="lg" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Based on <strong className="text-foreground">{totalDays}</strong> wellness vectors
              mapped across {clusterEntries.length} behavioral clusters.
            </p>
          </div>
        </div>
      </Card>

      {/* Cluster Distribution */}
      <Card>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-soul-purple" />
          Cluster Distribution
        </h3>
        <div className="space-y-4">
          {clusterEntries.map(([name, days], i) => {
            const percent = totalDays > 0 ? (days / totalDays) * 100 : 0
            const isActive = name === pattern
            const colors: Record<string, string> = {
              Balanced: "bg-emerald-500",
              "High-Stress": "bg-red-500",
              "Low-Energy": "bg-amber-500",
              Recovery: "bg-blue-500",
            }

            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors[name] || "bg-soul-purple"}`} />
                    <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {name}
                    </span>
                    {isActive && <Badge variant="purple" size="sm">Current</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {days} days ({Math.round(percent)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                    className={`h-full rounded-full ${colors[name] || "bg-soul-purple"} ${
                      isActive ? "shadow-glow-sm" : ""
                    }`}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </Card>

      {/* Conversational Digital Twin */}
      <DigitalTwinChat currentPattern={pattern} totalDays={totalDays} />

      {/* ML Explainer */}
      <Card className="text-center py-8">
        <div className="w-12 h-12 rounded-xl bg-soul-purple/10 flex items-center justify-center mx-auto mb-4">
          <Brain className="w-6 h-6 text-soul-purple" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">How It Works</h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Each day you check in, SoulSync creates a 4-dimensional wellness vector
          (mood, stress, energy, sleep quality). K-Means clustering groups these
          vectors into behavioral profiles. As you log more data, your Digital Twin
          becomes increasingly accurate and personalized.
        </p>
      </Card>
    </motion.div>
  )
}

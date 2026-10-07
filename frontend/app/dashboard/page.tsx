"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Smile, ArrowRight, CheckCircle2, Award, MessageSquare, BookOpen, Moon, Sparkles, HeartHandshake, CalendarCheck } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import Card, { CardHeader, CardTitle } from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { SkeletonCard } from "@/components/ui/Skeleton"
import AnomalyAlert from "@/components/features/AnomalyAlert"
import TrendBanner from "@/components/features/TrendBanner"
import ClusterBadge from "@/components/features/ClusterBadge"
import EmotionalAura from "@/components/features/EmotionalAura"
import MindWeatherSimulator from "@/components/features/MindWeatherSimulator"
import StressEnergyGauge from "@/components/charts/StressEnergyGauge"
import { EMOTION_EMOJIS, MOOD_EMOJIS } from "@/lib/constants"
import { formatDate } from "@/lib/formatters"
import type { DashboardData } from "@/types/mood"
import type { Recommendation } from "@/types/activity"
import EnvironmentLiveWidget from "@/components/features/EnvironmentLiveWidget"
import toast from "react-hot-toast"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [insightData, recData] = await Promise.allSettled([
        api.insights.dashboard(),
        api.recommendations.list(),
      ])
      if (insightData.status === "fulfilled") setData(insightData.value)
      if (recData.status === "fulfilled") setRecs(recData.value)
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleFeedback = async (recId: number) => {
    try {
      await api.recommendations.feedback(recId, "👍 Helpful")
      toast.success("Activity completed!")
      fetchData()
    } catch {
      toast.error("Failed to record feedback")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  const metrics = data?.weather?.latest_metrics
  const moodEmoji = metrics?.mood ? MOOD_EMOJIS[metrics.mood]?.emoji : "—"
  const emotionEmoji = metrics?.primary_emotion ? EMOTION_EMOJIS[metrics.primary_emotion] : ""

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-card via-card to-secondary/30 p-5 rounded-2xl border border-border/60">
        <div className="flex items-center gap-4">
          <EmotionalAura
            dominantEmotion={(metrics?.primary_emotion as any) || "Calm"}
            size="sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">
                Welcome back, {user?.name?.split(" ")[0] || "there"} 👋
              </h2>
              <Badge variant="accent" size="sm">Living Aura</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Here&apos;s your wellness overview for {formatDate(new Date().toISOString())}
            </p>
          </div>
        </div>
        <Link href="/dashboard/check-in">
          <Button icon={<Smile className="w-4 h-4" />}>
            Daily Check-In
          </Button>
        </Link>
      </motion.div>

      {/* Real-Time Environment Tracking Widget */}
      <motion.div variants={itemVariants}>
        <EnvironmentLiveWidget />
      </motion.div>

      {/* Top Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Emotional Weather */}
        <motion.div variants={itemVariants}>
          <Card variant="interactive" className="h-full">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Today&apos;s Emotional Weather
            </span>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-4xl">{data?.weather?.state?.split(" ")[0]}</span>
              <span className="text-lg font-bold text-foreground">
                {data?.weather?.state?.split(" ").slice(1).join(" ")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">
              &ldquo;{data?.weather?.forecast}&rdquo;
            </p>
            {metrics ? (
              <div className="grid grid-cols-4 gap-2 text-center border-t border-border pt-3 mt-4 text-xs">
                <div>
                  <p className="font-bold text-foreground">{moodEmoji} {metrics.mood}</p>
                  <p className="text-muted-foreground">Mood</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">{metrics.stress}/10</p>
                  <p className="text-muted-foreground">Stress</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">{metrics.energy}/10</p>
                  <p className="text-muted-foreground">Energy</p>
                </div>
                <div>
                  <p className="font-bold text-foreground">{emotionEmoji}</p>
                  <p className="text-muted-foreground">{metrics.primary_emotion}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground border-t border-border pt-3 mt-4">
                No check-in today.{" "}
                <Link href="/dashboard/check-in" className="text-soul-purple font-semibold">Log now →</Link>
              </p>
            )}
          </Card>
        </motion.div>

        {/* Card 2: Trend Prediction */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Wellness Trend Prediction
            </span>
            {data?.trend_prediction && (
              <div className="mt-3">
                <TrendBanner trend={data.trend_prediction} />
              </div>
            )}
            {metrics && (
              <div className="mt-4">
                <StressEnergyGauge stress={metrics.stress} energy={metrics.energy} />
              </div>
            )}
            <Link
              href="/dashboard/insights"
              className="flex items-center gap-1 text-xs font-semibold text-soul-purple hover:text-soul-purple-light mt-4 transition-colors"
            >
              Explore Charts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Card>
        </motion.div>

        {/* Card 3: Digital Twin */}
        <motion.div variants={itemVariants}>
          <Card variant="glow" className="h-full">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              SoulSync Digital Twin
            </span>
            <div className="mt-3 flex items-center gap-3">
              <ClusterBadge
                pattern={data?.digital_twin?.current_pattern || "Balanced"}
                totalDays={data?.digital_twin?.total_days}
                size="lg"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Mapped based on <strong className="text-foreground">{data?.digital_twin?.total_days || 0}</strong> recorded wellness vectors.
            </p>
            <Link
              href="/dashboard/digital-twin"
              className="flex items-center gap-1 text-xs font-semibold text-soul-purple hover:text-soul-purple-light mt-4 transition-colors"
            >
              Open Twin Visualization <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Card>
        </motion.div>
      </div>

      {/* Novelty: Mind Weather & What-If Simulator */}
      <motion.div variants={itemVariants}>
        <MindWeatherSimulator initialWeather={data?.weather} />
      </motion.div>

      {/* Anomaly Alert */}
      {data?.anomaly && <AnomalyAlert anomaly={data.anomaly} />}

      {/* Bottom: Recommendations + Quick Links */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recommendations */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card padding="lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-soul-purple" />
                Recommended Wellness Actions
              </CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {recs.length > 0 ? (
                recs.slice(0, 4).map((rec) => (
                  <div
                    key={rec.id}
                    className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-xl border transition-all ${
                      rec.feedback
                        ? "border-border/50 bg-muted/30 opacity-60"
                        : "border-border hover:border-soul-purple/30 bg-card"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="purple" size="sm">{rec.activity.category}</Badge>
                        <span className="text-[10px] text-muted-foreground">{rec.activity.duration_minutes} min</span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground">{rec.activity.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                    </div>
                    {rec.feedback ? (
                      <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>Done</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleFeedback(rec.id)}>
                        Complete ✓
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Complete a daily check-in to receive personalized recommendations.
                </p>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {[
                { href: "/dashboard/journal",      icon: BookOpen,        label: "Write Journal Entry",  color: "text-soul-teal" },
                { href: "/dashboard/sleep",        icon: Moon,            label: "Live Sleep Tracker",   color: "text-indigo-400" },
                { href: "/dashboard/dreams",       icon: Sparkles,        label: "Analyze Dream",        color: "text-purple-400" },
                { href: "/dashboard/companion",    icon: MessageSquare,   label: "AI Companion",         color: "text-soul-coral" },
                { href: "/dashboard/therapist",    icon: HeartHandshake,  label: "Digital Therapist",    color: "text-teal-400" },
                { href: "/dashboard/appointments", icon: CalendarCheck,   label: "Book a Doctor",        color: "text-amber-400" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border hover:border-soul-purple/30 hover:bg-secondary/50 transition-all group"
                >
                  <action.icon className={`w-4 h-4 ${action.color}`} />
                  <span className="text-sm font-medium text-foreground group-hover:text-soul-purple transition-colors">
                    {action.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto group-hover:translate-x-1 transition-transform" />
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}

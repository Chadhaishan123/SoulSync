"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import DashboardLayout from "../../components/DashboardLayout"
import { Sparkles, AlertTriangle, ArrowRight, CheckCircle2, Award, Smile } from "lucide-react"
import { motion } from "framer-motion"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { type: "spring", stiffness: 100, damping: 15 } 
  }
}

interface DashboardData {
  weather: {
    state: string
    forecast: string
    latest_metrics?: {
      mood: number
      stress: number
      energy: number
      sleep_quality: number
      primary_emotion: string
    }
  }
  digital_twin: {
    current_pattern: string
    clusters: Record<string, number>
    total_days: number
  }
  trend_prediction: {
    value: string
    confidence: number
    explanation: string
  }
  anomaly: {
    is_anomaly: boolean
    score: number
    message: string
  }
  latest_journal_emotion: string
}

interface Recommendation {
  id: number
  activity_id: number
  reason: string
  recommendation_score: number
  feedback?: string
  activity: {
    name: string
    category: string
    description: string
    duration_minutes: number
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<Record<number, boolean>>({})

  const fetchData = async () => {
    const token = localStorage.getItem("token")
    if (!token) return

    try {
      // 1. Fetch dashboard insights
      const insightRes = await fetch("http://localhost:8000/api/insights/dashboard", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (insightRes.status === 200) {
        const insightData = await insightRes.json()
        setData(insightData)
      }

      // 2. Fetch recommendations
      const recRes = await fetch("http://localhost:8000/api/recommendations", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (recRes.status === 200) {
        const recData = await recRes.json()
        setRecs(recData)
      }
    } catch (err) {
      console.error("Failed to load dashboard statistics:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleFeedback = async (recId: number, feedbackType: string) => {
    const token = localStorage.getItem("token")
    setCompleting(prev => ({ ...prev, [recId]: true }))
    try {
      const res = await fetch(`http://localhost:8000/api/recommendations/${recId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ feedback: feedbackType })
      })
      if (res.status === 200) {
        // Refresh dashboard data and activities
        fetchData()
      }
    } catch (err) {
      console.error("Feedback submission error:", err)
    } finally {
      setCompleting(prev => ({ ...prev, [recId]: false }))
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-gray-500 font-medium">Synchronizing with your data...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <motion.div 
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        
        {/* Welcome Section */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200"
        >
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Daily Overview</h2>
            <p className="text-gray-500 text-sm mt-0.5">Explore your behavioral clusters and self-reflection logs.</p>
          </div>
          <Link
            href="/dashboard/check-in"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-colors text-sm"
          >
            <Smile className="w-4 h-4" />
            Complete Daily Check-In
          </Link>
        </motion.div>

        {/* Top Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Emotional Weather */}
          <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today's Emotional Weather</span>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-4xl">{data?.weather?.state.split(" ")[0]}</span>
                <span className="text-xl font-bold text-gray-800">{data?.weather?.state.split(" ").slice(1).join(" ")}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                "{data?.weather?.forecast}"
              </p>
            </div>
            {data?.weather?.latest_metrics ? (
              <div className="grid grid-cols-4 gap-2 text-center border-t border-gray-100 pt-3 text-xs">
                <div>
                  <p className="font-bold text-gray-800">{data.weather.latest_metrics.mood}/10</p>
                  <p className="text-gray-400">Mood</p>
                </div>
                <div>
                  <p className="font-bold text-gray-800">{data.weather.latest_metrics.stress}/10</p>
                  <p className="text-gray-400">Stress</p>
                </div>
                <div>
                  <p className="font-bold text-gray-800">{data.weather.latest_metrics.energy}/10</p>
                  <p className="text-gray-400">Energy</p>
                </div>
                <div>
                  <p className="font-bold text-gray-800">{data.weather.latest_metrics.primary_emotion}</p>
                  <p className="text-gray-400">Emotion</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">No check-in logged for today.</p>
            )}
          </motion.div>

          {/* Card 2: Recent Trend */}
          <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Wellness Trend Prediction</span>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                  data?.trend_prediction?.value === "Improving" 
                    ? "bg-green-50 text-green-700" 
                    : data?.trend_prediction?.value === "Declining" 
                      ? "bg-red-50 text-red-700" 
                      : "bg-blue-50 text-blue-700"
                }`}>
                  {data?.trend_prediction?.value} Trend
                </span>
                <span className="text-xs text-gray-400">
                  Confidence: {Math.round((data?.trend_prediction?.confidence || 0) * 100)}%
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {data?.trend_prediction?.explanation}
              </p>
            </div>
            <Link href="/dashboard/insights" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Explore History Charts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          {/* Card 3: Digital Twin Cluster */}
          <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-4 md:col-span-2 lg:col-span-1">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">SoulSync Digital Twin Profile</span>
              <h3 className="text-lg font-bold text-gray-800 mt-2">{data?.digital_twin?.current_pattern || "Balanced Pattern"}</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Mapped based on {data?.digital_twin?.total_days || 0} recorded daily wellness vectors.
              </p>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <Link href="/dashboard/digital-twin" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Open Twin Visualization <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>

        </div>

        {/* Anomaly Alerts */}
        {data?.anomaly?.is_anomaly && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-800">Unusual Deviation Detected</h4>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">{data.anomaly.message}</p>
            </div>
          </div>
        )}

        {/* Bottom Section: Recommendations & Check-In */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Recommendations List */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 lg:col-span-2 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Recommended Wellness Actions
            </h3>
            
            <div className="space-y-4">
              {recs.length > 0 ? (
                recs.map(rec => (
                  <div 
                    key={rec.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      rec.feedback 
                        ? "border-gray-100 bg-gray-50/50" 
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {rec.activity.category}
                          </span>
                          <span className="text-xs text-gray-400">
                            {rec.activity.duration_minutes} min
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 mt-1">{rec.activity.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rec.activity.description}</p>
                        <p className="text-xs text-blue-600 italic mt-1.5 leading-relaxed">Reason: "{rec.reason}"</p>
                      </div>
                      
                      <div className="shrink-0 flex items-center gap-2">
                        {rec.feedback ? (
                          <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                            Completed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleFeedback(rec.id, "👍 Helpful")}
                            disabled={completing[rec.id]}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
                          >
                            {completing[rec.id] ? "Recording..." : "Done 👍"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 py-4 text-center">No recommendations available. Complete a daily check-in to get suggestions.</p>
              )}
            </div>
          </div>

          {/* Quick-links Panel */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Wellness Companion</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Have questions about your patterns? Discuss them with your local companion for general reflection and support.
            </p>
            <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Prompt Idea</span>
              <p className="text-xs text-gray-600 italic leading-relaxed">
                "Why has my mood been lower recently?"
              </p>
            </div>
            <Link
              href="/dashboard/companion"
              className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
            >
              Chat With Companion
            </Link>
          </div>

        </div>

      </motion.div>
    </DashboardLayout>
  )
}

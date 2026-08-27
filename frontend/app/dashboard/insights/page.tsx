"use client"

import React, { useEffect, useState } from "react"
import DashboardLayout from "../../../components/DashboardLayout"
import { motion } from "framer-motion"
import { 
  LineChart as ReChartsLine, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts"
import { Info, HelpCircle } from "lucide-react"

interface HistoryItem {
  id: number
  date: string
  mood: number
  stress: number
  energy: number
  sleep_quality: number
  emotion: string
  tags: string[]
}

interface CorrelationItem {
  pattern_type: string
  description: string
  confidence_score: number
}

interface SleepVsMoodItem {
  sleep_range: string
  avg_mood: number
  supporting_days: number
}

export default function InsightsPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [patterns, setPatterns] = useState<CorrelationItem[]>([])
  const [sleepVsMood, setSleepVsMood] = useState<SleepVsMoodItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const token = localStorage.getItem("token")
    
    const fetchInsights = async () => {
      try {
        const historyRes = await fetch("http://localhost:8000/api/moods/history", {
          headers: { "Authorization": `Bearer ${token}` }
        })
        if (historyRes.status === 200) {
          setHistory(await historyRes.json())
        }

        const patternsRes = await fetch("http://localhost:8000/api/insights/patterns", {
          headers: { "Authorization": `Bearer ${token}` }
        })
        if (patternsRes.status === 200) {
          const patData = await patternsRes.json()
          setPatterns(patData.patterns)
          setSleepVsMood(patData.sleep_vs_mood)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchInsights()
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-gray-500 text-center font-medium py-10">Compiling historical charts...</p>
      </DashboardLayout>
    )
  }

  const totalDays = history.length

  return (
    <DashboardLayout>
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-8"
      >
        
        {/* Intro */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Pattern Explorer</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Interactively explore your logged timeline. This pattern mapping is compiled from your last {totalDays} recorded days.
          </p>
        </div>

        {/* Timeline Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Mood & Stress Timeline */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-base">Mood vs. Stress Timeline</h3>
            <div className="h-[280px] w-full">
              {isClient && history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ReChartsLine data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                    <YAxis domain={[1, 10]} stroke="#9ca3af" fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="mood" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Mood" />
                    <Line type="monotone" dataKey="stress" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Stress" />
                  </ReChartsLine>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400">No data points logged yet.</div>
              )}
            </div>
          </div>

          {/* Energy & Sleep Quality Timeline */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-base">Energy vs. Sleep Quality Timeline</h3>
            <div className="h-[280px] w-full">
              {isClient && history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ReChartsLine data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                    <YAxis domain={[1, 10]} stroke="#9ca3af" fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="energy" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} name="Energy" />
                    <Line type="monotone" dataKey="sleep_quality" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Sleep Quality" />
                  </ReChartsLine>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400">No data points logged yet.</div>
              )}
            </div>
          </div>

        </div>

        {/* Pattern Explorer: Sleep vs Mood */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Correlation explanation & list */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 lg:col-span-1">
            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Observed Patterns
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              These correlations represent mathematical connections detected in your self-reported inputs over time and do not establish clinical causality.
            </p>
            <div className="space-y-4 pt-2">
              {patterns.length > 0 ? (
                patterns.map((pat, idx) => (
                  <div key={idx} className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/60 space-y-1.5">
                    <span className="text-[10px] font-bold text-blue-700 uppercase bg-blue-100 px-2 py-0.5 rounded">
                      Confidence: {Math.round(pat.confidence_score * 100)}%
                    </span>
                    <p className="text-xs font-semibold text-blue-900 leading-relaxed">
                      {pat.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 py-4 text-center">Logging at least 10 entries is required to compile patterns.</p>
              )}
            </div>
          </div>

          {/* Sleep vs Mood Bar Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 lg:col-span-2">
            <div>
              <h3 className="font-bold text-gray-800 text-base">Sleep Duration vs. Average Mood</h3>
              <p className="text-xs text-gray-400 mt-0.5">Explore average mood scores mapped against categories of sleep durations.</p>
            </div>
            <div className="h-[250px] w-full">
              {isClient && sleepVsMood.some(x => x.supporting_days > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sleepVsMood} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="sleep_range" stroke="#9ca3af" fontSize={10} />
                    <YAxis domain={[0, 10]} stroke="#9ca3af" fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="avg_mood" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Average Mood" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400">
                  Insufficient data. Log both daily check-ins and sleep records to compile sleep-mood correlation charts.
                </div>
              )}
            </div>
          </div>

        </div>

      </motion.div>
    </DashboardLayout>
  )
}

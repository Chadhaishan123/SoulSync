"use client"

import React, { useEffect, useState } from "react"
import DashboardLayout from "@/components/DashboardLayout"
import { Moon, Calendar, Info, Clock } from "lucide-react"

interface SleepTrendItem {
  date: string
  hours: number
  quality: number
}

interface SleepSummary {
  avg_sleep_3d_hours: number
  avg_sleep_7d_hours: number
  sleep_consistency: string
  sleep_quality_trend: SleepTrendItem[]
}

interface SleepRecord {
  id: number
  sleep_duration_minutes: number
  bedtime: string
  wake_time: string
  sleep_quality: number
  recorded_date: string
}

export default function SleepPage() {
  const [summary, setSummary] = useState<SleepSummary | null>(null)
  const [records, setRecords] = useState<SleepRecord[]>([])
  const [bedtime, setBedtime] = useState("")
  const [wakeTime, setWakeTime] = useState("")
  const [quality, setQuality] = useState(6)
  const [logDate, setLogDate] = useState("")
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const fetchData = async () => {
    const token = localStorage.getItem("token")
    try {
      const summaryRes = await fetch("http://localhost:8000/api/sleep/summary", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (summaryRes.status === 200) {
        setSummary(await summaryRes.json())
      }

      const recordsRes = await fetch("http://localhost:8000/api/sleep", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (recordsRes.status === 200) {
        setRecords(await recordsRes.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Set default date to today
    setLogDate(new Date().toISOString().split("T")[0])
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bedtime || !wakeTime || !logDate) return

    setSaving(true)
    setError("")
    const token = localStorage.getItem("token")

    try {
      // Calculate sleep duration in minutes
      const bed = new Date(`${logDate}T${bedtime}`)
      let wake = new Date(`${logDate}T${wakeTime}`)
      
      // If wake time is earlier than bedtime, assume it's next day
      if (wake < bed) {
        wake = new Date(wake.getTime() + 24 * 60 * 60 * 1000)
      }
      
      const diffMs = wake.getTime() - bed.getTime()
      const durationMin = Math.round(diffMs / (1000 * 60))

      const res = await fetch("http://localhost:8000/api/sleep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          sleep_duration_minutes: durationMin,
          bedtime: bed.toISOString(),
          wake_time: wake.toISOString(),
          sleep_quality: quality,
          recorded_date: logDate
        })
      })

      if (res.status === 200) {
        setBedtime("")
        setWakeTime("")
        fetchData()
      } else {
        const data = await res.json()
        setError(data.detail || "Failed to log sleep record.")
      }
    } catch (err) {
      console.error(err)
      setError("Network error connecting to backend.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-gray-500 text-center font-medium py-10">Syncing sleep records...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Log Sleep Form & History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Form */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <Moon className="w-5 h-5 text-blue-600" />
              Log Sleep Duration
            </h3>
            
            {error && (
              <div className="bg-red-50 text-red-700 text-xs px-4 py-2.5 rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Sleep Date</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Sleep Quality</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {[...Array(10)].map((_, i) => (
                    <option key={i+1} value={i+1}>{i+1} - {i+1 <= 3 ? "Restless" : i+1 <= 7 ? "Fair" : "Deep"}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Bedtime (Time)</label>
                <input
                  type="time"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Wake Time (Time)</label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2 flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-6 py-2.5 rounded-lg text-sm shadow-sm transition-colors"
                >
                  {saving ? "Saving..." : "Log Sleep Entry"}
                </button>
              </div>
            </form>
          </div>

          {/* Previous Logs Table */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Sleep Logs History</h3>
            <div className="max-h-[300px] overflow-y-auto pr-2">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-400 uppercase bg-gray-50/50">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Duration</th>
                    <th className="py-3 px-4 font-semibold">Bedtime → Wake</th>
                    <th className="py-3 px-4 font-semibold text-right">Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.length > 0 ? (
                    records.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50/40">
                        <td className="py-3 px-4 font-medium text-gray-900">{record.recorded_date}</td>
                        <td className="py-3 px-4">
                          {Math.floor(record.sleep_duration_minutes / 60)}h {record.sleep_duration_minutes % 60}m
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {new Date(record.bedtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} →{" "}
                          {new Date(record.wake_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-800 text-right">{record.sleep_quality}/10</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400 text-xs">No sleep logs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Sidebar Summary Stats */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 sticky top-6">
            <h3 className="font-bold text-gray-800 text-lg">Sleep Insights</h3>
            
            {/* 3-day average */}
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">3-Day Average Hours</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-blue-600">
                  {summary?.avg_sleep_3d_hours || 0}
                </span>
                <span className="text-sm font-semibold text-gray-500">hours</span>
              </div>
            </div>

            {/* 7-day average */}
            <div className="space-y-1 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">7-Day Average Hours</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-indigo-600">
                  {summary?.avg_sleep_7d_hours || 0}
                </span>
                <span className="text-sm font-semibold text-gray-500">hours</span>
              </div>
            </div>

            {/* Sleep consistency */}
            <div className="space-y-1 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Sleep Consistency</p>
              <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mt-1 ${
                summary?.sleep_consistency === "High Consistency"
                  ? "bg-green-50 text-green-700"
                  : summary?.sleep_consistency === "Moderate Consistency"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-amber-50 text-amber-700"
              }`}>
                {summary?.sleep_consistency || "Insufficient Data"}
              </span>
            </div>

            {/* Information Card */}
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/60 flex gap-2.5 text-xs text-blue-800 leading-relaxed">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p>
                Sleep consistency tracks how stable your daily rest duration is. Keeping a consistent bedtime range is strongly correlated with higher daytime energy scores.
              </p>
            </div>

          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}

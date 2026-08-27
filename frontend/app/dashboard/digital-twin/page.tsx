"use client"

import React, { useEffect, useState } from "react"
import DashboardLayout from "../../../components/DashboardLayout"
import { motion } from "framer-motion"
import { Brain, ShieldAlert, Activity, Sparkles } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

interface TwinData {
  current_pattern: string
  clusters: Record<string, number>
  total_days: number
}

export default function DigitalTwinPage() {
  const [twin, setTwin] = useState<TwinData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const token = localStorage.getItem("token")
    
    const fetchTwin = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/insights/dashboard", {
          headers: { "Authorization": `Bearer ${token}` }
        })
        if (res.status === 200) {
          const data = await res.json()
          setTwin(data.digital_twin)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchTwin()
  }, [])

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-gray-500 text-center font-medium py-10">Synchronizing digital twin profile...</p>
      </DashboardLayout>
    )
  }

  // Format cluster data for recharts
  const chartData = twin 
    ? Object.keys(twin.clusters).map(key => ({
        pattern: key.replace(" Pattern", ""),
        days: twin.clusters[key]
      }))
    : []

  return (
    <DashboardLayout>
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-8"
      >
        
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-7 h-7 text-blue-100" />
              SoulSync Digital Twin
            </h2>
            <p className="text-blue-100 text-sm max-w-xl">
              Your digital twin is a dynamic mathematical modeling of your self-reported mood, sleep, stress, and habits. It clusters your logs to identify recurring states.
            </p>
          </div>
          <div className="bg-white/10 px-5 py-3 rounded-xl border border-white/10 shrink-0">
            <p className="text-xs text-blue-200">Current Behavioral State</p>
            <p className="text-lg font-bold">{twin?.current_pattern || "Balanced Pattern"}</p>
          </div>
        </div>

        {/* Core Layout Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Cluster Frequency Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 lg:col-span-2">
            <h3 className="font-bold text-gray-800 text-base">Behavioral Clusters Distribution</h3>
            <p className="text-xs text-gray-400">Days spent in each pattern according to K-Means clustering.</p>
            
            <div className="h-[250px] w-full pt-4">
              {isClient && twin && twin.total_days > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="pattern" stroke="#9ca3af" fontSize={10} />
                    <YAxis stroke="#9ca3af" fontSize={10} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="days" fill="#6366f1" radius={[4, 4, 0, 0]} name="Days" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-400">
                  Insufficient data. Log at least 5 check-ins to build cluster distributions.
                </div>
              )}
            </div>
          </div>

          {/* Twin Disclaimers & Explanations */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <h3 className="font-bold text-gray-800 text-base">State Profiles</h3>
            
            <div className="space-y-4 text-xs">
              <div className="flex gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-gray-800">Balanced Pattern</h4>
                  <p className="text-gray-500 mt-0.5">High self-reported mood, low stress, and steady sleep scores.</p>
                </div>
              </div>

              <div className="flex gap-3 border-t border-gray-100 pt-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-gray-800">High-Stress Pattern</h4>
                  <p className="text-gray-500 mt-0.5">Elevated stress levels accompanied by lower sleep quality ratings.</p>
                </div>
              </div>

              <div className="flex gap-3 border-t border-gray-100 pt-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-gray-800">Low-Energy Pattern</h4>
                  <p className="text-gray-500 mt-0.5">Characterized by lower self-reported energy alongside shorter sleep durations.</p>
                </div>
              </div>

              <div className="flex gap-3 border-t border-gray-100 pt-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-gray-800">Recovery Pattern</h4>
                  <p className="text-gray-500 mt-0.5">Self-reported scores show improvements coming out of stressful periods.</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-2.5 text-xs text-amber-800 leading-relaxed">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <p>
                <strong>Important:</strong> These profiles are machine-generated clusters of your behavior, not psychiatric labels or diagnoses.
              </p>
            </div>
          </div>

        </div>

      </motion.div>
    </DashboardLayout>
  )
}

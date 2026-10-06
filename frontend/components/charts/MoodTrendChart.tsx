"use client"

import React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatShortDate } from "@/lib/formatters"
import type { MoodEntry } from "@/types/mood"

interface MoodTrendChartProps {
  data: MoodEntry[]
  height?: number
  className?: string
}

export default function MoodTrendChart({ data, height = 250, className = "" }: MoodTrendChartProps) {
  const chartData = data.map((entry) => ({
    date: formatShortDate(entry.recorded_at),
    mood: entry.mood_score,
    stress: entry.stress_level,
    energy: entry.energy_level,
  }))

  if (chartData.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] text-sm text-muted-foreground ${className}`}>
        No mood data yet. Complete a daily check-in to see trends.
      </div>
    )
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c5cfc" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7c5cfc" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff6b8a" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ff6b8a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 15%, 14%)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "hsl(240, 10%, 50%)" }}
            axisLine={{ stroke: "hsl(240, 15%, 14%)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 11, fill: "hsl(240, 10%, 50%)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(240, 18%, 8%)",
              border: "1px solid hsl(256, 40%, 20%)",
              borderRadius: "12px",
              fontSize: "12px",
              color: "hsl(240, 10%, 92%)",
            }}
          />
          <Area
            type="monotone"
            dataKey="mood"
            stroke="#7c5cfc"
            strokeWidth={2}
            fill="url(#moodGradient)"
            dot={{ fill: "#7c5cfc", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#7c5cfc", stroke: "#fff", strokeWidth: 2 }}
            animationDuration={1200}
          />
          <Area
            type="monotone"
            dataKey="energy"
            stroke="#00d4aa"
            strokeWidth={1.5}
            fill="url(#energyGradient)"
            dot={false}
            animationDuration={1400}
          />
          <Area
            type="monotone"
            dataKey="stress"
            stroke="#ff6b8a"
            strokeWidth={1.5}
            fill="url(#stressGradient)"
            dot={false}
            animationDuration={1600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

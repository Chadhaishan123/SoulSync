"use client"

import React from "react"
import ProgressRing from "@/components/ui/ProgressRing"
import { formatMinutesToHours } from "@/lib/formatters"

interface SleepRingChartProps {
  durationMinutes: number
  goalMinutes: number
  qualityRating?: number
  className?: string
}

export default function SleepRingChart({
  durationMinutes,
  goalMinutes,
  qualityRating,
  className = "",
}: SleepRingChartProps) {
  const percent = Math.min((durationMinutes / goalMinutes) * 100, 100)
  const durationStr = formatMinutesToHours(durationMinutes)
  const goalStr = formatMinutesToHours(goalMinutes)

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <ProgressRing
        value={percent}
        max={100}
        size={140}
        strokeWidth={10}
        label={durationStr}
        sublabel={`of ${goalStr} goal`}
        color={percent >= 90 ? "#00d4aa" : percent >= 60 ? "#7c5cfc" : "#ff6b8a"}
      />
      {qualityRating !== undefined && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`text-sm ${star <= qualityRating ? "text-amber-400" : "text-muted"}`}
            >
              ★
            </span>
          ))}
          <span className="text-xs text-muted-foreground ml-1">Quality</span>
        </div>
      )}
    </div>
  )
}

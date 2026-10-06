"use client"

import React from "react"
import { motion } from "framer-motion"

interface StressEnergyGaugeProps {
  stress: number
  energy: number
  max?: number
  className?: string
}

function GaugeArc({
  value,
  max,
  color,
  label,
  icon,
}: {
  value: number
  max: number
  color: string
  label: string
  icon: string
}) {
  const percent = (value / max) * 100
  const angle = (percent / 100) * 180 // 0-180 degree arc

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-14 overflow-hidden">
        {/* Background arc */}
        <svg viewBox="0 0 100 55" className="w-full h-full">
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke="hsl(240, 15%, 14%)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <motion.path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="141.37"
            initial={{ strokeDashoffset: 141.37 }}
            animate={{ strokeDashoffset: 141.37 - (141.37 * percent) / 100 }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <span className="text-lg font-bold text-foreground tabular-nums">{value}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span>{icon}</span>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
    </div>
  )
}

export default function StressEnergyGauge({
  stress,
  energy,
  max = 10,
  className = "",
}: StressEnergyGaugeProps) {
  return (
    <div className={`flex items-center justify-center gap-8 ${className}`}>
      <GaugeArc value={stress} max={max} color="#ff6b8a" label="Stress" icon="🔥" />
      <GaugeArc value={energy} max={max} color="#00d4aa" label="Energy" icon="⚡" />
    </div>
  )
}

"use client"

import React from "react"
import { motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"
import type { DashboardAnomaly } from "@/types/mood"

interface AnomalyAlertProps {
  anomaly: DashboardAnomaly
  className?: string
}

export default function AnomalyAlert({ anomaly, className = "" }: AnomalyAlertProps) {
  if (!anomaly.is_anomaly) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`
        relative overflow-hidden rounded-xl border border-amber-500/20
        bg-amber-500/5 p-4 ${className}
      `}
    >
      {/* Pulse ring */}
      <div className="absolute top-4 left-4">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
        </span>
      </div>

      <div className="flex items-start gap-3 pl-6">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-400">Unusual Deviation Detected</h4>
          <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">{anomaly.message}</p>
          <p className="text-[10px] text-amber-400/60 mt-2">
            Anomaly score: {anomaly.score.toFixed(3)} · Detected by Isolation Forest
          </p>
        </div>
      </div>
    </motion.div>
  )
}

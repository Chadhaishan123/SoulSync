"use client"

import React from "react"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { TREND_CONFIG } from "@/lib/constants"
import { formatPercent } from "@/lib/formatters"
import type { DashboardTrend } from "@/types/mood"

interface TrendBannerProps {
  trend: DashboardTrend
  className?: string
}

export default function TrendBanner({ trend, className = "" }: TrendBannerProps) {
  const config = TREND_CONFIG[trend.value] || TREND_CONFIG.Stable
  const Icon = trend.value === "Improving" ? TrendingUp
             : trend.value === "Declining" ? TrendingDown
             : Minus

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl
        ${config.bgColor} border border-current/10 ${className}
      `}
    >
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className={`w-5 h-5 ${config.color}`} />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${config.color}`}>
            {trend.value} Trend
          </span>
          <span className="text-xs text-muted-foreground">
            · {formatPercent(trend.confidence)} confidence
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {trend.explanation}
        </p>
      </div>
    </motion.div>
  )
}

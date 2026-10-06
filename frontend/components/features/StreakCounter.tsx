"use client"

import React from "react"
import { motion } from "framer-motion"
import { Flame } from "lucide-react"

interface StreakCounterProps {
  count: number
  label?: string
  className?: string
}

export default function StreakCounter({ count, label = "day streak", className = "" }: StreakCounterProps) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 ${className}`}
    >
      <motion.div
        animate={{ y: [0, -2, 0], rotate: [0, -5, 5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Flame className="w-4 h-4 text-orange-400" />
      </motion.div>
      <span className="text-sm font-bold text-orange-400 tabular-nums">{count}</span>
      <span className="text-xs text-orange-400/70">{label}</span>
    </motion.div>
  )
}

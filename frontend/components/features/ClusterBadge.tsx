"use client"

import React from "react"
import { motion } from "framer-motion"
import Tooltip from "@/components/ui/Tooltip"
import { CLUSTER_LABELS } from "@/lib/constants"

interface ClusterBadgeProps {
  pattern: string
  totalDays?: number
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeStyles = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
}

export default function ClusterBadge({
  pattern,
  totalDays,
  size = "md",
  className = "",
}: ClusterBadgeProps) {
  const config = CLUSTER_LABELS[pattern] || {
    label: pattern,
    description: "Behavioral pattern detected by K-Means clustering",
    color: "purple",
    icon: "🧠",
  }

  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-soul-purple/10 text-soul-purple border-soul-purple/20",
  }

  return (
    <Tooltip
      content={
        <div className="max-w-[200px]">
          <p className="font-medium">{config.label} Profile</p>
          <p className="text-muted-foreground mt-1">{config.description}</p>
          {totalDays !== undefined && (
            <p className="text-muted-foreground mt-1">
              Based on {totalDays} recorded days
            </p>
          )}
        </div>
      }
    >
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={`
          inline-flex items-center gap-1.5 font-semibold
          rounded-full border
          ${colorMap[config.color] || colorMap.purple}
          ${sizeStyles[size]}
          ${className}
        `}
      >
        <span>{config.icon}</span>
        {config.label}
      </motion.span>
    </Tooltip>
  )
}

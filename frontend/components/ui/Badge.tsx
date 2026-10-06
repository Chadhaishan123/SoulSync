"use client"

import React from "react"
import { motion } from "framer-motion"

interface BadgeProps {
  children: React.ReactNode
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple" | "accent"
  size?: "sm" | "md"
  icon?: React.ReactNode
  animated?: boolean
  className?: string
}

const variantStyles: Record<string, string> = {
  default:  "bg-muted text-muted-foreground border-border",
  success:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  danger:   "bg-red-500/10 text-red-400 border-red-500/20",
  info:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  purple:   "bg-soul-purple/10 text-soul-purple border-soul-purple/20",
  accent:   "bg-soul-teal/10 text-soul-teal border-soul-teal/20",
}

const sizeStyles: Record<string, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
}

export default function Badge({
  children,
  variant = "default",
  size = "md",
  icon,
  animated = false,
  className = "",
}: BadgeProps) {
  const classes = `
    inline-flex items-center gap-1 font-semibold
    rounded-full border uppercase tracking-wider
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${className}
  `

  const content = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </>
  )

  if (animated) {
    return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring" as const, stiffness: 300, damping: 20 }}
        className={classes}
      >
        {content}
      </motion.span>
    )
  }

  return <span className={classes}>{content}</span>
}


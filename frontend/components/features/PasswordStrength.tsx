"use client"

import React from "react"
import { motion } from "framer-motion"

interface PasswordStrengthProps {
  password: string
  className?: string
}

function calculateStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: "Weak",       color: "bg-red-500" }
  if (score <= 2) return { score: 2, label: "Fair",       color: "bg-amber-500" }
  if (score <= 3) return { score: 3, label: "Good",       color: "bg-blue-500" }
  if (score <= 4) return { score: 4, label: "Strong",     color: "bg-emerald-500" }
  return              { score: 5, label: "Excellent",  color: "bg-soul-teal" }
}

export default function PasswordStrength({ password, className = "" }: PasswordStrengthProps) {
  if (!password) return null

  const { score, label, color } = calculateStrength(password)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className={`space-y-1.5 ${className}`}
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className={`h-1 flex-1 rounded-full origin-left ${
              i <= score ? color : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${
        score <= 1 ? "text-red-400" :
        score <= 2 ? "text-amber-400" :
        score <= 3 ? "text-blue-400" :
        "text-emerald-400"
      }`}>
        {label}
      </p>
    </motion.div>
  )
}

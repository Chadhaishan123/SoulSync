"use client"

import React from "react"
import { motion } from "framer-motion"

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: "sm" | "md"
}

export default function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
}: ToggleProps) {
  const trackSize = size === "sm" ? "w-9 h-5" : "w-11 h-6"
  const thumbSize = size === "sm" ? "w-3.5 h-3.5" : "w-4.5 h-4.5"
  const thumbTranslate = size === "sm" ? 16 : 20

  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex shrink-0 ${trackSize} items-center
          rounded-full transition-colors duration-200 focus-ring
          ${checked ? "bg-soul-purple" : "bg-muted"}
        `}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`
            block ${thumbSize} rounded-full bg-white shadow-sm
            ${checked ? "" : ""}
          `}
          style={{
            marginLeft: checked ? thumbTranslate : 3,
          }}
        />
      </button>
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <span className="text-sm font-medium text-foreground block">{label}</span>
          )}
          {description && (
            <span className="text-xs text-muted-foreground block mt-0.5">{description}</span>
          )}
        </div>
      )}
    </label>
  )
}

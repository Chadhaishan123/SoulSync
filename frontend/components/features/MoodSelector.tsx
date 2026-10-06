"use client"

import React from "react"
import { motion } from "framer-motion"
import { MOOD_EMOJIS } from "@/lib/constants"

interface MoodSelectorProps {
  value: number | null
  onChange: (value: number) => void
  size?: "sm" | "md" | "lg"
}

const sizes = {
  sm: { button: "w-10 h-10 text-lg",  label: "text-[9px]" },
  md: { button: "w-14 h-14 text-2xl", label: "text-[10px]" },
  lg: { button: "w-16 h-16 text-3xl", label: "text-xs" },
}

export default function MoodSelector({ value, onChange, size = "md" }: MoodSelectorProps) {
  const s = sizes[size]

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {Object.entries(MOOD_EMOJIS).map(([score, { emoji, label }]) => {
        const num = Number(score)
        const isSelected = value === num

        return (
          <motion.button
            key={score}
            onClick={() => onChange(num)}
            whileHover={{ scale: 1.15, y: -4 }}
            whileTap={{ scale: 0.9 }}
            animate={isSelected ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={`
              ${s.button} flex flex-col items-center justify-center
              rounded-xl transition-all duration-200
              ${isSelected
                ? "bg-soul-purple/20 border-2 border-soul-purple shadow-glow-sm"
                : "bg-secondary border-2 border-transparent hover:bg-secondary/80"
              }
            `}
          >
            <span className={isSelected ? "drop-shadow-lg" : "grayscale-[30%] opacity-70"}>
              {emoji}
            </span>
          </motion.button>
        )
      })}
      {value && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full text-center text-sm font-medium text-soul-purple mt-2"
        >
          {MOOD_EMOJIS[value]?.emoji} {MOOD_EMOJIS[value]?.label}
        </motion.p>
      )}
    </div>
  )
}

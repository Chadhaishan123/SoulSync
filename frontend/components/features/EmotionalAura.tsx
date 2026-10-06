"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import type { SoulSyncEmotion } from "@/types/journal"

interface EmotionalAuraProps {
  emotions?: Record<SoulSyncEmotion, number>
  dominantEmotion?: SoulSyncEmotion
  size?: "sm" | "md" | "lg" | "hero"
  interactive?: boolean
  showLabel?: boolean
  className?: string
}

const EMOTION_AURA_COLORS: Record<SoulSyncEmotion, { primary: string; secondary: string; glow: string }> = {
  Happy: {
    primary: "rgba(245, 158, 11, 0.75)",
    secondary: "rgba(251, 191, 36, 0.4)",
    glow: "rgba(245, 158, 11, 0.5)",
  },
  Calm: {
    primary: "rgba(20, 184, 166, 0.75)",
    secondary: "rgba(6, 182, 212, 0.4)",
    glow: "rgba(20, 184, 166, 0.5)",
  },
  Anxious: {
    primary: "rgba(139, 92, 246, 0.8)",
    secondary: "rgba(168, 85, 247, 0.45)",
    glow: "rgba(139, 92, 246, 0.55)",
  },
  Angry: {
    primary: "rgba(239, 68, 68, 0.8)",
    secondary: "rgba(244, 63, 94, 0.45)",
    glow: "rgba(239, 68, 68, 0.55)",
  },
  Sad: {
    primary: "rgba(59, 130, 246, 0.75)",
    secondary: "rgba(99, 102, 241, 0.4)",
    glow: "rgba(59, 130, 246, 0.5)",
  },
  Neutral: {
    primary: "rgba(148, 163, 184, 0.65)",
    secondary: "rgba(203, 213, 225, 0.35)",
    glow: "rgba(148, 163, 184, 0.35)",
  },
}

const SIZE_MAP = {
  sm: "w-20 h-20",
  md: "w-36 h-36",
  lg: "w-48 h-48",
  hero: "w-64 h-64 md:w-80 md:h-80",
}

export default function EmotionalAura({
  emotions,
  dominantEmotion,
  size = "md",
  showLabel = false,
  className = "",
}: EmotionalAuraProps) {
  // Resolve primary and secondary colors based on dominant & weighted breakdown
  const { topEmotion, colorConfig, pulseDuration } = useMemo(() => {
    let resolved = dominantEmotion

    if (!resolved && emotions) {
      const sorted = Object.entries(emotions).sort(([, a], [, b]) => b - a)
      if (sorted.length > 0 && sorted[0][1] > 0) {
        resolved = sorted[0][0] as SoulSyncEmotion
      }
    }

    const active = resolved || "Calm"
    const config = EMOTION_AURA_COLORS[active] || EMOTION_AURA_COLORS.Calm

    // Speed of breathing pulse depends on emotional state
    let speed = 4.5
    if (active === "Anxious" || active === "Angry") speed = 2.4
    else if (active === "Calm") speed = 6.0
    else if (active === "Happy") speed = 3.6

    return {
      topEmotion: active,
      colorConfig: config,
      pulseDuration: speed,
    }
  }, [emotions, dominantEmotion])

  const dim = SIZE_MAP[size]

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {/* Outer Glow Halo */}
      <motion.div
        className={`absolute rounded-full pointer-events-none filter blur-2xl opacity-60`}
        style={{
          width: "120%",
          height: "120%",
          background: `radial-gradient(circle, ${colorConfig.glow} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.45, 0.75, 0.45],
        }}
        transition={{
          duration: pulseDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Main Aura Container */}
      <div className={`relative ${dim} flex items-center justify-center`}>
        {/* Layer 1: Ethereal Morphing Background */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${colorConfig.primary} 0%, ${colorConfig.secondary} 60%, transparent 100%)`,
            filter: "blur(14px)",
          }}
          animate={{
            scale: [0.95, 1.1, 0.95],
            rotate: [0, 180, 360],
            borderRadius: [
              "50% 50% 50% 50%",
              "42% 58% 60% 40% / 45% 45% 55% 55%",
              "55% 45% 40% 60% / 50% 60% 40% 50%",
              "50% 50% 50% 50%",
            ],
          }}
          transition={{
            duration: pulseDuration * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Layer 2: Radiant Inner Core Ring */}
        <motion.div
          className="absolute w-3/4 h-3/4 rounded-full border border-white/30 backdrop-blur-sm"
          style={{
            background: `radial-gradient(circle at center, rgba(255,255,255,0.25) 0%, ${colorConfig.secondary} 70%, transparent 100%)`,
            boxShadow: `0 0 25px ${colorConfig.glow}, inset 0 0 15px rgba(255,255,255,0.2)`,
          }}
          animate={{
            scale: [1, 1.06, 1],
          }}
          transition={{
            duration: pulseDuration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Layer 3: Concentric Breathing Wave */}
        <motion.div
          className="absolute w-full h-full rounded-full border border-white/20"
          animate={{
            scale: [0.85, 1.25],
            opacity: [0.6, 0],
          }}
          transition={{
            duration: pulseDuration * 1.3,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />

        {/* Center Iris Nucleus */}
        <motion.div
          className="relative z-10 w-1/3 h-1/3 rounded-full flex items-center justify-center shadow-lg"
          style={{
            background: `linear-gradient(135deg, rgba(255,255,255,0.9), ${colorConfig.primary})`,
          }}
          animate={{
            scale: [1, 0.92, 1],
          }}
          transition={{
            duration: pulseDuration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <span className="text-xs font-semibold tracking-wider text-slate-900 drop-shadow-sm uppercase">
            Aura
          </span>
        </motion.div>
      </div>

      {/* Optional Descriptive Label */}
      {showLabel && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-center"
        >
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Resonance
          </span>
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 justify-center">
            <span
              className="w-2 h-2 rounded-full inline-block animate-pulse"
              style={{ backgroundColor: colorConfig.primary }}
            />
            {topEmotion} Frequency
          </p>
        </motion.div>
      )}
    </div>
  )
}

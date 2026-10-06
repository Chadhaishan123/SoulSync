"use client"

import React from "react"
import { motion } from "framer-motion"
import Badge from "@/components/ui/Badge"
import EmotionalAura from "@/components/features/EmotionalAura"
import { EMOTION_COLORS, EMOTION_EMOJIS } from "@/lib/constants"
import { formatPercent, sentimentToGradient } from "@/lib/formatters"
import type { JournalAnalysis } from "@/types/journal"

interface NLPAnalysisPanelProps {
  analysis: JournalAnalysis
  className?: string
}

// Static class names so Tailwind's JIT includes them in the build.
const EMOTION_BAR_COLORS: Record<string, string> = {
  Happy: "bg-emerald-400",
  Sad: "bg-blue-400",
  Anxious: "bg-amber-400",
  Angry: "bg-red-400",
  Calm: "bg-cyan-400",
  Neutral: "bg-gray-400",
}

export default function NLPAnalysisPanel({ analysis, className = "" }: NLPAnalysisPanelProps) {
  const emotionColor = EMOTION_COLORS[analysis.dominant_emotion] || EMOTION_COLORS.Neutral
  const emotionEmoji = EMOTION_EMOJIS[analysis.dominant_emotion] || "😐"
  const sentimentPercent = ((analysis.sentiment_score + 1) / 2) * 100 // normalize -1..1 to 0..100

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`bg-card border border-border rounded-xl overflow-hidden ${className}`}
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-soul-teal animate-pulse" />
          <span className="text-xs font-semibold text-soul-teal uppercase tracking-wider">
            NLP Analysis Complete
          </span>
        </div>

        {/* Emotion Detection & Living Emotional Aura */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl bg-secondary/30 border border-border/50">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Detected Emotion</p>
            <div className="flex items-center gap-3">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                className="text-3xl"
              >
                {emotionEmoji}
              </motion.span>
              <div>
                <Badge
                  variant={
                    analysis.dominant_emotion === "Happy" ? "success" :
                    analysis.dominant_emotion === "Sad" ? "info" :
                    analysis.dominant_emotion === "Anxious" ? "warning" :
                    analysis.dominant_emotion === "Angry" ? "danger" :
                    "default"
                  }
                  animated
                >
                  {analysis.dominant_emotion}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Confidence: {formatPercent(analysis.dominant_emotion_score ?? 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Living Aura Preview */}
          <div className="flex items-center gap-3 self-center sm:self-auto">
            <EmotionalAura
              emotions={analysis.emotions}
              dominantEmotion={analysis.dominant_emotion as import("@/types/journal").SoulSyncEmotion}
              size="sm"
            />
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase block">
                Aura State
              </span>
              <span className="text-xs font-medium text-foreground">
                {analysis.dominant_emotion} Pulse
              </span>
            </div>
          </div>
        </div>

        {/* Emotion Breakdown */}
        {analysis.emotions && Object.keys(analysis.emotions).length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Emotion Breakdown</p>
            <div className="space-y-1.5">
              {Object.entries(analysis.emotions)
                .sort(([, a], [, b]) => b - a)
                .map(([label, score], i) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-16 text-[11px] text-muted-foreground">
                      {EMOTION_EMOJIS[label] ?? "•"} {label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(score * 100)}%` }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 + i * 0.05 }}
                        className={`h-full rounded-full ${EMOTION_BAR_COLORS[label] ?? EMOTION_BAR_COLORS.Neutral}`}
                      />
                    </div>
                    <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                      {formatPercent(score)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Sentiment Score Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Sentiment Score</p>
            <span className="text-xs font-bold text-foreground tabular-nums">
              {analysis.sentiment_score >= 0 ? "+" : ""}{analysis.sentiment_score.toFixed(2)}
            </span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden sentiment-bar">
            <motion.div
              initial={{ left: "50%" }}
              animate={{ left: `${sentimentPercent}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-card shadow-lg"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Negative</span>
            <span>Neutral</span>
            <span>Positive</span>
          </div>
        </div>

        {/* Themes */}
        {analysis.themes && analysis.themes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Detected Themes</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.themes.map((theme, i) => (
                <motion.span
                  key={theme}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground"
                >
                  {theme}
                </motion.span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Smile, Send, Clock, CheckCircle2, Lock, ArrowRight, BookOpen, LineChart } from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Slider from "@/components/ui/Slider"
import MoodSelector from "@/components/features/MoodSelector"
import { CONTEXT_TAGS, EMOTION_EMOJIS, MOOD_EMOJIS } from "@/lib/constants"
import type { MoodEntry } from "@/types/mood"
import toast from "react-hot-toast"

const emotions = Object.keys(EMOTION_EMOJIS) as string[]

export default function CheckInPage() {
  const router = useRouter()
  const [mood, setMood] = useState<number | null>(null)
  const [stress, setStress] = useState(5)
  const [energy, setEnergy] = useState(5)
  const [sleepQuality, setSleepQuality] = useState(5)
  const [emotion, setEmotion] = useState("Neutral")
  const [tags, setTags] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  // 24-hour lockout state
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [lastEntry, setLastEntry] = useState<MoodEntry | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>("")
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    checkLatestCheckin()
  }, [])

  const checkLatestCheckin = async () => {
    try {
      const list = await api.checkins.list({ limit: "1" })
      if (list && list.length > 0) {
        const latest = list[0]
        const recordedTime = new Date(latest.recorded_at).getTime()
        const now = Date.now()
        const twentyFourHours = 24 * 60 * 60 * 1000
        const diff = now - recordedTime

        if (diff < twentyFourHours) {
          setLastEntry(latest)
          setIsLocked(true)
        }
      }
    } catch (err) {
      console.warn("Could not check prior check-in:", err)
    } finally {
      setCheckingExisting(false)
    }
  }

  // Live countdown timer for unlock
  useEffect(() => {
    if (!lastEntry || !isLocked) return

    const updateTimer = () => {
      const recordedTime = new Date(lastEntry.recorded_at).getTime()
      const unlockTime = recordedTime + 24 * 60 * 60 * 1000
      const diff = unlockTime - Date.now()

      if (diff <= 0) {
        setIsLocked(false)
        setTimeRemaining("")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining(
        `${hours.toString().padStart(2, "0")}h ${minutes
          .toString()
          .padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
      )
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [lastEntry, isLocked])

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleSubmit = async () => {
    if (!mood) {
      toast.error("Please select your mood")
      return
    }
    setLoading(true)
    try {
      await api.checkins.create({
        mood_score: mood,
        stress_level: stress,
        energy_level: energy,
        sleep_quality: sleepQuality,
        primary_emotion: emotion,
        context_tags: tags,
        notes: notes || undefined,
      })
      toast.success("Check-in recorded! 🎉")
      router.push("/dashboard")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save check-in")
    } finally {
      setLoading(false)
    }
  }

  if (checkingExisting) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-10 h-10 border-2 border-soul-purple border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Checking daily check-in status...</p>
      </div>
    )
  }

  // ── Locked State (Check-in already completed within last 24h) ──
  if (isLocked && lastEntry) {
    const moodMeta = MOOD_EMOJIS[lastEntry.mood_score] || { emoji: "✨", label: "Good" }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            Today&apos;s Check-In Complete
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            SoulSync limits reflections to one per 24 hours to track steady, authentic longitudinal patterns.
          </p>
        </div>

        {/* Lockout & Countdown Banner */}
        <Card variant="glow" className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-soul-purple/10 border border-soul-purple/30 flex items-center justify-center mx-auto text-soul-purple">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <Badge variant="purple" size="md">
              Next Check-In Unlocks In
            </Badge>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-foreground mt-3 tracking-wider">
              {timeRemaining || "24h 00m 00s"}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Recorded at {new Date(lastEntry.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </Card>

        {/* Today's Logged Summary */}
        <Card>
          <h3 className="text-sm font-bold text-foreground mb-4">Your Reflection Today</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-secondary/50 border border-border">
              <span className="text-2xl block mb-1">{moodMeta.emoji}</span>
              <span className="text-xs text-muted-foreground">Mood</span>
              <p className="font-bold text-foreground text-sm">{lastEntry.mood_score}/10 ({moodMeta.label})</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/50 border border-border">
              <span className="text-2xl block mb-1">{EMOTION_EMOJIS[lastEntry.primary_emotion || "Neutral"] || "😐"}</span>
              <span className="text-xs text-muted-foreground">Emotion</span>
              <p className="font-bold text-foreground text-sm">{lastEntry.primary_emotion || "Neutral"}</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/50 border border-border">
              <span className="text-2xl block mb-1">🔥</span>
              <span className="text-xs text-muted-foreground">Stress</span>
              <p className="font-bold text-foreground text-sm">{lastEntry.stress_level ?? 5}/10</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/50 border border-border">
              <span className="text-2xl block mb-1">⚡</span>
              <span className="text-xs text-muted-foreground">Energy</span>
              <p className="font-bold text-foreground text-sm">{lastEntry.energy_level ?? 5}/10</p>
            </div>
          </div>

          {lastEntry.notes && (
            <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border text-sm text-muted-foreground italic">
              &ldquo;{lastEntry.notes}&rdquo;
            </div>
          )}
        </Card>

        {/* Next Steps Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/dashboard/journal" className="flex-1">
            <Button variant="secondary" className="w-full" icon={<BookOpen className="w-4 h-4" />}>
              Open Journal
            </Button>
          </Link>
          <Link href="/dashboard/insights" className="flex-1">
            <Button variant="primary" className="w-full" icon={<LineChart className="w-4 h-4" />}>
              Explore Insights <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </motion.div>
    )
  }

  // ── Open Form State ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Smile className="w-6 h-6 text-soul-purple" />
          Daily Check-In
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          How are you feeling today? This takes less than 30 seconds.
        </p>
      </div>

      {/* Mood */}
      <Card>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          How&apos;s your mood?
        </span>
        <div className="mt-4">
          <MoodSelector value={mood} onChange={setMood} />
        </div>
      </Card>

      {/* Sliders */}
      <Card>
        <div className="space-y-6">
          <Slider label="🔥 Stress Level" value={stress} onChange={setStress} />
          <Slider label="⚡ Energy Level" value={energy} onChange={setEnergy} />
          <Slider label="😴 Sleep Quality" value={sleepQuality} onChange={setSleepQuality} />
        </div>
      </Card>

      {/* Emotion */}
      <Card>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
          Primary Emotion
        </span>
        <div className="flex flex-wrap gap-2">
          {emotions.map((e) => (
            <motion.button
              key={e}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setEmotion(e)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  emotion === e
                    ? "bg-soul-purple/20 text-soul-purple border border-soul-purple/30"
                    : "bg-secondary text-muted-foreground border border-transparent hover:bg-secondary/80"
                }
              `}
            >
              <span>{EMOTION_EMOJIS[e]}</span>
              {e}
            </motion.button>
          ))}
        </div>
      </Card>

      {/* Context Tags */}
      <Card>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
          Context Tags (optional)
        </span>
        <div className="flex flex-wrap gap-2">
          {CONTEXT_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${
                  tags.includes(tag)
                    ? "bg-soul-teal/20 text-soul-teal border border-soul-teal/30"
                    : "bg-secondary text-muted-foreground border border-transparent hover:bg-secondary/80"
                }
              `}
            >
              {tag}
            </button>
          ))}
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else you'd like to note about today..."
          className="w-full h-24 px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary transition-all resize-none text-sm"
        />
      </Card>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        isLoading={loading}
        size="lg"
        className="w-full"
        icon={<Send className="w-4 h-4" />}
      >
        Submit Check-In
      </Button>
    </motion.div>
  )
}

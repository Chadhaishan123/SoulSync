"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Smile, Send } from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Slider from "@/components/ui/Slider"
import MoodSelector from "@/components/features/MoodSelector"
import { CONTEXT_TAGS, EMOTION_EMOJIS } from "@/lib/constants"
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

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
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
                ${emotion === e
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
                ${tags.includes(tag)
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

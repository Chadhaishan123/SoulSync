"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Award,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Heart,
  Smile,
  ShieldCheck,
} from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Modal from "@/components/ui/Modal"
import { SkeletonCard } from "@/components/ui/Skeleton"
import { ACTIVITY_CATEGORIES } from "@/lib/constants"
import type { Recommendation } from "@/types/activity"
import toast from "react-hot-toast"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  // Interactive Verification Modal State
  const [activeModalRec, setActiveModalRec] = useState<Recommendation | null>(null)
  const [timerSeconds, setTimerSeconds] = useState<number>(0)
  const [timerRunning, setTimerRunning] = useState<boolean>(false)
  const [reflectionFeel, setReflectionFeel] = useState<string>("Relaxed")
  const [reflectionNote, setReflectionNote] = useState<string>("")
  const [verifying, setVerifying] = useState<boolean>(false)

  useEffect(() => {
    loadRecs()
  }, [])

  // Timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1)
      }, 1000)
    } else if (timerSeconds === 0 && timerRunning) {
      setTimerRunning(false)
      toast.success("Timer completed! Record your reflection below.")
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerRunning, timerSeconds])

  const loadRecs = async () => {
    try {
      const data = await api.recommendations.list()
      setRecs(data)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  const openSessionModal = (rec: Recommendation) => {
    setActiveModalRec(rec)
    // Default to duration minutes or 3-minute guided focus
    const initialSeconds = Math.min(rec.activity.duration_minutes * 60, 300)
    setTimerSeconds(initialSeconds)
    setTimerRunning(false)
    setReflectionFeel("Relaxed")
    setReflectionNote("")
  }

  const handleVerifyComplete = async () => {
    if (!activeModalRec) return
    setVerifying(true)
    try {
      await api.recommendations.feedback(
        activeModalRec.id,
        `completed: felt ${reflectionFeel}${reflectionNote ? ` - ${reflectionNote}` : ""}`
      )
      toast.success("Activity verified & completed! 🎉", { icon: "✅" })
      setActiveModalRec(null)
      loadRecs()
    } catch {
      toast.error("Failed to record verification")
    } finally {
      setVerifying(false)
    }
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  const active = recs.filter((r) => !r.feedback)
  const completed = recs.filter((r) => r.feedback)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Award className="w-6 h-6 text-soul-purple" />
          Recommendations
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Personalized wellness activities. Start an interactive session to verify and record completion.
        </p>
      </div>

      {/* Active Recommendations */}
      {active.length > 0 ? (
        <motion.div
          className="space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {active.map((rec) => {
            const cat = ACTIVITY_CATEGORIES[rec.activity.category] || {
              color: "purple",
              icon: "✨",
            }
            return (
              <motion.div key={rec.id} variants={itemVariants}>
                <Card variant="interactive" className="!p-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="purple" size="sm">
                          {rec.activity.category}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {rec.activity.duration_minutes} min
                        </div>
                      </div>
                      <h4 className="text-base font-bold text-foreground">{rec.activity.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {rec.activity.description}
                      </p>
                      <p className="text-xs text-soul-purple/80 mt-2 italic">💡 {rec.reason}</p>
                    </div>
                    <div className="shrink-0 self-center">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openSessionModal(rec)}
                        icon={<Play className="w-3.5 h-3.5 fill-current" />}
                      >
                        Start & Verify
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground text-center py-6">
            Complete a daily check-in to receive personalized recommendations.
          </p>
        </Card>
      )}

      {/* Completed with Verified Badges */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Verified Completed ({completed.length})
          </h3>
          <div className="space-y-2">
            {completed.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30 border border-border/50 opacity-80"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {rec.activity.name}
                    </span>
                    {rec.feedback && (
                      <p className="text-xs text-muted-foreground">
                        {rec.feedback.replace("completed: ", "")}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="success" size="sm">
                  Verified ✓
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Verification Modal */}
      {activeModalRec && (
        <Modal
          isOpen={!!activeModalRec}
          onClose={() => setActiveModalRec(null)}
          title={`Guided Session: ${activeModalRec.activity.name}`}
          size="md"
        >
          <div className="space-y-5">
            {/* Activity Info */}
            <div className="p-3.5 rounded-xl bg-secondary/50 border border-border text-sm text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-1">
                Instructions:
              </p>
              {activeModalRec.activity.description}
            </div>

            {/* Guided Countdown Timer */}
            <div className="p-6 rounded-2xl bg-secondary/30 border border-border text-center space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Focus Session Timer
              </span>
              <div className="text-4xl font-extrabold font-mono text-foreground tracking-wider">
                {formatTimer(timerSeconds)}
              </div>
              <div className="flex justify-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant={timerRunning ? "secondary" : "primary"}
                  onClick={() => setTimerRunning(!timerRunning)}
                  icon={
                    timerRunning ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )
                  }
                >
                  {timerRunning ? "Pause" : "Start Timer"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTimerRunning(false)
                    setTimerSeconds(Math.min(activeModalRec.activity.duration_minutes * 60, 300))
                  }}
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTimerSeconds(10)}
                  className="text-xs text-muted-foreground"
                >
                  Quick Mode (10s)
                </Button>
              </div>
            </div>

            {/* Completion Reflection & Verification Check */}
            <div className="space-y-3 pt-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Verification: How do you feel right now?
              </label>
              <div className="flex flex-wrap gap-2">
                {["Relaxed", "Energized", "Grounded", "Centered", "Neutral"].map((feel) => (
                  <button
                    key={feel}
                    type="button"
                    onClick={() => setReflectionFeel(feel)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      reflectionFeel === feel
                        ? "border-soul-purple bg-soul-purple/20 text-soul-purple font-bold"
                        : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {feel}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Takeaway / Observation (Optional)
                </label>
                <input
                  type="text"
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                  placeholder="e.g. Felt calmer in my chest, slowed heart rate"
                  className="w-full h-10 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-soul-purple"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setActiveModalRec(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleVerifyComplete}
                isLoading={verifying}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                icon={<ShieldCheck className="w-4 h-4" />}
              >
                Verify & Mark Done ✓
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </motion.div>
  )
}

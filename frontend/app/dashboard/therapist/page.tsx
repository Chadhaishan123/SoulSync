"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  HeartHandshake,
  Send,
  AlertTriangle,
  User,
  Shield,
  Stethoscope,
  Sparkles,
  Phone,
  RefreshCw,
  CalendarCheck,
  CheckCircle2,
  Wind,
  BookOpen,
  FileText,
  TrendingUp,
  X,
  Play,
  Pause,
} from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import toast from "react-hot-toast"

interface TherapistMessage {
  id: string
  role: "therapist" | "user"
  text: string
  distortionHint?: string | null
  distortionAdvice?: string | null
  toolSuggestion?: string | null
  isCrisis?: boolean
}

interface ClinicalSummary {
  trigger: string
  primary_distortion: string
  balanced_perspective: string
  homework_exercise: string
}

export default function DigitalTherapistPage() {
  const [messages, setMessages] = useState<TherapistMessage[]>([
    {
      id: "intro",
      role: "therapist",
      text: "Hello. I'm Dr. Elena, your digital Cognitive Behavioral Therapy (CBT) assistant. I'm here to listen without judgment, help you identify cognitive distortions, and gently guide you toward a balanced perspective. What is currently resting on your mind?",
    },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)

  // Somatic Breathing Pacer State
  const [showBreathingPacer, setShowBreathingPacer] = useState(false)
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale" | "Rest">("Inhale")
  const [breathTimer, setBreathTimer] = useState(4)

  // Clinical Summary State
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summaryData, setSummaryData] = useState<ClinicalSummary | null>(null)
  const [savingToJournal, setSavingToJournal] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  // Somatic Breathing Pacer Cycle
  useEffect(() => {
    if (!showBreathingPacer) return
    const interval = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev <= 1) {
          setBreathPhase((current) => {
            if (current === "Inhale") return "Hold"
            if (current === "Hold") return "Exhale"
            if (current === "Exhale") return "Rest"
            return "Inhale"
          })
          return 4
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [showBreathingPacer])

  // Send Message to Therapist
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    if (!text || typing) return

    const userMsg: TherapistMessage = {
      id: "u-" + Date.now(),
      role: "user",
      text,
    }

    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setInput("")
    setTyping(true)

    try {
      const historyPayload = updatedHistory.map((m) => ({
        role: m.role,
        content: m.text,
      }))

      const res = await api.therapist.chat(text, historyPayload)

      const therapistMsg: TherapistMessage = {
        id: "th-" + Date.now(),
        role: "therapist",
        text: res.reply,
        distortionHint: res.distortion_detected,
        distortionAdvice: res.distortion_advice,
        toolSuggestion: res.tool_suggestion,
        isCrisis: res.is_crisis,
      }

      setMessages((prev) => [...prev, therapistMsg])

      // Auto-suggest breathing pacer if anxiety/panic detected
      if (res.tool_suggestion === "box_breathing") {
        setShowBreathingPacer(true)
      }
    } catch {
      // Local graceful fallback
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: "th-" + Date.now(),
            role: "therapist",
            text: "I hear how much weight you are carrying right now. Let's look closely at that thought: is there any evidence that might contradict this worst-case scenario, even slightly?",
            distortionHint: "Catastrophizing",
            distortionAdvice: "Notice when the mind leaps straight to the worst-case outcome without testing realistic alternatives.",
            toolSuggestion: "thought_record",
          },
        ])
      }, 600)
    } finally {
      setTyping(false)
    }
  }

  // Generate Session Summary
  const handleGenerateSummary = async () => {
    const userMessages = messages.filter((m) => m.role === "user")
    if (userMessages.length < 1) {
      toast.error("Share a thought with the therapist first before generating a summary")
      return
    }

    setGeneratingSummary(true)
    setShowSummaryModal(true)
    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.text,
      }))
      const res = await api.therapist.summary(historyPayload)
      setSummaryData(res)
    } catch {
      setSummaryData({
        trigger: "High cognitive pressure and difficulty setting boundaries.",
        primary_distortion: "All-or-Nothing Thinking & Overgeneralization",
        balanced_perspective: "A single challenging moment is temporary. Moving at a sustainable pace preserves mental clarity.",
        homework_exercise: "Practice five minutes of Box Breathing before responding to stressful demands today.",
      })
    } finally {
      setGeneratingSummary(false)
    }
  }

  // Save Session Takeaways to Journal
  const handleSaveToJournal = async () => {
    if (!summaryData) return
    setSavingToJournal(true)
    try {
      const journalContent = `Therapy Session Takeaway\n\nTrigger Event: ${summaryData.trigger}\n\nIdentified Distortion: ${summaryData.primary_distortion}\n\nBalanced Reframing: ${summaryData.balanced_perspective}\n\nDaily Practice Homework: ${summaryData.homework_exercise}`
      await api.journal.create({
        content: journalContent,
        title: `Therapy Breakthrough: ${summaryData.primary_distortion}`,
        kind: "reframe",
      })
      toast.success("Breakthrough saved to your AI Journal! 📖")
      setShowSummaryModal(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save to journal")
    } finally {
      setSavingToJournal(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-4 pb-12"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-soul-teal" />
            Digital Therapist (CBT Clinical Mode)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live Cognitive Behavioral Therapy dialogue, Socratic restructuring, and somatic regulation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowBreathingPacer(!showBreathingPacer)}
            className="text-xs gap-1.5"
          >
            <Wind className="w-3.5 h-3.5 text-soul-teal" />
            {showBreathingPacer ? "Hide Pacer" : "Somatic Pacer"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateSummary}
            className="text-xs gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-soul-purple" />
            Session Summary
          </Button>
        </div>
      </div>

      {/* Escalation & Doctor Connection Banner */}
      <Card variant="interactive" className="p-4 bg-gradient-to-r from-soul-purple/10 to-soul-teal/10 border-soul-purple/30">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-soul-purple/20 flex items-center justify-center text-soul-purple shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                Need Human Medical or Psychiatric Care?
                <Badge variant="purple" size="sm">Licensed Doctors</Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                The digital therapist offers cognitive tools, but does not replace licensed medical care.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Link href="/dashboard/appointments" className="flex-1 md:flex-none">
              <Button
                size="sm"
                variant="primary"
                className="w-full bg-soul-purple hover:bg-soul-purple/90 text-white font-bold"
                icon={<CalendarCheck className="w-4 h-4" />}
              >
                Book a Real Doctor
              </Button>
            </Link>
            <a
              href="tel:14416"
              className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold flex items-center gap-1 transition-all shrink-0"
              title="Emergency Mental Health Helpline"
            >
              <Phone className="w-3.5 h-3.5" /> Emergency SOS (14416)
            </a>
          </div>
        </div>
      </Card>

      {/* ── SOMATIC BREATHING PACER WIDGET ── */}
      <AnimatePresence>
        {showBreathingPacer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="bg-gradient-to-br from-card via-soul-teal/5 to-card border-soul-teal/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-soul-teal flex items-center gap-1.5">
                  <Wind className="w-4 h-4" /> Somatic Box Breathing Pacer (4-4-4-4)
                </span>
                <button
                  onClick={() => setShowBreathingPacer(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <motion.div
                  className="w-28 h-28 rounded-full border-4 border-soul-teal/60 flex items-center justify-center bg-soul-teal/10 relative"
                  animate={{
                    scale: breathPhase === "Inhale" ? 1.25 : breathPhase === "Hold" ? 1.25 : breathPhase === "Exhale" ? 0.85 : 0.85,
                    borderColor: breathPhase === "Inhale" ? "rgba(20, 184, 166, 0.9)" : "rgba(124, 92, 252, 0.7)",
                  }}
                  transition={{ duration: 3.8, ease: "easeInOut" }}
                >
                  <div className="text-center">
                    <span className="text-sm font-bold text-foreground block">{breathPhase}</span>
                    <span className="text-xs font-semibold text-soul-teal tabular-nums">{breathTimer}s</span>
                  </div>
                </motion.div>
                <p className="text-xs text-muted-foreground text-center max-w-sm">
                  {breathPhase === "Inhale" && "Inhale slowly through your nose into the belly."}
                  {breathPhase === "Hold" && "Hold gently. Relax your shoulders and jaw."}
                  {breathPhase === "Exhale" && "Release slowly and completely through parted lips."}
                  {breathPhase === "Rest" && "Pause in stillness before the next breath."}
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CHAT CONTAINER ── */}
      <Card padding="none" className="h-[620px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-soul-teal to-emerald-500 flex items-center justify-center text-white">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Dr. Elena • Clinical CBT</p>
              <p className="text-[10px] text-muted-foreground">Socratic Questioning & Cognitive Restructuring</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setMessages([
                {
                  id: "intro",
                  role: "therapist",
                  text: "Resetting session. I'm listening. What would you like to explore or reframe right now?",
                },
              ])
            }
            className="text-xs text-muted-foreground gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "therapist" && (
                <div className="w-7 h-7 rounded-lg bg-soul-teal/20 flex items-center justify-center text-soul-teal shrink-0 mt-1">
                  <HeartHandshake className="w-3.5 h-3.5" />
                </div>
              )}

              <div className={`max-w-[85%] space-y-2`}>
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-soul-purple text-white rounded-tr-sm shadow-glow-sm"
                      : m.isCrisis
                      ? "bg-red-500/10 border border-red-500/30 text-foreground rounded-tl-sm"
                      : "bg-muted/30 border border-border/50 text-foreground rounded-tl-sm"
                  }`}
                >
                  {m.text}
                </div>

                {/* Distortion Tag if detected */}
                {m.distortionHint && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <Badge variant="purple" size="sm" className="gap-1 text-[10px]">
                      <Sparkles className="w-3 h-3 text-soul-purple" />
                      Distortion: {m.distortionHint}
                    </Badge>
                    {m.distortionAdvice && (
                      <span className="text-[11px] text-muted-foreground italic truncate max-w-sm">
                        {m.distortionAdvice}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-soul-purple/20 flex items-center justify-center text-soul-purple shrink-0 mt-1">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </motion.div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-soul-teal/20 flex items-center justify-center text-soul-teal shrink-0 mt-1">
                <HeartHandshake className="w-3.5 h-3.5" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-sm bg-muted/30 border border-border/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-soul-teal animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-soul-teal animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-soul-teal animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Therapeutic Starters */}
        <div className="px-4 py-2 border-t border-border/40 bg-card/40 flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            "I'm feeling intense pressure at work and afraid I'll fail",
            "I feel like my friends are pulling away from me",
            "I can't stop replaying an awkward mistake from yesterday",
            "I feel physical tightness in my chest and can't relax",
          ].map((starter, i) => (
            <button
              key={i}
              onClick={() => handleSend(starter)}
              className="px-2.5 py-1 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/40 text-muted-foreground hover:text-foreground shrink-0 text-left transition-all"
            >
              {starter}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-border bg-card flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you are feeling or what thought triggered you..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-3 py-2 rounded-xl border border-border focus:border-soul-purple transition-all"
          />
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleSend()}
            disabled={!input.trim() || typing}
            icon={<Send className="w-3.5 h-3.5" />}
          >
            Send
          </Button>
        </div>
      </Card>

      {/* ── SESSION SUMMARY MODAL ── */}
      <AnimatePresence>
        {showSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5 text-soul-purple" />
                    Clinical Session Takeaways
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Distilled Cognitive Behavioral Therapy summary
                  </p>
                </div>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              {generatingSummary ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-soul-purple animate-spin" />
                  <p className="text-xs text-muted-foreground">Synthesizing clinical insights...</p>
                </div>
              ) : summaryData ? (
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <span className="font-semibold text-soul-purple block mb-1">Trigger Event</span>
                    <p className="text-foreground">{summaryData.trigger}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <span className="font-semibold text-amber-500 block mb-1">Primary Distortion</span>
                    <Badge variant="purple" size="sm">{summaryData.primary_distortion}</Badge>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="font-semibold text-emerald-400 block mb-1">Balanced Perspective</span>
                    <p className="text-foreground leading-relaxed">{summaryData.balanced_perspective}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-soul-teal/10 border border-soul-teal/20">
                    <span className="font-semibold text-soul-teal block mb-1">Homework / Micro-Exercise</span>
                    <p className="text-foreground">{summaryData.homework_exercise}</p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border/40">
                    <Button variant="ghost" size="sm" onClick={() => setShowSummaryModal(false)}>
                      Close
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveToJournal}
                      isLoading={savingToJournal}
                      icon={<BookOpen className="w-3.5 h-3.5" />}
                    >
                      Save Breakthrough to Journal
                    </Button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

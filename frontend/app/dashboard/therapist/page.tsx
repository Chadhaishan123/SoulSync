"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
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
} from "lucide-react"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import toast from "react-hot-toast"

interface TherapistMessage {
  id: string
  role: "therapist" | "user"
  text: string
  distortionHint?: string
  toolSuggestion?: string
}

const CBT_DISTORTIONS: Record<string, { name: string; advice: string }> = {
  catastrophizing: {
    name: "Catastrophizing",
    advice: "Expecting the worst-case scenario. Ask yourself: 'What is the most realistic outcome?'",
  },
  allOrNothing: {
    name: "All-or-Nothing Thinking",
    advice: "Viewing situations in black-and-white. Notice shades of gray and partial successes.",
  },
  mindReading: {
    name: "Mind Reading",
    advice: "Assuming you know what others think without concrete evidence.",
  },
  emotionalReasoning: {
    name: "Emotional Reasoning",
    advice: "'I feel it, therefore it must be true.' Feelings are real, but they are not facts.",
  },
}

export default function DigitalTherapistPage() {
  const [messages, setMessages] = useState<TherapistMessage[]>([
    {
      id: "intro",
      role: "therapist",
      text: "Welcome to your Digital Therapy space. I practice Cognitive Behavioral Therapy (CBT) and somatic support. This is a non-judgmental environment to unpack difficult emotions, deconstruct cognitive distortions, and regulate your nervous system. What situation or thought is feeling heaviest right now?",
    },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  const handleSend = (textOverride?: string) => {
    const text = (textOverride || input).trim()
    if (!text) return

    const userMsg: TherapistMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      text,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setTyping(true)

    setTimeout(() => {
      const lower = text.toLowerCase()
      let reply = ""
      let distortion: string | undefined = undefined
      let tool: string | undefined = undefined

      // Crisis check
      if (
        lower.includes("suicid") ||
        lower.includes("kill myself") ||
        lower.includes("end my life") ||
        lower.includes("hurt myself") ||
        lower.includes("want to die")
      ) {
        reply =
          "I hear how much pain you are holding right now, but please know that you do not have to carry this alone. Your life is irreplaceable. " +
          "Please reach out immediately to a human professional. You can call the free, confidential 24/7 lifeline right now at 14416 (Tele-MANAS) or 988. " +
          "Click the emergency buttons above to connect immediately."
      } else if (
        lower.includes("always") ||
        lower.includes("never") ||
        lower.includes("completely failed") ||
        lower.includes("total failure") ||
        lower.includes("ruined everything")
      ) {
        distortion = "allOrNothing"
        reply =
          "I notice words like 'always' or 'completely failed'. In CBT, this is known as All-or-Nothing Thinking. " +
          "When we are distressed, our brain simplifies complex situations into black-and-white absolutes. " +
          "Can you identify even one small thing in this situation that didn't go completely wrong, or a time when the opposite was true?"
      } else if (
        lower.includes("worst") ||
        lower.includes("disaster") ||
        lower.includes("horrible") ||
        lower.includes("doomed") ||
        lower.includes("end of the world")
      ) {
        distortion = "catastrophizing"
        reply =
          "It sounds like your mind is jumping directly to the catastrophe. Catastrophizing is our amygdala's way of trying to prepare for danger, but it spikes our panic. " +
          "Let's ground this: On a scale of 1 to 10, how likely is that worst-case scenario mathematically? " +
          "What is the most *probable* scenario, and how would you cope if it happened?"
      } else if (
        lower.includes("they hate me") ||
        lower.includes("they think i'm") ||
        lower.includes("everyone thinks") ||
        lower.includes("judging me")
      ) {
        distortion = "mindReading"
        reply =
          "You might be experiencing Mind Reading—assuming you know other people's unspoken judgments. " +
          "We often project our own inner self-criticism onto the faces and actions of others. " +
          "Do you have factual, spoken evidence that they believe this, or could they simply be preoccupied with their own lives?"
      } else if (lower.includes("panic") || lower.includes("can't breathe") || lower.includes("chest tight")) {
        tool = "Somatic Reset"
        reply =
          "Let's step out of the thoughts and drop straight into the body. Place one hand flat on your chest and one on your belly. " +
          "Take a slow breath into your belly for 4 counts, hold gently for 2, and sigh it out through your mouth for 6 counts. " +
          "Feel your feet pressing firmly against the floor beneath you. You are safe in this physical moment."
      } else {
        reply =
          "Thank you for sharing that with me. It takes emotional courage to articulate vulnerability. " +
          "If you were speaking to a dear friend who was in this exact situation, what compassionate advice would you offer them? " +
          "Often, we extend far more kindness to others than we permit ourselves to receive."
      }

      setMessages((prev) => [
        ...prev,
        {
          id: "th-" + Date.now(),
          role: "therapist",
          text: reply,
          distortionHint: distortion,
          toolSuggestion: tool,
        },
      ])
      setTyping(false)
    }, 1000)
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
      className="max-w-4xl mx-auto space-y-4"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <HeartHandshake className="w-6 h-6 text-soul-teal" />
          Digital Therapist (CBT Clinical Mode)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Evidence-based Cognitive Behavioral Therapy, distortion reframing, and immediate human escalation.
        </p>
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
                Need Human Medical or Clinical Care?
                <Badge variant="purple" size="sm">Licensed Doctors</Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                The digital therapist does not replace psychiatric care. You can consult with verified doctors anytime.
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

      {/* Chat Container */}
      <Card padding="none" className="h-[620px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-soul-teal to-emerald-500 flex items-center justify-center text-white">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">CBT Clinical Assistant</p>
              <p className="text-[10px] text-muted-foreground">Cognitive Restructuring & Somatic Regulation</p>
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
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                  m.role === "user"
                    ? "bg-soul-purple/20 text-soul-purple"
                    : "bg-soul-teal/20 text-soul-teal"
                }`}
              >
                {m.role === "user" ? <User className="w-4 h-4" /> : <HeartHandshake className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-soul-purple text-white rounded-br-md"
                    : "bg-secondary text-foreground rounded-bl-md border border-border/60"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>

                {m.distortionHint && CBT_DISTORTIONS[m.distortionHint] && (
                  <div className="mt-3 pt-2.5 border-t border-border/80 text-xs">
                    <span className="font-bold text-amber-400 block mb-0.5">
                      💡 Cognitive Distortion Identified: {CBT_DISTORTIONS[m.distortionHint].name}
                    </span>
                    <span className="text-muted-foreground">
                      {CBT_DISTORTIONS[m.distortionHint].advice}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {typing && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-soul-teal/20 text-soul-teal flex items-center justify-center">
                <HeartHandshake className="w-4 h-4" />
              </div>
              <div className="bg-secondary px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-150" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-300" />
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Therapy Starters */}
        <div className="px-4 py-2 border-t border-border/50 bg-secondary/20 flex flex-wrap gap-2">
          {[
            "I'm catastrophizing about an outcome",
            "I feel like a complete failure",
            "I feel panic in my chest right now",
            "I'm worried everyone is judging me",
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:border-soul-teal transition-all"
            >
              💭 {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what's weighing on you or what thought you want to reframe..."
              rows={1}
              className="flex-1 px-4 py-2.5 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-soul-teal/50 resize-none text-sm"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || typing}
              className="bg-soul-teal hover:bg-soul-teal/90 text-white font-bold"
              icon={<Send className="w-4 h-4" />}
            >
              Reflect
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

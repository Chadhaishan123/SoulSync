"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { MessageSquare, Send, Plus, Bot, User } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import { formatRelative } from "@/lib/formatters"
import type { ConversationSession, CompanionResponse } from "@/types/companion"
import toast from "react-hot-toast"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export default function CompanionPage() {
  const { user } = useAuth()
  const cleanEmail = user?.email?.trim().toLowerCase() || ""

  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [activeSession, setActiveSession] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cleanEmail) {
      loadSessions()
    }
  }, [cleanEmail])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadSessionMessages = async (sessionId: number) => {
    setActiveSession(sessionId)
    setLoadingHistory(true)

    // First check local cache for instant zero-lag rendering
    if (cleanEmail) {
      try {
        const rawCached = localStorage.getItem(`soulsync_companion_msgs_${cleanEmail}_${sessionId}`)
        if (rawCached) {
          const parsed = JSON.parse(rawCached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed)
          }
        }
      } catch {}
    }

    try {
      const remoteMsgs = await api.companion.messages(sessionId)
      if (remoteMsgs && remoteMsgs.length > 0) {
        const formatted: ChatMessage[] = remoteMsgs.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.created_at,
        }))
        setMessages(formatted)
        if (cleanEmail) {
          localStorage.setItem(`soulsync_companion_msgs_${cleanEmail}_${sessionId}`, JSON.stringify(formatted))
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote messages, relying on cache:", err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadSessions = async () => {
    let localSessList: ConversationSession[] = []
    if (cleanEmail) {
      try {
        const rawSess = localStorage.getItem(`soulsync_companion_sessions_${cleanEmail}`)
        if (rawSess) localSessList = JSON.parse(rawSess)
      } catch {}
    }

    try {
      const data = await api.companion.sessions()
      const effectiveList = data && data.length > 0 ? data : localSessList
      setSessions(effectiveList)

      if (cleanEmail && data && data.length > 0) {
        localStorage.setItem(`soulsync_companion_sessions_${cleanEmail}`, JSON.stringify(data))
      }

      // Automatically load the latest session if none currently open
      if (effectiveList.length > 0 && activeSession === null) {
        loadSessionMessages(effectiveList[0].id)
      }
    } catch {
      if (localSessList.length > 0) {
        setSessions(localSessList)
        if (activeSession === null) {
          loadSessionMessages(localSessList[0].id)
        }
      }
    }
  }

  const getCompanionFallback = (query: string, history: ChatMessage[] = []): string => {
    const q = query.toLowerCase().trim()
    const historyText = history.map((m) => m.content.toLowerCase()).join(" ")
    const pastReplies = history.filter((m) => m.role === "assistant").map((m) => m.content.toLowerCase())
    const isAlreadySent = (str: string) => pastReplies.some((p) => p.includes(str.slice(0, 40).toLowerCase()))

    // Emotion detection
    const isFrustrated = q.includes("tried") || q.includes("doesn't work") || q.includes("doesnt work") || q.includes("hate") || q.includes("stuck") || q.includes("pointless")
    const isExhausted = q.includes("exhausted") || q.includes("drained") || q.includes("can't anymore") || q.includes("no energy") || q.includes("collapse")
    const isCurious = q.startsWith("why") || q.includes("how come") || q.includes("explain") || q.includes("what does that mean")
    const isReceptive = ["yes", "yeah", "sure", "ok", "okay", "agree", "will try", "makes sense"].some((w) => q === w || q.startsWith(w + " "))

    // Active Topic across conversation
    let topic: "sleep" | "work" | "anxiety" | "sadness" | "relationships" | "general" = "general"
    if (q.includes("sleep") || q.includes("tired") || q.includes("insomnia") || q.includes("bed") || historyText.includes("sleep")) {
      topic = "sleep"
    } else if (q.includes("work") || q.includes("study") || q.includes("burnout") || q.includes("exam") || q.includes("boss") || historyText.includes("work")) {
      topic = "work"
    } else if (q.includes("breathe") || q.includes("anxious") || q.includes("panic") || q.includes("worry") || historyText.includes("anxious")) {
      topic = "anxiety"
    } else if (q.includes("sad") || q.includes("depress") || q.includes("cry") || q.includes("grief") || historyText.includes("sad")) {
      topic = "sadness"
    } else if (q.includes("relationship") || q.includes("friend") || q.includes("partner") || q.includes("fight") || historyText.includes("relationship")) {
      topic = "relationships"
    }

    let reply = ""

    if (isFrustrated) {
      reply = "I hear your frustration completely. When you're already carrying so much mental fatigue, standard advice can feel hollow. You don't have to force yourself to do anything right now. If we set all expectations aside, what would bring you even 1% relief in this moment?"
    } else if (isExhausted) {
      reply = "I can sense how completely drained you are. Please treat today as an intentional rest day. Give your body and mind permission to stop pushing. Can you step away from screens for a little while and let yourself rest?"
    } else if (isCurious) {
      if (topic === "sleep") {
        reply = "When our circadian rhythms are disrupted, the emotional center of our brain (the amygdala) becomes significantly more reactive. That's why everyday stressors feel so amplified when we're sleep-deprived. Would you like to explore gentle wind-down routines or sleep environment resets?"
      } else if (topic === "work") {
        reply = "Every time we switch between tasks or worry about unfinished work, our brain retains 'attentional residue'. That cognitive friction quickly depletes executive energy. Taking 5-minute pauses between focused sprints prevents burnout before it starts."
      } else {
        reply = "Our mind and body are in constant feedback. When thoughts anticipate tension, physical muscles tighten and pulse rates rise, signaling back to the brain that danger is present. Conscious breathing interrupts that feedback loop."
      }
    } else if (isReceptive && history.length > 0) {
      if (topic === "sleep") {
        reply = "That's wonderful. Let's make that your gentle intention for tonight: dim lights 30 minutes before bed and set your phone aside. I'm cheering for you to have a restorative night!"
      } else if (topic === "work") {
        reply = "Taking that pause is a huge victory for your focus. Give yourself permission to tackle one micro-step at a time. What is the single next task you're approaching with a calmer mind?"
      } else if (topic === "anxiety") {
        reply = "Notice the slight release in your chest when you give yourself permission to pause. Even three deep belly breaths make a measurable difference. Would you like to try another grounding breath?"
      } else {
        reply = "That awareness is meaningful progress. Taking small, consistent steps is what builds lasting calm. What feels like the kindest next step for you today?"
      }
    } else if (q.includes("hi") || q.includes("hello") || q.includes("hey")) {
      reply = "Hello! I'm right here with you. How is your day treating you so far? Tell me what's on your mind."
    } else if (topic === "anxiety") {
      if (isAlreadySent("Let's take a slow 4-7-8 breath")) {
        reply = "Try this grounding check right now: look around and spot 3 green or blue objects, feel the temperature of the air on your hands, and let your jaw unclench. You are safe in this physical moment."
      } else {
        reply = "Let's take a slow 4-7-8 breath together right now: Inhale gently for 4 counts... Hold softly for 7... Exhale slowly through your mouth for 8. Feel your shoulders drop. What is making you feel anxious?"
      }
    } else if (topic === "sadness") {
      if (isAlreadySent("I hear how heavy things feel")) {
        reply = "You don't need to explain or justify your sadness to anyone today. Sometimes the most healing thing is simply curling up with warmth and allowing yourself to rest without guilt."
      } else {
        reply = "I hear how heavy things feel right now, and I want you to know it's completely okay to feel sad. You don't have to carry it all by yourself. What's weighing on you today?"
      }
    } else if (topic === "sleep") {
      if (q.includes("wake") || q.includes("3am") || q.includes("4am") || q.includes("middle")) {
        reply = "Waking up in the night often comes from a blood sugar dip or sudden adrenaline surge. Do NOT look at your clock or phone. Keep your eyes closed, breathe deeply, and tell your brain: 'Resting quietly is still restoring my energy.' If awake after 20 minutes, sit in dim light with a book until you feel drowsy."
      } else if (isAlreadySent("Sleep is foundational")) {
        reply = "For tonight's wind-down, keep the room cool (~18-19°C), dim your bedroom lighting 45 minutes before sleep, and try doing a 3-minute brain dump on physical paper to unburden your mind."
      } else {
        reply = "Sleep is foundational for mental recovery. If your mind is racing in bed, try journaling your thoughts onto paper or listening to calming brown noise. What is keeping you awake?"
      }
    } else if (topic === "work") {
      if (q.includes("deadline") || q.includes("exam") || q.includes("boss") || q.includes("tomorrow")) {
        reply = "When deadlines loom, the brain enters freeze mode because the whole mountain seems impossible. Shrink it down: what is one 2-minute micro-action you can take right now? Just opening the tab or writing one heading breaks the freeze."
      } else if (isAlreadySent("It sounds like you're carrying a lot of mental weight")) {
        reply = "Remember: you are a human being, not an output machine. Your worth doesn't fluctuate with your productivity. What is one non-essential task you can give yourself permission to ignore today?"
      } else {
        reply = "It sounds like you're carrying a lot of mental weight. Remember that rest is essential fuel, not something you have to earn. Can you give yourself a 10-minute break away from screens?"
      }
    }

    if (!reply || isAlreadySent(reply)) {
      const snippet = query.length > 55 ? query.slice(0, 52) + "..." : query
      reply = `Thank you for sharing that — "${snippet}". Looking at your present moment, what is one small thing right now that would bring you a sense of grounded comfort?`
    }

    return reply
  }

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    if (!text) return
    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setSending(true)

    try {
      const response: CompanionResponse = await api.companion.send(
        userMessage.content,
        activeSession
      )
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.reply,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => {
        const updated = [...prev, assistantMessage]
        const targetSid = activeSession || response.session_id
        if (targetSid && cleanEmail) {
          try {
            localStorage.setItem(`soulsync_companion_msgs_${cleanEmail}_${targetSid}`, JSON.stringify(updated))
          } catch {}
        }
        return updated
      })

      if (!activeSession) {
        setActiveSession(response.session_id)
        loadSessions()
      }
    } catch {
      // Dynamic fallback if server is waking up or network blipped
      const reply = getCompanionFallback(userMessage.content, [...messages, userMessage])
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => {
        const updated = [...prev, assistantMessage]
        const targetSid = activeSession || 1
        if (targetSid && cleanEmail) {
          try {
            localStorage.setItem(`soulsync_companion_msgs_${cleanEmail}_${targetSid}`, JSON.stringify(updated))
          } catch {}
        }
        return updated
      })
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const startNewChat = () => {
    setActiveSession(null)
    setMessages([])
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-4"
    >
      {/* Sidebar - Sessions */}
      <div className="md:w-64 shrink-0 space-y-2">
        <Button
          onClick={startNewChat}
          variant="secondary"
          size="sm"
          className="w-full"
          icon={<Plus className="w-4 h-4" />}
        >
          New Conversation
        </Button>
        <div className="space-y-1 max-h-[300px] md:max-h-none overflow-y-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSessionMessages(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                activeSession === s.id
                  ? "bg-soul-purple/10 text-soul-purple font-medium border border-soul-purple/20"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <p className="font-medium truncate">{s.title || `Chat #${s.id}`}</p>
              <p className="text-[10px] opacity-60">{s.message_count} messages</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <Card padding="none" className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-soul-coral to-pink-500 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">SoulSync Companion</p>
            <p className="text-[10px] text-muted-foreground">Data-grounded AI · FLAN-T5</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loadingHistory && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <div className="w-8 h-8 border-2 border-soul-purple border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading conversation history...</p>
            </div>
          )}

          {!loadingHistory && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-soul-coral/10 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-soul-coral" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Chat with your Companion</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ask about your patterns, mood trends, sleep quality, or anything on your mind.
                Responses are grounded in your actual data.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-3 max-w-lg">
                {[
                  "I'm feeling anxious right now",
                  "Guide me through a calming breath",
                  "Why has my mood been low?",
                  "What patterns do you see?",
                  "Help me reframe an overwhelming thought",
                  "How can I sleep better tonight?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="text-xs px-3 py-1.5 rounded-full bg-secondary border border-border/60 text-muted-foreground hover:text-foreground hover:border-soul-purple hover:bg-soul-purple/10 transition-all cursor-pointer"
                  >
                    ✨ {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5, x: msg.role === "user" ? 10 : -10 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                msg.role === "user"
                  ? "bg-soul-purple/20"
                  : "bg-gradient-to-br from-soul-coral to-pink-500"
              }`}>
                {msg.role === "user"
                  ? <User className="w-3.5 h-3.5 text-soul-purple" />
                  : <Bot className="w-3.5 h-3.5 text-white" />
                }
              </div>
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-soul-purple text-white rounded-br-md"
                  : "bg-secondary text-foreground rounded-bl-md"
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-soul-coral to-pink-500 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-secondary px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
                <span className="w-2 h-2 rounded-full bg-muted-foreground typing-dot" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your wellness..."
              rows={1}
              className="flex-1 px-4 py-2.5 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none text-sm"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || sending}
              size="md"
              icon={<Send className="w-4 h-4" />}
            >
              Send
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

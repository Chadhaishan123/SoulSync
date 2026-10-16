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
      reply = "I really hear you. When you're already carrying so much on your shoulders, generic advice can feel completely hollow and frustrating. You don't have to force yourself to do anything right now. Let's take off all the pressure. What would bring you even a tiny shred of comfort right now?"
    } else if (isExhausted) {
      reply = "I can tell how deeply drained you feel. Please give yourself permission to just stop pushing. You don't have to carry the whole world today. Can you step away for a bit and let your body and mind actually rest?"
    } else if (isCurious) {
      if (topic === "sleep") {
        reply = "When we don't get enough sleep, everything in life feels magnified. Small annoyances suddenly feel like massive hurdles, and our patience runs thin. It's not a personal failure — your inner battery is simply depleted. How has your sleep been feeling lately?"
      } else if (topic === "work") {
        reply = "Juggling so many tasks at once leaves our minds constantly buzzing in the background. It drains our mental fuel before we even realize it. Taking small, quiet breathers throughout the day isn't being lazy — it's how you protect yourself from burning out."
      } else {
        reply = "Our emotions and our bodies are constantly in conversation. When we feel overwhelmed, our muscles tighten and our breath gets shallow without us even noticing. Just acknowledging what you're feeling helps soften that tension."
      }
    } else if (isReceptive && history.length > 0) {
      if (topic === "sleep") {
        reply = "I'm really glad to hear that. Be gentle with yourself tonight. Dim the lights early, leave your phone across the room, and let yourself sink into quiet. You deserve good rest."
      } else if (topic === "work") {
        reply = "That's a really healthy choice. Tackling one tiny piece at a time is so much kinder to yourself than trying to finish the whole mountain. What's the next small thing you want to look at?"
      } else if (topic === "anxiety") {
        reply = "Notice how even taking a moment to breathe gives your chest a little more room. You're doing great just by pausing. How does your body feel right now?"
      } else {
        reply = "That awareness is really wonderful. Taking small, kind steps for yourself is how real calm is built. What feels like the gentlest next step for you today?"
      }
    } else if (q.includes("hi") || q.includes("hello") || q.includes("hey")) {
      reply = "Hey, I'm really glad you reached out today. How are you really doing right now? Tell me whatever is on your heart."
    } else if (topic === "anxiety") {
      if (isAlreadySent("Let's slow everything down")) {
        reply = "Feel your feet on the ground, drop your shoulders away from your ears, and take one slow breath with me. You don't have to figure out all of tomorrow right now. You are safe in this moment."
      } else {
        reply = "Let's slow everything down for just a moment. Breathe in softly... and let out a long, slow sigh. You don't have to carry every worry alone. What's the main thought that's weighing on you right now?"
      }
    } else if (topic === "sadness") {
      if (isAlreadySent("I'm really sorry you're hurting")) {
        reply = "You don't need to put on a brave face or explain your sadness to anyone today. Sometimes the kindest thing you can do is just wrap yourself in warmth and let yourself rest without guilt."
      } else {
        reply = "I'm really sorry you're hurting right now. It's completely okay to feel sad, and you don't have to pretend everything is fine here. I'm right here with you. What's been feeling so heavy?"
      }
    } else if (topic === "sleep") {
      if (q.includes("wake") || q.includes("3am") || q.includes("4am") || q.includes("middle")) {
        reply = "Waking up in the middle of the night can be so frustrating. Try not to check the clock or your phone — seeing the time only wakes your brain up more. Keep your eyes closed, breathe slowly, and remind yourself: simply resting quietly with your eyes closed is still recharging your body."
      } else if (isAlreadySent("Sleep can be so hard")) {
        reply = "Before bed tonight, try writing down whatever is circling in your head onto a piece of paper so your mind doesn't feel like it has to keep holding it all night. What has been keeping you up?"
      } else {
        reply = "Sleep can be so hard when your mind has so much running through it. You're not alone in struggling with this. What's been on your mind when your head hits the pillow?"
      }
    } else if (topic === "work") {
      if (q.includes("deadline") || q.includes("exam") || q.includes("boss") || q.includes("tomorrow")) {
        reply = "When big deadlines approach, the whole mountain feels impossible and our brains just want to freeze. Shrink it way down: what is one tiny 2-minute step you can do? Just opening the document or typing one sentence breaks the freeze."
      } else if (isAlreadySent("You are a human being")) {
        reply = "Remember: your worth as a person doesn't change with how productive you were today. Give yourself permission to let go of what isn't urgent."
      } else {
        reply = "It sounds like you've been carrying a tremendous amount of weight. Rest isn't a reward you have to earn — you need it to live. Can you take even 5 quiet minutes away from screens to catch your breath?"
      }
    }

    if (!reply || isAlreadySent(reply)) {
      reply = "I'm really listening. Tell me more about that if you'd like — I'm right here with you."
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

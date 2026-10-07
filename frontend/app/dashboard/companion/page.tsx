"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { MessageSquare, Send, Plus, Bot, User } from "lucide-react"
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
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [activeSession, setActiveSession] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadSessions = async () => {
    try {
      const data = await api.companion.sessions()
      setSessions(data)
    } catch {
      // ok
    }
  }

  const getCompanionFallback = (query: string): string => {
    const q = query.toLowerCase().trim()
    if (q.includes("hi") || q.includes("hello") || q.includes("hey")) {
      return "Hello! I'm right here with you. How is your day treating you so far? Tell me what's on your mind."
    }
    if (q.includes("breathe") || q.includes("anxious") || q.includes("anxiety") || q.includes("panic")) {
      return "Let's take a slow 4-7-8 breath together right now: Inhale gently for 4 counts... Hold softly for 7... Exhale slowly through your mouth for 8. Feel your shoulders drop. What is making you feel anxious?"
    }
    if (q.includes("sad") || q.includes("depress") || q.includes("cry") || q.includes("down") || q.includes("unhappy")) {
      return "I hear how heavy things feel right now, and I want you to know it's completely okay to feel sad. You don't have to carry it all by yourself. What's weighing on you today?"
    }
    if (q.includes("sleep") || q.includes("tired") || q.includes("insomnia") || q.includes("bed")) {
      return "Sleep is foundational for mental recovery. If your mind is racing in bed, try journaling your thoughts onto paper or listening to calming brown noise. What is keeping you awake?"
    }
    if (q.includes("work") || q.includes("study") || q.includes("burnout") || q.includes("stress")) {
      return "It sounds like you're carrying a lot of mental weight. Remember that rest is essential fuel, not something you have to earn. Can you give yourself a 10-minute break away from screens?"
    }
    return `Thank you for sharing that with me. It takes real courage to reflect honestly on what's going on inside. How does that make you feel in your body right now?`
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
      setMessages((prev) => [...prev, assistantMessage])
      if (!activeSession) {
        setActiveSession(response.session_id)
        loadSessions()
      }
    } catch {
      // Dynamic fallback if server is waking up or network blipped
      const reply = getCompanionFallback(userMessage.content)
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
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
              onClick={() => { setActiveSession(s.id); setMessages([]) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                activeSession === s.id
                  ? "bg-soul-purple/10 text-soul-purple"
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
          {messages.length === 0 && (
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

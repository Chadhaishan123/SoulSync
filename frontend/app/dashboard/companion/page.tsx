"use client"

import React, { useState, useRef, useEffect } from "react"
import DashboardLayout from "@/components/DashboardLayout"
import { Send, Sparkles, MessageSquare, AlertCircle } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

export default function CompanionPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm your SoulSync wellness companion. How are you feeling today, and what's on your mind?" }
  ])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return

    const userMessage = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: userMessage }])
    setSending(true)

    const token = localStorage.getItem("token")
    const chatHistory = messages.map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch("http://localhost:8000/api/companion/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          history: chatHistory
        })
      })

      if (res.status === 200) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I ran into an error connecting to my thought processors. Please try again." }])
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: "assistant", content: "I couldn't reach the backend server. Please verify the FastAPI service is running." }])
    } finally {
      setSending(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto flex flex-col h-[76vh] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-gray-800 text-sm">AI Wellness Companion</h3>
              <p className="text-[10px] text-gray-400">Context-Aware Wellness Support</p>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-yellow-500" /> Powered by Local NLP
          </span>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, index) => {
            const isUser = msg.role === "user"
            return (
              <div 
                key={index} 
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[70%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm border ${
                    isUser 
                      ? "bg-blue-600 border-blue-600 text-white rounded-tr-none" 
                      : "bg-gray-50 border-gray-100 text-gray-800 rounded-tl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Discuss your stress, sleep, or mood trends..."
            className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white p-2.5 rounded-xl transition-all shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Footer Disclaimer */}
        <div className="bg-amber-50/60 px-6 py-2 border-t border-gray-100 flex items-center gap-2 text-[10px] text-amber-700 leading-normal">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <p>
            Disclaimer: The companion is a support tool, not a doctor. It does not provide diagnoses or replacement treatment.
          </p>
        </div>

      </div>
    </DashboardLayout>
  )
}

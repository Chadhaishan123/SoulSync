"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { BookOpen, Send, Sparkles } from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import NLPAnalysisPanel from "@/components/features/NLPAnalysisPanel"
import { EMOTION_EMOJIS } from "@/lib/constants"
import { formatDate, formatRelative } from "@/lib/formatters"
import type { JournalEntry } from "@/types/journal"
import toast from "react-hot-toast"

export default function JournalPage() {
  const [content, setContent] = useState("")
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      const data = await api.journal.list()
      setEntries(data)
    } catch {
      // graceful degradation
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Write something first")
      return
    }
    setSaving(true)
    try {
      const entry = await api.journal.create({ content: content.trim() })
      toast.success("Journal entry saved!")
      setContent("")
      // Auto-analyze
      if (entry?.id) {
        setAnalyzing(entry.id)
        try {
          await api.journal.analyze(entry.id)
          toast.success("NLP analysis complete ✨")
        } catch {
          // NLP may not be enabled
        }
        setAnalyzing(null)
      }
      loadEntries()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save entry")
    } finally {
      setSaving(false)
    }
  }

  const handleAnalyze = async (entryId: number) => {
    setAnalyzing(entryId)
    try {
      await api.journal.analyze(entryId)
      toast.success("Analysis complete ✨")
      loadEntries()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setAnalyzing(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-soul-teal" />
          AI Journal
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Write freely. Our NLP engine detects emotions and scores sentiment automatically.
        </p>
      </div>

      {/* Editor */}
      <Card variant="glow">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="How was your day? What's on your mind? Write anything that comes to you..."
          className="w-full h-40 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none resize-none text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {content.length} characters
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="accent" size="sm" icon={<Sparkles className="w-3 h-3" />}>
              Auto NLP
            </Badge>
            <Button
              onClick={handleSave}
              isLoading={saving}
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              disabled={!content.trim()}
            >
              Save & Analyze
            </Button>
          </div>
        </div>
      </Card>

      {/* Entry History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground">Past Entries</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-3" />
                <div className="h-3 w-full bg-muted rounded mb-2" />
                <div className="h-3 w-3/4 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground text-center py-6">
              No journal entries yet. Start writing above to get your first NLP analysis!
            </p>
          </Card>
        ) : (
          entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {formatDate(entry.written_at)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(entry.written_at)}
                    </span>
                  </div>
                  {entry.analysis?.dominant_emotion && (
                    <Badge
                      variant={
                        entry.analysis.dominant_emotion === "Happy" ? "success" :
                        entry.analysis.dominant_emotion === "Sad" ? "info" :
                        entry.analysis.dominant_emotion === "Anxious" ? "warning" :
                        entry.analysis.dominant_emotion === "Angry" ? "danger" :
                        "default"
                      }
                      icon={<span>{EMOTION_EMOJIS[entry.analysis.dominant_emotion]}</span>}
                    >
                      {entry.analysis.dominant_emotion}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {entry.content}
                </p>
                {entry.analysis ? (
                  <NLPAnalysisPanel analysis={entry.analysis} className="mt-4" />
                ) : (
                  <div className="mt-4 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      variant="ghost"
                      isLoading={analyzing === entry.id}
                      onClick={() => handleAnalyze(entry.id)}
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                    >
                      Run NLP Analysis
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  )
}

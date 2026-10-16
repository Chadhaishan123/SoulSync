"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BookOpen,
  Send,
  Sparkles,
  Search,
  Heart,
  RefreshCw,
  RotateCcw,
  Smile,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Quote,
  Lightbulb,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
} from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import NLPAnalysisPanel from "@/components/features/NLPAnalysisPanel"
import { EMOTION_EMOJIS } from "@/lib/constants"
import { formatDate, formatRelative } from "@/lib/formatters"
import type { JournalEntry } from "@/types/journal"
import toast from "react-hot-toast"

type JournalMode = "reflection" | "gratitude" | "reframe"

interface ReframeState {
  original_thought: string
  distortion: string
  explanation: string
  balanced_perspective: string
  actionable_affirmation: string
}

export default function JournalPage() {
  const [activeMode, setActiveMode] = useState<JournalMode>("reflection")
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Mode 1: Reflection
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState<number | null>(null)

  // Mode 2: Gratitude (3-Good-Things)
  const [gratitude1, setGratitude1] = useState("")
  const [gratitude2, setGratitude2] = useState("")
  const [gratitude3, setGratitude3] = useState("")

  // Mode 3: CBT Thought Reframe
  const [situationInput, setSituationInput] = useState("")
  const [automaticThought, setAutomaticThought] = useState("")
  const [reframing, setReframing] = useState(false)
  const [reframeResult, setReframeResult] = useState<ReframeState | null>(null)

  // AI Prompt ("Inspire Me")
  const [aiPrompt, setAiPrompt] = useState<{ prompt: string; category: string }>({
    prompt: "What is an experience from today that quietly shifted your perspective or energy?",
    category: "Mindfulness",
  })
  const [loadingPrompt, setLoadingPrompt] = useState(false)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEmotionFilter, setSelectedEmotionFilter] = useState<string>("All")
  const [selectedKindFilter, setSelectedKindFilter] = useState<string>("All")

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      const data = await api.journal.list()
      setEntries(data || [])
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false)
    }
  }

  // Fetch a new AI Prompt
  const handleFetchPrompt = async () => {
    setLoadingPrompt(true)
    try {
      const res = await api.journal.getPrompt()
      setAiPrompt(res)
    } catch {
      const fallbacks = [
        { prompt: "What was a quiet moment today where you felt most like yourself?", category: "Mindfulness" },
        { prompt: "What is an emotion you experienced recently that felt difficult to name or express?", category: "Emotional Awareness" },
        { prompt: "What is a boundary you held or wish you had held today to protect your peace?", category: "Self-Care" },
        { prompt: "If you spoke to yourself right now with the kindness of your closest friend, what would you say?", category: "Self-Compassion" },
      ]
      setAiPrompt(fallbacks[Math.floor(Math.random() * fallbacks.length)])
    } finally {
      setLoadingPrompt(false)
    }
  }

  // Apply Prompt into Reflection Textarea
  const handleUsePrompt = (promptText: string) => {
    setActiveMode("reflection")
    setContent((prev) => (prev ? `${prev}\n\nPrompt: ${promptText}\n` : `Prompt: ${promptText}\n\n`))
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  // Save Reflection Entry
  const handleSaveReflection = async () => {
    if (!content.trim()) {
      toast.error("Write something first")
      return
    }
    setSaving(true)
    try {
      const entry = await api.journal.create({
        content: content.trim(),
        title: title.trim() || undefined,
        kind: "reflection",
      })
      toast.success("Reflection saved!")
      setContent("")
      setTitle("")

      if (entry?.id) {
        setAnalyzing(entry.id)
        try {
          await api.journal.analyze(entry.id)
          toast.success("NLP Emotional Analysis complete ✨")
        } catch {
          // NLP optional
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

  // Save Gratitude Entry
  const handleSaveGratitude = async () => {
    const items = [gratitude1.trim(), gratitude2.trim(), gratitude3.trim()].filter(Boolean)
    if (items.length === 0) {
      toast.error("Write at least one thing you're grateful for")
      return
    }
    setSaving(true)
    try {
      const contentFormatted = items.map((it, idx) => `${idx + 1}. ${it}`).join("\n")
      const entry = await api.journal.create({
        content: contentFormatted,
        title: "3 Good Things • Gratitude",
        kind: "gratitude",
      })
      toast.success("Gratitude items logged! 🌱")
      setGratitude1("")
      setGratitude2("")
      setGratitude3("")

      if (entry?.id) {
        try {
          await api.journal.analyze(entry.id)
        } catch {}
      }
      loadEntries()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save gratitude")
    } finally {
      setSaving(false)
    }
  }

  // Run CBT Reframe Analysis
  const handleRunReframe = async () => {
    if (!automaticThought.trim()) {
      toast.error("Enter the thought you want to reframe")
      return
    }
    setReframing(true)
    try {
      const res = await api.journal.reframe(automaticThought.trim())
      setReframeResult(res)
    } catch {
      // Local fallback
      setReframeResult({
        original_thought: automaticThought,
        distortion: "All-or-Nothing / Catastrophizing",
        explanation: "The thought exaggerates temporary difficulty into a permanent or catastrophic conclusion.",
        balanced_perspective: "This situation is a challenge, but it does not define my future or worth. I can take it one calm breath at a time.",
        actionable_affirmation: "One difficult moment does not equal a difficult life.",
      })
    } finally {
      setReframing(false)
    }
  }

  // Save CBT Reframe to Journal
  const handleSaveReframe = async () => {
    if (!reframeResult) return
    setSaving(true)
    try {
      const formatted = `Situation: ${situationInput.trim() || "Daily Stress"}\n\nAutomatic Thought: "${reframeResult.original_thought}"\n\nCognitive Distortion: ${reframeResult.distortion}\nWhy: ${reframeResult.explanation}\n\nBalanced Perspective: ${reframeResult.balanced_perspective}\n\nGrounding Affirmation: ${reframeResult.actionable_affirmation}`
      await api.journal.create({
        content: formatted,
        title: `CBT Reframe: ${reframeResult.distortion}`,
        kind: "reframe",
      })
      toast.success("Thought reframe saved to journal! 🕊️")
      setSituationInput("")
      setAutomaticThought("")
      setReframeResult(null)
      loadEntries()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save reframe")
    } finally {
      setSaving(false)
    }
  }

  // Manual Trigger NLP Analysis on an Entry
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

  // Filtered Entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      !searchQuery.trim() ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.title && entry.title.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesEmotion =
      selectedEmotionFilter === "All" ||
      entry.analysis?.dominant_emotion?.toLowerCase() === selectedEmotionFilter.toLowerCase()

    const matchesKind =
      selectedKindFilter === "All" || entry.kind === selectedKindFilter

    return matchesSearch && matchesEmotion && matchesKind
  })

  const emotionsList = ["All", "Joy", "Calm", "Sad", "Anxious", "Angry", "Neutral"]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-7 pb-12"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-soul-teal" />
            AI Mindfulness Journal
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Express yourself freely. Supported by AI daily prompts, CBT cognitive reframing, and emotion analysis.
          </p>
        </div>
      </div>

      {/* ── 2. "INSPIRE ME" DAILY PROMPT BANNER ── */}
      <Card variant="glow" padding="md" className="relative overflow-hidden border-soul-purple/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl bg-soul-purple/15 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-5 h-5 text-soul-purple" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-soul-purple">
                  Daily AI Prompt
                </span>
                <Badge variant="purple" size="sm">{aiPrompt.category}</Badge>
              </div>
              <p className="text-sm text-foreground font-medium italic leading-relaxed">
                "{aiPrompt.prompt}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleFetchPrompt}
              disabled={loadingPrompt}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPrompt ? "animate-spin" : ""}`} />
              Inspire Me
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => handleUsePrompt(aiPrompt.prompt)}
              className="text-xs gap-1.5"
            >
              Use Prompt
            </Button>
          </div>
        </div>
      </Card>

      {/* ── 4. MULTI-MODE JOURNALING TABS ── */}
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex p-1 bg-muted/40 rounded-xl border border-border/50 max-w-md">
          <button
            onClick={() => setActiveMode("reflection")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeMode === "reflection"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-soul-purple" />
            Free Reflection
          </button>
          <button
            onClick={() => setActiveMode("gratitude")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeMode === "gratitude"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            Gratitude (3 Things)
          </button>
          <button
            onClick={() => setActiveMode("reframe")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeMode === "reframe"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-soul-teal" />
            CBT Thought Reframe
          </button>
        </div>

        {/* Tab 1: Free Reflection */}
        {activeMode === "reflection" && (
          <Card>
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional)..."
                className="w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-border/40 pb-2"
              />
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's unfolding inside your mind today? Write candidly about your thoughts, emotions, and subtle observations..."
                className="w-full h-44 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none resize-none text-sm leading-relaxed"
              />
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  {content.length} characters • {content.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="accent" size="sm" icon={<Sparkles className="w-3 h-3" />}>
                    Auto NLP Analysis
                  </Badge>
                  <Button
                    onClick={handleSaveReflection}
                    isLoading={saving}
                    size="sm"
                    icon={<Send className="w-3.5 h-3.5" />}
                    disabled={!content.trim()}
                  >
                    Save & Analyze
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tab 2: 3-Good-Things Gratitude */}
        {activeMode === "gratitude" && (
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">3 Good Things • Gratitude Practice</h3>
                  <p className="text-xs text-muted-foreground">
                    Documenting three specific positive moments trains attention toward positive neural pathways.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { val: gratitude1, setVal: setGratitude1, num: "1", hint: "A pleasant interaction, kind gesture, or good news..." },
                  { val: gratitude2, setVal: setGratitude2, num: "2", hint: "A small personal achievement or progress made..." },
                  { val: gratitude3, setVal: setGratitude3, num: "3", hint: "A quiet sensory pleasure (warm coffee, sunlight, soft music)..." },
                ].map((item) => (
                  <div key={item.num} className="flex items-center gap-3 p-2 rounded-xl bg-muted/20 border border-border/40">
                    <span className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 font-bold text-xs flex items-center justify-center shrink-0">
                      {item.num}
                    </span>
                    <input
                      type="text"
                      value={item.val}
                      onChange={(e) => item.setVal(e.target.value)}
                      placeholder={item.hint}
                      className="w-full bg-transparent text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t border-border/40">
                <Button
                  onClick={handleSaveGratitude}
                  isLoading={saving}
                  size="sm"
                  disabled={!gratitude1.trim() && !gratitude2.trim() && !gratitude3.trim()}
                  icon={<Heart className="w-3.5 h-3.5" />}
                >
                  Save Gratitude Log
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Tab 3: CBT Thought Reframe */}
        {activeMode === "reframe" && (
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-soul-teal" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">CBT Cognitive Thought Reframing</h3>
                  <p className="text-xs text-muted-foreground">
                    Examine harsh self-criticism or anxiety, detect cognitive distortions, and construct a balanced view.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Situation (Trigger event)
                  </label>
                  <input
                    type="text"
                    value={situationInput}
                    onChange={(e) => setSituationInput(e.target.value)}
                    placeholder="e.g. My boss sent a calendar invite without description..."
                    className="w-full px-3 py-2 text-sm rounded-xl bg-muted/30 border border-border focus:border-soul-purple focus:outline-none placeholder:text-muted-foreground/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Automatic Negative Thought
                  </label>
                  <textarea
                    value={automaticThought}
                    onChange={(e) => setAutomaticThought(e.target.value)}
                    placeholder="e.g. I did something terrible and I am definitely getting fired..."
                    className="w-full h-20 p-3 text-sm rounded-xl bg-muted/30 border border-border focus:border-soul-purple focus:outline-none resize-none placeholder:text-muted-foreground/60"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleRunReframe}
                    isLoading={reframing}
                    size="sm"
                    disabled={!automaticThought.trim()}
                    className="gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Analyze & Reframe Thought
                  </Button>
                </div>
              </div>

              {/* ── 3. AI REFRAME RESULT ── */}
              <AnimatePresence>
                {reframeResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-4 rounded-xl bg-soul-teal/10 border border-soul-teal/25 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-soul-teal/20 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="purple" size="sm">
                          Distortion: {reframeResult.distortion}
                        </Badge>
                      </div>
                      <span className="text-xs text-soul-teal font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> CBT Restructured
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground italic">
                      "{reframeResult.explanation}"
                    </p>

                    <div className="p-3 rounded-lg bg-background/60 border border-border/40">
                      <span className="text-xs font-semibold text-foreground block mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        Balanced Alternative Perspective:
                      </span>
                      <p className="text-sm text-foreground leading-relaxed">
                        {reframeResult.balanced_perspective}
                      </p>
                    </div>

                    <div className="text-xs text-soul-purple font-medium flex items-center gap-1.5">
                      <Quote className="w-3.5 h-3.5" />
                      Affirmation: "{reframeResult.actionable_affirmation}"
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        size="sm"
                        variant="accent"
                        onClick={handleSaveReframe}
                        isLoading={saving}
                      >
                        Save Reframe to Journal
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        )}
      </div>

      {/* ── 5. SEARCH & EMOTION FILTER ── */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>Past Reflections & Entries</span>
            <Badge variant="default" size="sm">{filteredEntries.length}</Badge>
          </h3>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-muted/30 border border-border focus:border-soul-purple focus:outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Emotion and Kind Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3" /> Emotion:
          </span>
          {emotionsList.map((emo) => (
            <button
              key={emo}
              onClick={() => setSelectedEmotionFilter(emo)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                selectedEmotionFilter === emo
                  ? "bg-soul-purple text-white shadow-sm"
                  : "bg-muted/30 hover:bg-muted/60 text-muted-foreground"
              }`}
            >
              {emo}
            </button>
          ))}

          <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />

          <button
            onClick={() => setSelectedKindFilter(selectedKindFilter === "All" ? "gratitude" : selectedKindFilter === "gratitude" ? "reframe" : "All")}
            className="text-xs px-2.5 py-1 rounded-lg bg-card border border-border/50 text-muted-foreground hover:text-foreground ml-auto"
          >
            Type: {selectedKindFilter === "All" ? "All Types" : selectedKindFilter.toUpperCase()}
          </button>
        </div>

        {/* Entries List */}
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
        ) : filteredEntries.length === 0 ? (
          <Card>
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery || selectedEmotionFilter !== "All"
                ? "No entries match your search criteria."
                : "No journal entries yet. Start writing above to get your first emotional NLP analysis!"}
            </p>
          </Card>
        ) : (
          filteredEntries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {entry.title || formatDate(entry.written_at)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(entry.written_at)}
                      </span>
                    </div>
                    {entry.title && (
                      <span className="text-[11px] text-muted-foreground/70 block">
                        {formatDate(entry.written_at)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {entry.kind && entry.kind !== "reflection" && (
                      <Badge variant="purple" size="sm">
                        {entry.kind === "gratitude" ? "Gratitude" : "CBT Reframe"}
                      </Badge>
                    )}
                    {entry.analysis?.dominant_emotion && (
                      <Badge
                        variant={
                          entry.analysis.dominant_emotion === "Happy" || entry.analysis.dominant_emotion === "Joy" ? "success" :
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

"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Moon,
  Sparkles,
  BookOpen,
  Brain,
  Compass,
  Eye,
  Send,
  History,
  Trash2,
  ChevronRight,
  HelpCircle,
} from "lucide-react"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Input from "@/components/ui/Input"
import Slider from "@/components/ui/Slider"
import toast from "react-hot-toast"

interface DreamRecord {
  id: string
  title: string
  narrative: string
  wakingEmotion: string
  lucidity: number
  date: string
  archetypes: string[]
  symbols: { symbol: string; meaning: string }[]
  interpretation: string
  integrationPrompt: string
}

const STORAGE_KEY = "soulsync_dream_journal"

const WAKING_EMOTIONS = [
  { label: "Peaceful", emoji: "🕊️" },
  { label: "Anxious", emoji: "😰" },
  { label: "Mystical", emoji: "🔮" },
  { label: "Confused", emoji: "🌀" },
  { label: "Exhilarated", emoji: "⚡" },
  { label: "Melancholic", emoji: "🌧️" },
]

export default function DreamAnalyzerPage() {
  const [dreams, setDreams] = useState<DreamRecord[]>([])
  const [title, setTitle] = useState("")
  const [narrative, setNarrative] = useState("")
  const [wakingEmotion, setWakingEmotion] = useState("Peaceful")
  const [lucidity, setLucidity] = useState(3)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedDream, setSelectedDream] = useState<DreamRecord | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setDreams(JSON.parse(stored))
      }
    } catch {
      // ignore
    }
  }, [])

  const saveDreamsToStorage = (updated: DreamRecord[]) => {
    setDreams(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // ignore
    }
  }

  // Symbolism & psychological archetype analyzer
  const analyzeDream = () => {
    if (!narrative.trim()) {
      toast.error("Please describe your dream narrative")
      return
    }

    setAnalyzing(true)

    setTimeout(() => {
      const text = (title + " " + narrative).toLowerCase()

      const archetypes: string[] = []
      const symbols: { symbol: string; meaning: string }[] = []

      // Archetype checks
      if (text.includes("shadow") || text.includes("dark") || text.includes("chase") || text.includes("monster") || text.includes("demon")) {
        archetypes.push("The Shadow (Repressed fears or unexpressed desires)")
      }
      if (text.includes("water") || text.includes("ocean") || text.includes("sea") || text.includes("river") || text.includes("rain") || text.includes("drown")) {
        archetypes.push("The Unconscious Ocean (Deep intuitive & emotional currents)")
      }
      if (text.includes("fly") || text.includes("flying") || text.includes("sky") || text.includes("wings") || text.includes("bird")) {
        archetypes.push("The Transcendent (Aspiration for freedom & higher perspective)")
      }
      if (text.includes("door") || text.includes("gate") || text.includes("bridge") || text.includes("cross") || text.includes("path")) {
        archetypes.push("The Threshold (Life transitions and imminent choices)")
      }
      if (text.includes("fight") || text.includes("escape") || text.includes("save") || text.includes("quest") || text.includes("hero")) {
        archetypes.push("The Hero's Trial (Confronting waking obstacles)")
      }
      if (archetypes.length === 0) {
        archetypes.push("The Self (Integration of subconscious thoughts & daily experiences)")
      }

      // Symbolism checks
      if (text.includes("fall") || text.includes("falling")) {
        symbols.push({
          symbol: "Falling",
          meaning: "Subconscious signal of feeling a loss of control or support in a waking life scenario.",
        })
      }
      if (text.includes("fly") || text.includes("flying")) {
        symbols.push({
          symbol: "Flying",
          meaning: "Emancipation, breaking free from constraints, or gaining high-level clarity over your problems.",
        })
      }
      if (text.includes("water") || text.includes("ocean") || text.includes("river")) {
        symbols.push({
          symbol: "Water & Waves",
          meaning: "The fluid landscape of emotional processing. Clear water reflects clarity; turbulent water reflects suppressed tension.",
        })
      }
      if (text.includes("teeth") || text.includes("tooth")) {
        symbols.push({
          symbol: "Losing Teeth",
          meaning: "Underlying anxiety regarding self-image, social vulnerability, or sudden life transitions.",
        })
      }
      if (text.includes("house") || text.includes("room") || text.includes("building")) {
        symbols.push({
          symbol: "House / Rooms",
          meaning: "The architecture of your psyche. Unexplored rooms represent untapped faculties or hidden facets of self.",
        })
      }
      if (text.includes("late") || text.includes("clock") || text.includes("time") || text.includes("missed")) {
        symbols.push({
          symbol: "Clocks / Being Late",
          meaning: "Unconscious pressure or anxiety about missed opportunities and deadlines in your daily waking routine.",
        })
      }
      if (symbols.length === 0) {
        symbols.push({
          symbol: "Personal Imagery",
          meaning: "Unique personal symbols reflecting recent daily encounters and emotional consolidation during REM sleep.",
        })
      }

      // Core interpretation synthesis
      let interpretation = ""
      if (wakingEmotion === "Anxious" || text.includes("fear") || text.includes("chase")) {
        interpretation =
          "Your subconscious appears to be actively processing unresolved tension or avoidance patterns from waking hours. " +
          "Dreams often amplify themes our waking mind tries to compartmentalize. Rather than predicting negative events, " +
          "this dream acts as an emotional release valve, allowing your nervous system to metabolize latent stress safely."
      } else if (wakingEmotion === "Peaceful" || wakingEmotion === "Mystical") {
        interpretation =
          "This dream reflects a state of psychological harmony and integrative consolidation. " +
          "Your subconscious is aligning your daily values with your deeper desires, signaling emotional restoration and intuitive clarity."
      } else {
        interpretation =
          "This dream highlights a period of cognitive realignment. The symbols suggest your mind is experimenting with new perspectives, " +
          "reorganizing recent memories, and questioning assumptions that govern your day-to-day decisions."
      }

      const integrationPrompts = [
        "What waking life situation is currently demanding you confront an uncomfortable truth?",
        "Where in your life do you feel like you are being asked to take a leap of faith or let go of control?",
        "If the central figure in this dream could speak a single piece of advice to you today, what would it say?",
        "What emotions from this dream lingered most intensely when your eyes opened this morning?",
      ]

      const newRecord: DreamRecord = {
        id: Date.now().toString(),
        title: title.trim() || "Untitled Dream",
        narrative: narrative.trim(),
        wakingEmotion,
        lucidity,
        date: new Date().toISOString(),
        archetypes,
        symbols,
        interpretation,
        integrationPrompt:
          integrationPrompts[Math.floor(Math.random() * integrationPrompts.length)],
      }

      const updated = [newRecord, ...dreams]
      saveDreamsToStorage(updated)
      setSelectedDream(newRecord)
      setAnalyzing(false)
      toast.success("Dream analyzed and decoded! 🔮")
    }, 1200)
  }

  const deleteDream = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = dreams.filter((d) => d.id !== id)
    saveDreamsToStorage(updated)
    if (selectedDream?.id === id) setSelectedDream(null)
    toast.success("Dream removed from journal")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Moon className="w-6 h-6 text-indigo-400" />
          Dream Analyzer & Subconscious Studio
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Decode symbols, uncover Jungian archetypes, and bridge your dreamscapes with your waking wellness.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-2 space-y-5">
          <Card variant="glow">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-soul-purple" /> Record & Analyze Dream
            </h3>

            <div className="space-y-4">
              <Input
                label="Dream Title (Optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Glass Tower in the Storm"
              />

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Dream Narrative
                </label>
                <textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder="Describe your dream in as much detail as you recall: scenery, people, colors, physical sensations, bizarre events..."
                  rows={5}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-soul-purple/50 text-sm resize-none"
                />
              </div>

              {/* Waking Emotion */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Emotion Upon Waking
                </label>
                <div className="flex flex-wrap gap-2">
                  {WAKING_EMOTIONS.map((em) => (
                    <button
                      key={em.label}
                      type="button"
                      onClick={() => setWakingEmotion(em.label)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        wakingEmotion === em.label
                          ? "border-soul-purple bg-soul-purple/20 text-soul-purple font-bold shadow-sm"
                          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{em.emoji}</span>
                      {em.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lucidity Slider */}
              <div>
                <Slider
                  label="Lucidity / Awareness Level (1 = Faint Memory, 5 = Fully Lucid)"
                  value={lucidity}
                  onChange={setLucidity}
                  min={1}
                  max={5}
                  formatValue={(v) => `Level ${v}/5`}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  onClick={analyzeDream}
                  isLoading={analyzing}
                  icon={<Brain className="w-4 h-4" />}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Analyze Dream Psychology
                </Button>
              </div>
            </div>
          </Card>

          {/* Analysis Result Card */}
          {selectedDream && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card variant="interactive" className="p-6 border-indigo-500/30">
                <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{selectedDream.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Waking Emotion: <strong>{selectedDream.wakingEmotion}</strong> · Lucidity: {selectedDream.lucidity}/5
                    </p>
                  </div>
                  <Badge variant="purple" size="sm">
                    Psychological Report
                  </Badge>
                </div>

                {/* Archetypes */}
                <div className="mb-4">
                  <span className="text-xs font-bold text-soul-purple uppercase tracking-wider block mb-2">
                    🏛️ Subconscious Archetypes
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedDream.archetypes.map((a, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Symbols */}
                <div className="mb-4">
                  <span className="text-xs font-bold text-soul-teal uppercase tracking-wider block mb-2">
                    🔍 Decoded Symbolism
                  </span>
                  <div className="space-y-2">
                    {selectedDream.symbols.map((s, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-secondary/40 border border-border text-xs">
                        <strong className="text-foreground">{s.symbol}:</strong>{" "}
                        <span className="text-muted-foreground">{s.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Synthesis */}
                <div className="mb-4">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
                    🧠 Cognitive & Emotional Synthesis
                  </span>
                  <p className="text-sm text-foreground leading-relaxed bg-secondary/30 p-3.5 rounded-xl border border-border">
                    {selectedDream.interpretation}
                  </p>
                </div>

                {/* Integration Prompt */}
                <div className="p-3.5 rounded-xl bg-soul-purple/10 border border-soul-purple/30">
                  <span className="text-xs font-bold text-soul-purple flex items-center gap-1 mb-1">
                    <Compass className="w-3.5 h-3.5" /> Reflective Journaling Prompt
                  </span>
                  <p className="text-xs text-foreground italic">
                    &ldquo;{selectedDream.integrationPrompt}&rdquo;
                  </p>
                </div>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right Column: Dream Journal History */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" /> Dream Journal
              </h3>
              <Badge variant="default" size="sm">
                {dreams.length} Entries
              </Badge>
            </div>

            {dreams.length > 0 ? (
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {dreams.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDream(d)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedDream?.id === d.id
                        ? "border-soul-purple bg-soul-purple/10 shadow-sm"
                        : "border-border bg-secondary/30 hover:bg-secondary/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground truncate max-w-[170px]">
                        {d.title}
                      </h4>
                      <button
                        onClick={(e) => deleteDream(d.id, e)}
                        className="text-muted-foreground hover:text-red-400 p-1"
                        title="Delete dream"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {d.narrative}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
                      <span>{new Date(d.date).toLocaleDateString()}</span>
                      <span className="font-semibold text-soul-purple">{d.wakingEmotion}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">
                No dreams recorded yet. Log your first dream after waking up!
              </p>
            )}
          </Card>
        </div>
      </div>
    </motion.div>
  )
}

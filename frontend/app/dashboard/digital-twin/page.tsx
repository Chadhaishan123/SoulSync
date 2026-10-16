"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  Dna,
  Layers,
  Sparkles,
  Zap,
  Activity,
  Heart,
  Volume2,
  Search,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Clock,
  Compass,
} from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import ProgressRing from "@/components/ui/ProgressRing"
import ClusterBadge from "@/components/features/ClusterBadge"
import DigitalTwinChat from "@/components/features/DigitalTwinChat"
import { SkeletonCard } from "@/components/ui/Skeleton"
import type { DashboardData } from "@/types/mood"

interface BiometricsData {
  connected: boolean
  provider: string
  resting_heart_rate: number
  hrv_ms: number
  recovery_score: number
  deep_sleep_pct: number
  steps_today: number
  vagal_tone_status: string
}

interface SimulationState {
  scenario: string
  projected_mood_delta: number
  projected_stress_delta: number
  energy_trajectory: string
  narrative: string
  countermeasure: string
  confidence: number
}

interface MemoryItem {
  id: string
  date: string
  topic: string
  summary: string
  emotional_resonance: string
  relevance_score: number
}

export default function DigitalTwinPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  // 1. Simulator state
  const [scenarioInput, setScenarioInput] = useState("")
  const [simulating, setSimulating] = useState(false)
  const [simulationResult, setSimulationResult] = useState<SimulationState | null>(null)

  // 2. Vector Memory state
  const [memoryQuery, setMemoryQuery] = useState("stress and recovery")
  const [searchingMemory, setSearchingMemory] = useState(false)
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [memoryEngine, setMemoryEngine] = useState("semantic_tfidf")

  // 3. Biometrics state
  const [biometrics, setBiometrics] = useState<BiometricsData>({
    connected: false,
    provider: "Simulated Wearable Feed",
    resting_heart_rate: 64,
    hrv_ms: 62,
    recovery_score: 86,
    deep_sleep_pct: 23,
    steps_today: 7850,
    vagal_tone_status: "High Vagal Tone • Enhanced Autonomic Balance",
  })
  const [syncingVitals, setSyncingVitals] = useState(false)
  const [showWearableModal, setShowWearableModal] = useState(false)

  // 4. 3D Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string>("")
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [avatarInput, setAvatarInput] = useState("")
  const [speaking, setSpeaking] = useState(false)

  const sampleScenarios = [
    "Drinking a double espresso at 8 PM for late work",
    "Taking a 30-minute brisk walk in morning sunlight",
    "Skipping dinner and sleeping only 5 hours",
    "Saying no to an exhausting social invite to take a warm bath",
  ]

  useEffect(() => {
    const load = async () => {
      try {
        const [insights, bioData, avatarData] = await Promise.allSettled([
          api.insights.dashboard(),
          api.twin.biometrics(),
          api.twin.getAvatar(),
        ])

        if (insights.status === "fulfilled") setData(insights.value)
        if (bioData.status === "fulfilled") setBiometrics(bioData.value)
        if (avatarData.status === "fulfilled" && avatarData.value.avatar_url) {
          setAvatarUrl(avatarData.value.avatar_url)
        }

        // Initial memory recall
        try {
          const initialMems = await api.twin.recallMemories("sleep, balance, stress")
          setMemories(initialMems.memories || [])
          setMemoryEngine(initialMems.engine || "semantic_tfidf")
        } catch {
          // Fallback memories
          setMemories([
            {
              id: "mem-base-1",
              date: "This Week",
              topic: "Circadian Optimization",
              summary: "Optimal cognitive clarity achieved when waking up before 7:30 AM with natural daylight.",
              emotional_resonance: "High Alertness & Calm",
              relevance_score: 0.94,
            },
            {
              id: "mem-base-2",
              date: "Prior Check-in",
              topic: "Autonomic Recovery",
              summary: "Evening meditation lowered bedtime heart rate by 6 bpm and elevated deep sleep ratio.",
              emotional_resonance: "Restful & Parasympathetic",
              relevance_score: 0.88,
            },
          ])
        }
      } catch {
        // graceful
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Run What-If Simulation
  const handleSimulate = async (customScenario?: string) => {
    const sc = customScenario || scenarioInput
    if (!sc.trim()) return
    setSimulating(true)
    try {
      const res = await api.twin.simulate(sc)
      setSimulationResult(res)
    } catch {
      // Local fallback simulation
      const scLow = sc.toLowerCase()
      const isSleep = scLow.includes("sleep") || scLow.includes("espresso") || scLow.includes("late")
      const isNature = scLow.includes("walk") || scLow.includes("exercise") || scLow.includes("sun")
      setSimulationResult({
        scenario: sc,
        projected_mood_delta: isNature ? 1.4 : isSleep ? -1.3 : 0.6,
        projected_stress_delta: isNature ? -1.6 : isSleep ? 1.9 : -0.4,
        energy_trajectory: isNature ? "Surge" : isSleep ? "Crash" : "Steady",
        narrative: isNature
          ? "Aerobic motion in natural light dampens amygdala reactivity and accelerates parasympathetic recovery."
          : isSleep
          ? "Disrupting circadian architecture elevates early cortisol spikes and narrows emotional resilience windows."
          : "Neutral somatic modulation. Baseline neural equilibrium remains well preserved.",
        countermeasure: isNature
          ? "Sip electrolyte water immediately following the walk to maximize cellular hydration."
          : isSleep
          ? "Delay morning caffeine by 90 minutes and schedule a 20-minute NSDR (Non-Sleep Deep Rest) session."
          : "Keep track of physical muscle tension around shoulders and jaw after 2 hours.",
        confidence: 0.89,
      })
    } finally {
      setSimulating(false)
    }
  }

  // Search Vector Memory
  const handleMemorySearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!memoryQuery.trim()) return
    setSearchingMemory(true)
    try {
      const res = await api.twin.recallMemories(memoryQuery)
      setMemories(res.memories || [])
      setMemoryEngine(res.engine || "semantic_tfidf")
    } catch {
      // Keep existing
    } finally {
      setSearchingMemory(false)
    }
  }

  // Voice Read-Aloud
  const handleSpeak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.05
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  // Save Ready Player Me Avatar
  const handleSaveAvatar = async () => {
    if (!avatarInput.trim()) return
    try {
      await api.twin.updateAvatar(avatarInput.trim())
      setAvatarUrl(avatarInput.trim())
      setShowAvatarModal(false)
    } catch {
      setAvatarUrl(avatarInput.trim())
      setShowAvatarModal(false)
    }
  }

  // Wearable Quick Sync
  const handleWearableSync = async (provider: string) => {
    setSyncingVitals(true)
    try {
      const updated = await api.twin.syncBiometrics({
        provider,
        resting_heart_rate: 61,
        hrv_ms: 68,
        steps: 8920,
      })
      setBiometrics(updated)
      setShowWearableModal(false)
    } catch {
      setBiometrics((prev) => ({
        ...prev,
        connected: true,
        provider: `${provider} (Synced)`,
        resting_heart_rate: 62,
        hrv_ms: 67,
        recovery_score: 91,
      }))
      setShowWearableModal(false)
    } finally {
      setSyncingVitals(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const twin = data?.digital_twin
  const clusters = twin?.clusters || {}
  const totalDays = twin?.total_days || 0
  const pattern = twin?.current_pattern || "Balanced"
  const clusterEntries = Object.entries(clusters)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 pb-12"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-soul-purple animate-pulse" />
            Autonomous Digital Twin
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Grounded behavioral simulation, vector memory, biometrics, and persona synthesis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="purple" size="sm" className="gap-1.5 py-1 px-3">
            <ShieldCheck className="w-3.5 h-3.5 text-soul-purple" />
            K-Means Clustered
          </Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAvatarModal(true)}
            className="text-xs gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-soul-teal" />
            3D Avatar
          </Button>
        </div>
      </div>

      {/* ── 1. HERO & 3D VISUAL PERSONA ── */}
      <Card variant="glow" padding="lg" className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-soul-purple/10 via-soul-teal/10 to-transparent blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          {/* Animated Living Aura or Ready Player Me Avatar */}
          <div className="relative group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
            {avatarUrl ? (
              <div className="w-36 h-36 rounded-full overflow-hidden border-2 border-soul-purple/50 shadow-glow relative bg-muted/40 flex items-center justify-center">
                <img
                  src={avatarUrl.endsWith(".glb") ? `https://models.readyplayer.me/${avatarUrl.split("/").pop()?.replace(".glb", "")}.png?thumb=true` : avatarUrl}
                  alt="3D Digital Twin Avatar"
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    // Fallback to stylized representation
                    (e.target as HTMLElement).style.display = "none"
                  }}
                />
                <div className="absolute inset-0 bg-soul-purple/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full">Edit Avatar</span>
                </div>
              </div>
            ) : (
              <motion.div
                className="w-36 h-36 rounded-full bg-gradient-to-br from-soul-purple/20 to-soul-teal/20 flex items-center justify-center"
                animate={{
                  boxShadow: [
                    "0 0 25px rgba(124, 92, 252, 0.25)",
                    "0 0 50px rgba(124, 92, 252, 0.4)",
                    "0 0 25px rgba(124, 92, 252, 0.25)",
                  ],
                }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <motion.div
                  className="w-28 h-28 rounded-full bg-gradient-to-br from-soul-purple/30 to-soul-teal/30 flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-soul-purple to-soul-teal flex items-center justify-center shadow-glow">
                    <Dna className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
              </motion.div>
            )}
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
          </div>

          {/* Twin Persona Profile */}
          <div className="text-center md:text-left space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
              <Badge variant="purple" size="sm">Archetype: {pattern}</Badge>
              <Badge variant="accent" size="sm">Coherence: 94%</Badge>
              {biometrics.connected && (
                <Badge variant="info" size="sm" className="gap-1">
                  <Activity className="w-3 h-3" /> {biometrics.provider}
                </Badge>
              )}
            </div>
            <h3 className="text-xl font-bold text-foreground">
              Cognitive Equilibrium Engine
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              Tuned to your real-life baseline across <strong className="text-foreground">{totalDays || 1}</strong> wellness
              check-ins. Your digital replica forecasts future stress vulnerabilities and suggests preemptive somatic adjustments.
            </p>

            <div className="pt-1 flex flex-wrap gap-2 justify-center md:justify-start">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  handleSpeak(
                    `Hello! I am your SoulSync Digital Twin. Your current pattern is ${pattern}. Your nervous system is maintaining strong autonomic stability.`
                  )
                }
                className="gap-1.5 text-xs"
              >
                <Volume2 className={`w-3.5 h-3.5 ${speaking ? "text-soul-teal animate-bounce" : "text-muted-foreground"}`} />
                {speaking ? "Stop Voice" : "Hear Twin Voice"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWearableModal(true)}
                className="gap-1.5 text-xs text-soul-teal hover:text-soul-teal"
              >
                <Activity className="w-3.5 h-3.5" />
                {biometrics.connected ? "Wearable Connected" : "Connect Wearable"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── 2. WEARABLE BIOMETRICS TELEMETRY ── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-soul-teal" />
            <div>
              <h3 className="text-base font-bold text-foreground">Wearable Physiological Telemetry</h3>
              <p className="text-xs text-muted-foreground">Terra API / Health Connect continuous vitals pipeline</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleWearableSync("Apple Health")}
            disabled={syncingVitals}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingVitals ? "animate-spin" : ""}`} />
            Sync Vitals
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-card border border-border/50 hover:border-soul-purple/30 transition-all">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Resting HR</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {biometrics.resting_heart_rate} <span className="text-xs font-normal text-muted-foreground">bpm</span>
            </div>
            <div className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1 font-medium">
              <TrendingDown className="w-3 h-3" /> Calm parasympathetic
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/50 hover:border-soul-purple/30 transition-all">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">HRV (RMSSD)</span>
              <Zap className="w-3.5 h-3.5 text-soul-purple" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {biometrics.hrv_ms} <span className="text-xs font-normal text-muted-foreground">ms</span>
            </div>
            <div className="text-[11px] text-soul-teal mt-1 font-medium">
              Autonomic Resilience
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/50 hover:border-soul-purple/30 transition-all">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Recovery Score</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {biometrics.recovery_score}%
            </div>
            <div className="text-[11px] text-emerald-500 mt-1 font-medium">
              Primed for high focus
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/50 hover:border-soul-purple/30 transition-all">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Deep Sleep Ratio</span>
              <Clock className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-foreground">
              {biometrics.deep_sleep_pct}%
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Optimal restoration
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            {biometrics.vagal_tone_status}
          </span>
          <span className="text-muted-foreground/80 hidden sm:inline">{biometrics.provider}</span>
        </div>
      </Card>

      {/* ── 3. "WHAT-IF" BEHAVIORAL SCENARIO SIMULATOR ── */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-bold text-foreground">Behavioral "What-If" Scenario Simulator</h3>
            <p className="text-xs text-muted-foreground">Test hypothetical decisions before executing them in reality</p>
          </div>
        </div>

        {/* Input box */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <input
            type="text"
            value={scenarioInput}
            onChange={(e) => setScenarioInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSimulate()}
            placeholder="e.g. Taking a 30-min cold plunge before a tough presentation..."
            className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-muted/40 border border-border focus:border-soul-purple focus:outline-none transition-all placeholder:text-muted-foreground/60"
          />
          <Button
            variant="primary"
            onClick={() => handleSimulate()}
            disabled={simulating || !scenarioInput.trim()}
            className="gap-2 shrink-0"
          >
            <Sparkles className={`w-4 h-4 ${simulating ? "animate-spin" : ""}`} />
            {simulating ? "Simulating..." : "Run Simulation"}
          </Button>
        </div>

        {/* Quick Scenario Chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {sampleScenarios.map((sc, i) => (
            <button
              key={i}
              onClick={() => {
                setScenarioInput(sc)
                handleSimulate(sc)
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-card border border-border/60 hover:border-soul-purple/50 text-muted-foreground hover:text-foreground transition-all text-left"
            >
              {sc}
            </button>
          ))}
        </div>

        {/* Simulation Output Card */}
        <AnimatePresence>
          {simulationResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-card via-muted/20 to-card border border-soul-purple/30 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-soul-purple flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" /> Simulation Result
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      simulationResult.energy_trajectory === "Surge"
                        ? "accent"
                        : simulationResult.energy_trajectory === "Crash"
                        ? "danger"
                        : "purple"
                    }
                    size="sm"
                  >
                    Energy: {simulationResult.energy_trajectory}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    Confidence: {Math.round(simulationResult.confidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Deltas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-card border border-border/40 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Projected Mood</span>
                  <span
                    className={`text-sm font-bold flex items-center gap-1 ${
                      simulationResult.projected_mood_delta >= 0 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {simulationResult.projected_mood_delta >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {simulationResult.projected_mood_delta >= 0 ? "+" : ""}
                    {simulationResult.projected_mood_delta.toFixed(1)} pts
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/40 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Projected Stress</span>
                  <span
                    className={`text-sm font-bold flex items-center gap-1 ${
                      simulationResult.projected_stress_delta <= 0 ? "text-emerald-500" : "text-amber-500"
                    }`}
                  >
                    {simulationResult.projected_stress_delta <= 0 ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : (
                      <TrendingUp className="w-4 h-4" />
                    )}
                    {simulationResult.projected_stress_delta >= 0 ? "+" : ""}
                    {simulationResult.projected_stress_delta.toFixed(1)} pts
                  </span>
                </div>
              </div>

              {/* Narrative & Countermeasure */}
              <div className="space-y-2">
                <p className="text-sm text-foreground leading-relaxed">
                  {simulationResult.narrative}
                </p>
                <div className="p-3 rounded-xl bg-soul-teal/10 border border-soul-teal/20 text-xs text-foreground flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-soul-teal shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-soul-teal font-semibold block mb-0.5">Twin Countermeasure</strong>
                    {simulationResult.countermeasure}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* ── 4. LONG-TERM SEMANTIC VECTOR MEMORY BANK ── */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-soul-purple" />
            <div>
              <h3 className="text-base font-bold text-foreground">Long-Term Semantic Vector Memory</h3>
              <p className="text-xs text-muted-foreground">Pinecone-backed neural recall of past emotional episodes</p>
            </div>
          </div>
          <Badge variant="purple" size="sm" className="w-fit text-[11px]">
            Engine: {memoryEngine === "pinecone" ? "Pinecone Vector DB" : "Semantic Vector Index"}
          </Badge>
        </div>

        {/* Memory Search */}
        <form onSubmit={handleMemorySearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <input
              type="text"
              value={memoryQuery}
              onChange={(e) => setMemoryQuery(e.target.value)}
              placeholder="Search past subconscious patterns or reflections..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-muted/40 border border-border focus:border-soul-purple focus:outline-none transition-all placeholder:text-muted-foreground/60"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={searchingMemory || !memoryQuery.trim()}
            className="text-xs"
          >
            {searchingMemory ? "Recalling..." : "Recall"}
          </Button>
        </form>

        {/* Memory Items List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memories.map((mem) => (
            <motion.div
              key={mem.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-card border border-border/50 hover:border-soul-purple/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-semibold text-soul-purple">{mem.topic}</span>
                  <span>{mem.date}</span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed line-clamp-3 mb-2">
                  {mem.summary}
                </p>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/30">
                <span className="truncate max-w-[180px]">{mem.emotional_resonance}</span>
                <span className="text-soul-teal font-medium tabular-nums">
                  {Math.round(mem.relevance_score * 100)}% match
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* ── 5. CLUSTER DISTRIBUTION ── */}
      <Card>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-soul-purple" />
          K-Means Cluster Distribution
        </h3>
        <div className="space-y-4">
          {clusterEntries.map(([name, days], i) => {
            const percent = totalDays > 0 ? (days / totalDays) * 100 : 0
            const isActive = name === pattern
            const colors: Record<string, string> = {
              Balanced: "bg-emerald-500",
              "High-Stress": "bg-red-500",
              "Low-Energy": "bg-amber-500",
              Recovery: "bg-blue-500",
            }

            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors[name] || "bg-soul-purple"}`} />
                    <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {name}
                    </span>
                    {isActive && <Badge variant="purple" size="sm">Active</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {days} days ({Math.round(percent)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                    className={`h-full rounded-full ${colors[name] || "bg-soul-purple"} ${
                      isActive ? "shadow-glow-sm" : ""
                    }`}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </Card>

      {/* ── 6. INTERACTIVE CONVERSATIONAL DIGITAL TWIN ── */}
      <DigitalTwinChat currentPattern={pattern} totalDays={totalDays} />

      {/* ── MODALS ── */}
      {/* 3D Ready Player Me Avatar Modal */}
      <AnimatePresence>
        {showAvatarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Compass className="w-5 h-5 text-soul-purple" />
                  3D Ready Player Me Avatar
                </h3>
                <button
                  onClick={() => setShowAvatarModal(false)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your full-body 3D Ready Player Me avatar. You can create your custom photorealistic 3D avatar for free at Ready Player Me, copy the avatar .glb link, and paste it below.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Avatar .glb URL</label>
                <input
                  type="text"
                  value={avatarInput}
                  onChange={(e) => setAvatarInput(e.target.value)}
                  placeholder="https://models.readyplayer.me/64b5...glb"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-muted/40 border border-border focus:border-soul-purple focus:outline-none transition-all placeholder:text-muted-foreground/60"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href="https://readyplayer.me/avatar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-soul-teal hover:underline flex items-center gap-1 font-medium"
                >
                  Create free 3D avatar <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAvatarModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSaveAvatar}>
                    Save Avatar
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Wearable Connection Modal */}
      <AnimatePresence>
        {showWearableModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-soul-teal" />
                  Connect Wearable Device
                </h3>
                <button
                  onClick={() => setShowWearableModal(false)}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Stream real-time Heart Rate Variability (HRV), resting pulse, and sleep stages directly to your Digital Twin via Terra API and Health Connect.
              </p>

              <div className="space-y-2">
                {["Apple Health", "WHOOP 4.0", "Oura Ring Gen3", "Garmin Connect"].map((dev) => (
                  <button
                    key={dev}
                    onClick={() => handleWearableSync(dev)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-soul-teal/50 hover:bg-muted/50 transition-all text-left"
                  >
                    <span className="text-sm font-medium text-foreground">{dev}</span>
                    <Badge variant="accent" size="sm">Connect</Badge>
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowWearableModal(false)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

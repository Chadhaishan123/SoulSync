"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sun, Cloud, CloudRain, CloudLightning, Sparkles, Moon, Activity, Wind } from "lucide-react"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { api } from "@/lib/api"
import type { DashboardWeather, SimulationResult } from "@/types/mood"

interface MindWeatherSimulatorProps {
  initialWeather?: DashboardWeather
  className?: string
}

export default function MindWeatherSimulator({
  initialWeather,
  className = "",
}: MindWeatherSimulatorProps) {
  // Simulator inputs
  const [sleepHours, setSleepHours] = useState<number>(7.5)
  const [exerciseMinutes, setExerciseMinutes] = useState<number>(30)
  const [meditationMinutes, setMeditationMinutes] = useState<number>(15)
  const [outdoorMinutes, setOutdoorMinutes] = useState<number>(20)

  const [simulation, setSimulation] = useState<SimulationResult | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Run initial simulation
  const runSimulation = async (
    sleep = sleepHours,
    exercise = exerciseMinutes,
    meditation = meditationMinutes,
    outdoor = outdoorMinutes
  ) => {
    setLoading(true)
    try {
      const res = await api.insights.simulate({
        sleep_hours: sleep,
        exercise_minutes: exercise,
        meditation_minutes: meditation,
        outdoor_minutes: outdoor,
      })
      setSimulation(res)
    } catch {
      // Fallback client-side calculation if offline
      const delta = Math.round(((sleep - 7.0) * 0.4 + exercise * 0.02 + meditation * 0.025 + outdoor * 0.015) * 10) / 10
      const baseline = initialWeather?.latest_metrics?.mood || 6.5
      const simMood = Math.min(Math.max(baseline + delta, 1), 10)
      const state = simMood >= 8.5 ? "☀️ Radiant Sunshine" : simMood >= 7 ? "🌤️ Partly Sunny" : simMood >= 5 ? "⛅ Mixed Skies" : "🌧️ Light Rain"
      setSimulation({
        baseline_mood: baseline,
        simulated_mood: simMood,
        mood_delta: delta,
        predicted_weather: state,
        forecast_narrative: "Proactive habits stabilize emotional equilibrium.",
        anxiety_reduction_pct: Math.min(Math.round(meditation * 0.9 + exercise * 0.4), 45),
        recommendations: ["Consistent sleep timing regulates cortisol rhythms."],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runSimulation()
  }, [])

  // Auto-run with debounce on slider changes
  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation()
    }, 250)
    return () => clearTimeout(timer)
  }, [sleepHours, exerciseMinutes, meditationMinutes, outdoorMinutes])

  const weatherDisplay = simulation?.predicted_weather || initialWeather?.state || "⛅ Mixed Skies"
  const isPositiveDelta = (simulation?.mood_delta || 0) >= 0

  return (
    <Card variant="glass" padding="lg" className={`relative overflow-hidden ${className}`}>
      {/* Background Weather Ambience Aura */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-soul-teal/10 blur-3xl pointer-events-none" />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-soul-teal animate-spin-slow" />
              <h3 className="text-lg font-bold text-foreground">Mind Weather & What-If Simulator</h3>
              <Badge variant="accent" size="sm">Novelty ML</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Simulate how tonight's sleep and habits will shape tomorrow's emotional forecast.
            </p>
          </div>

          {/* Current / Projected Weather Badge */}
          <div className="flex items-center gap-3 bg-secondary/50 px-3 py-2 rounded-xl border border-border/40">
            <span className="text-2xl">
              {weatherDisplay.includes("☀️") ? "☀️" :
               weatherDisplay.includes("🌤️") ? "🌤️" :
               weatherDisplay.includes("🌧️") ? "🌧️" :
               weatherDisplay.includes("🌩️") ? "🌩️" : "⛅"}
            </span>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Projected Weather
              </p>
              <p className="text-sm font-semibold text-foreground">
                {weatherDisplay.replace(/^[^\s]+\s/, "")}
              </p>
            </div>
          </div>
        </div>

        {/* Narrative Banner */}
        <div className="p-3.5 rounded-xl bg-soul-purple/10 border border-soul-purple/20 flex items-start gap-3">
          <Wind className="w-5 h-5 text-soul-purple mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-soul-purple uppercase tracking-wider">
              Emotional Barometer
            </p>
            <p className="text-sm text-foreground/90">
              {simulation?.forecast_narrative || "Adjust the habit sliders below to see real-time forecast adjustments."}
            </p>
          </div>
        </div>

        {/* Interactive Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          {/* Slider 1: Sleep */}
          <div className="space-y-2 p-3 rounded-xl bg-secondary/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-soul-purple" />
                Target Sleep
              </span>
              <span className="font-bold text-soul-purple">{sleepHours} hrs</span>
            </div>
            <input
              type="range"
              min="4.5"
              max="10"
              step="0.5"
              value={sleepHours}
              onChange={(e) => setSleepHours(parseFloat(e.target.value))}
              className="w-full accent-soul-purple cursor-pointer h-1.5 rounded-lg bg-secondary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5 hrs</span>
              <span>Optimal: 8 hrs</span>
              <span>10 hrs</span>
            </div>
          </div>

          {/* Slider 2: Exercise */}
          <div className="space-y-2 p-3 rounded-xl bg-secondary/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-soul-teal" />
                Physical Activity
              </span>
              <span className="font-bold text-soul-teal">{exerciseMinutes} mins</span>
            </div>
            <input
              type="range"
              min="0"
              max="75"
              step="5"
              value={exerciseMinutes}
              onChange={(e) => setExerciseMinutes(parseInt(e.target.value))}
              className="w-full accent-soul-teal cursor-pointer h-1.5 rounded-lg bg-secondary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Rest day</span>
              <span>30 mins</span>
              <span>75 mins</span>
            </div>
          </div>

          {/* Slider 3: Meditation */}
          <div className="space-y-2 p-3 rounded-xl bg-secondary/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Mindfulness / Meditation
              </span>
              <span className="font-bold text-amber-400">{meditationMinutes} mins</span>
            </div>
            <input
              type="range"
              min="0"
              max="45"
              step="5"
              value={meditationMinutes}
              onChange={(e) => setMeditationMinutes(parseInt(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 rounded-lg bg-secondary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 mins</span>
              <span>15 mins</span>
              <span>45 mins</span>
            </div>
          </div>

          {/* Slider 4: Outdoors */}
          <div className="space-y-2 p-3 rounded-xl bg-secondary/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                Fresh Air & Daylight
              </span>
              <span className="font-bold text-blue-400">{outdoorMinutes} mins</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="5"
              value={outdoorMinutes}
              onChange={(e) => setOutdoorMinutes(parseInt(e.target.value))}
              className="w-full accent-blue-400 cursor-pointer h-1.5 rounded-lg bg-secondary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Indoors</span>
              <span>20 mins</span>
              <span>60 mins</span>
            </div>
          </div>
        </div>

        {/* Live Simulation Impact Stats */}
        {simulation && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-card border border-border/60 text-center"
          >
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Projected Mood</p>
              <p className="text-xl font-extrabold text-foreground mt-0.5">
                {simulation.simulated_mood.toFixed(1)}
                <span className="text-xs font-normal text-muted-foreground">/10</span>
              </p>
              <span className={`text-[11px] font-semibold ${isPositiveDelta ? "text-emerald-400" : "text-rose-400"}`}>
                {isPositiveDelta ? `+${simulation.mood_delta}` : simulation.mood_delta} vs baseline
              </span>
            </div>

            <div className="border-x border-border/50">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Anxiety Reduction</p>
              <p className="text-xl font-extrabold text-soul-teal mt-0.5">
                -{simulation.anxiety_reduction_pct}%
              </p>
              <span className="text-[11px] text-muted-foreground">via nervous system calming</span>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Cortisol Impact</p>
              <p className="text-xl font-extrabold text-soul-purple mt-0.5">
                {sleepHours >= 7.5 ? "Stabilized" : "Elevated"}
              </p>
              <span className="text-[11px] text-muted-foreground">circadian rhythm lock</span>
            </div>
          </motion.div>
        )}

        {/* Actionable Micro-Recommendations */}
        {simulation?.recommendations && simulation.recommendations.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {simulation.recommendations.map((rec, idx) => (
              <span
                key={idx}
                className="text-[11px] px-2.5 py-1 rounded-full bg-secondary/60 text-foreground/80 border border-border/40"
              >
                💡 {rec}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

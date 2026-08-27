"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "../../../components/DashboardLayout"
import { motion } from "framer-motion"

const emotionOptions = [
  { label: "Happy", emoji: "😊" },
  { label: "Sad", emoji: "😔" },
  { label: "Anxious", emoji: "😰" },
  { label: "Angry", emoji: "😡" },
  { label: "Calm", emoji: "😌" },
  { label: "Neutral", emoji: "😐" }
]

const tagOptions = [
  "Work",
  "Study",
  "Family",
  "Friends",
  "Health",
  "Exercise",
  "Travel",
  "Deadlines"
]

export default function CheckInPage() {
  const router = useRouter()
  const [mood, setMood] = useState(6)
  const [stress, setStress] = useState(5)
  const [energy, setEnergy] = useState(6)
  const [sleepQuality, setSleepQuality] = useState(6)
  const [primaryEmotion, setPrimaryEmotion] = useState("Neutral")
  const [tags, setTags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag))
    } else {
      setTags([...tags, tag])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")

    const token = localStorage.getItem("token")
    try {
      const res = await fetch("http://localhost:8000/api/moods", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          mood_score: mood,
          stress_level: stress,
          energy_level: energy,
          sleep_quality: sleepQuality,
          primary_emotion: primaryEmotion,
          tags
        })
      })

      if (res.status === 200) {
        router.push("/dashboard")
      } else {
        const data = await res.json()
        setError(data.detail || "Submission failed. Please check inputs.")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to connect to backend service.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6"
      >
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900">How are you feeling today?</h2>
          <p className="text-sm text-gray-500 mt-0.5">Log your wellness scores to update your digital twin.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Sliders Grid */}
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Mood Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold">
                <label className="text-gray-700">Mood Score</label>
                <span className="text-blue-600 font-bold">{mood}/10</span>
              </div>
              <input
                type="range" min="1" max="10" value={mood}
                onChange={(e) => setMood(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Difficult</span>
                <span>Balanced</span>
                <span>Excellent</span>
              </div>
            </div>

            {/* Stress Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold">
                <label className="text-gray-700">Stress Level</label>
                <span className="text-blue-600 font-bold">{stress}/10</span>
              </div>
              <input
                type="range" min="1" max="10" value={stress}
                onChange={(e) => setStress(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Relaxed</span>
                <span>Moderate</span>
                <span>Overwhelmed</span>
              </div>
            </div>

            {/* Energy Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold">
                <label className="text-gray-700">Energy Level</label>
                <span className="text-blue-600 font-bold">{energy}/10</span>
              </div>
              <input
                type="range" min="1" max="10" value={energy}
                onChange={(e) => setEnergy(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Exhausted</span>
                <span>Active</span>
                <span>Hyperactive</span>
              </div>
            </div>

            {/* Sleep Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-semibold">
                <label className="text-gray-700">Sleep Quality</label>
                <span className="text-blue-600 font-bold">{sleepQuality}/10</span>
              </div>
              <input
                type="range" min="1" max="10" value={sleepQuality}
                onChange={(e) => setSleepQuality(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Poor</span>
                <span>Restful</span>
                <span>Perfect</span>
              </div>
            </div>
          </div>

          {/* Primary Emotion Selector */}
          <div className="space-y-2 border-t border-gray-100 pt-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Emotion</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {emotionOptions.map((opt) => {
                const isSelected = primaryEmotion === opt.label
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setPrimaryEmotion(opt.label)}
                    className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all ${
                      isSelected 
                        ? "border-blue-500 bg-blue-50/50 text-blue-700 font-bold shadow-sm" 
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-xs mt-1">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Contextual Tags */}
          <div className="space-y-2 border-t border-gray-100 pt-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Context Tags</label>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map(tag => {
                const isSelected = tags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs font-semibold px-4 py-2 border rounded-full transition-colors ${
                      isSelected 
                        ? "bg-blue-600 border-blue-600 text-white" 
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-3 rounded-lg shadow-md transition-colors"
            >
              {submitting ? "Logging..." : "Submit Log Check-In"}
            </button>
          </div>

        </form>

      </motion.div>
    </DashboardLayout>
  )
}

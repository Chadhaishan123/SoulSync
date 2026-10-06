"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Shield, Compass, Sparkles } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import toast from "react-hot-toast"

const goalOptions = [
  "Reduce stress",
  "Improve sleep",
  "Build consistency",
  "Journal regularly",
  "Increase physical activity",
  "Understand mood patterns"
]

export default function OnboardingPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [goals, setGoals] = useState<string[]>([])
  const [timezone, setTimezone] = useState("UTC")
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)
  const [envConsent, setEnvConsent] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/login")
    }
    
    // Auto-detect timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) setTimezone(tz)
    } catch {
      console.warn("Could not auto-detect timezone, defaulting to UTC.")
    }
  }, [router])

  const toggleGoal = (goal: string) => {
    if (goals.includes(goal)) {
      setGoals(goals.filter(g => g !== goal))
    } else {
      setGoals([...goals, goal])
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await api.user.onboarding({
        timezone,
        wellness_goals: goals.join(", ") || "General wellness",
        reminder_hour: 9,
        sleep_goal_minutes: 480,
        location_enabled: locationEnabled,
        environment_enabled: envConsent,
        nlp_analysis_enabled: true,
        notifications_enabled: true,
      })
      await refreshUser().catch(() => {})
      toast.success("Welcome to SoulSync! 🧠")
      router.push("/dashboard")
    } catch (err) {
      console.error("Onboarding submission failed:", err)
      toast.success("Welcome to SoulSync! 🧠")
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-8">
        
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold text-gray-900">Personalize Your SoulSync</h2>
          <p className="text-gray-500">Configure your goals and consent preferences to align your digital twin.</p>
        </div>

        {/* Goals Checklist */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            What are your wellness goals?
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {goalOptions.map(goal => {
              const selected = goals.includes(goal)
              return (
                <button
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  className={`flex items-center justify-between p-4 rounded-xl border text-left font-medium transition-all ${
                    selected 
                      ? "border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm" 
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {goal}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                    selected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 bg-white"
                  }`}>
                    {selected && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Permissions & Disclosures */}
        <div className="space-y-4 border-t border-gray-100 pt-6">
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Privacy & Environmental Integrations
          </h3>
          
          <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
            {/* Location Permission Toggle */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">Enable Location Integration</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allows the platform to fetch local temperature, weather, and air quality index parameters during check-in.
                </p>
              </div>
              <input
                type="checkbox"
                checked={locationEnabled}
                onChange={(e) => setLocationEnabled(e.target.checked)}
                className="w-5 h-5 accent-blue-600 cursor-pointer mt-1"
              />
            </div>
            
            {/* Weather / AQI Snapshots Consent */}
            <div className="flex items-start justify-between gap-4 border-t border-gray-200/60 pt-4">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">Save Environmental Context Snapshots</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Give consent to store weather variables side-by-side with mood logs. This data is used solely for identifying personal correlations (e.g. weather impacts on energy).
                </p>
              </div>
              <input
                type="checkbox"
                checked={envConsent}
                onChange={(e) => setEnvConsent(e.target.checked)}
                className="w-5 h-5 accent-blue-600 cursor-pointer mt-1"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            disabled={loading || goals.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-3 rounded-lg shadow-md transition-colors"
          >
            {loading ? "Saving Profile..." : "Confirm & Enter Dashboard"}
          </button>
        </div>
      </div>
    </div>
  )
}

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
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              What are your wellness goals?
            </h3>
            <span className="text-xs text-gray-400 font-medium">Select multiple</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {goalOptions.map((goal, idx) => {
              const selected = goals.includes(goal)
              const icons = ["🧘", "😴", "🎯", "✍️", "🏃", "📊"]
              return (
                <button
                  key={goal}
                  type="button"
                  onClick={() => toggleGoal(goal)}
                  className={`aspect-square flex flex-col items-center justify-center p-4 rounded-2xl border text-center font-medium transition-all relative ${
                    selected 
                      ? "border-blue-600 bg-blue-50 text-blue-800 shadow-md ring-2 ring-blue-500/20" 
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                    selected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 bg-white"
                  }`}>
                    {selected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="text-3xl mb-2">{icons[idx % icons.length]}</span>
                  <span className="text-xs sm:text-sm font-semibold leading-tight">{goal}</span>
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
          
          <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
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
                onChange={(e) => {
                  const checked = e.target.checked
                  setLocationEnabled(checked)
                  if (checked && typeof navigator !== "undefined" && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      () => {},
                      () => {},
                      { timeout: 8000 }
                    )
                  }
                }}
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
        <div className="pt-4 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || goals.length === 0 || !locationEnabled || !envConsent}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-semibold px-8 py-3.5 rounded-xl shadow-md transition-all text-sm"
          >
            {loading ? "Saving Profile..." : "Confirm & Enter Dashboard"}
          </button>
          {(!locationEnabled || !envConsent || goals.length === 0) && (
            <p className="text-xs text-amber-600 font-medium">
              * Please select at least one goal and check both statements above to activate the button.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

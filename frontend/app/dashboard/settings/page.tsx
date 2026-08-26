"use client"

import React, { useEffect, useState } from "react"
import DashboardLayout from "@/components/DashboardLayout"
import { Check, Shield, Compass, Sparkles } from "lucide-react"

const goalOptions = [
  "Reduce stress",
  "Improve sleep",
  "Build consistency",
  "Journal regularly",
  "Increase physical activity",
  "Understand mood patterns"
]

export default function SettingsPage() {
  const [goals, setGoals] = useState<string[]>([])
  const [timezone, setTimezone] = useState("UTC")
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)
  const [envConsent, setEnvConsent] = useState(true)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    
    const fetchSettings = async () => {
      try {
        // Fetch profile
        const profileRes = await fetch("http://localhost:8000/api/auth/me/profile", {
          headers: { "Authorization": `Bearer ${token}` }
        })
        if (profileRes.status === 200) {
          const profile = await profileRes.json()
          setTimezone(profile.timezone)
          setGoals(profile.wellness_goals)
          setPersonalizationEnabled(profile.personalization_enabled)
          setLocationEnabled(profile.location_enabled)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSettings()
  }, [])

  const toggleGoal = (goal: string) => {
    if (goals.includes(goal)) {
      setGoals(goals.filter(g => g !== goal))
    } else {
      setGoals([...goals, goal])
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    const token = localStorage.getItem("token")

    try {
      // 1. Update Profile
      const profileRes = await fetch("http://localhost:8000/api/auth/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          timezone,
          wellness_goals: goals,
          personalization_enabled: personalizationEnabled,
          location_enabled: locationEnabled
        })
      })

      // 2. Update Consent
      await fetch("http://localhost:8000/api/auth/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          consent_type: "environment",
          is_granted: envConsent
        })
      })

      if (profileRes.status === 200) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-gray-500 text-center font-medium py-10">Loading user preferences...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl bg-white p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your goals, location permissions, and privacy consent records.</p>
        </div>

        {success && (
          <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-100">
            Preferences updated successfully!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Goals Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Your Wellness Goals
            </h3>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {goalOptions.map(goal => {
                const selected = goals.includes(goal)
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggleGoal(goal)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                      selected 
                        ? "border-blue-500 bg-blue-50/50 text-blue-700 shadow-sm" 
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {goal}
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                      selected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 bg-white"
                    }`}>
                      {selected && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-2 border-t border-gray-100 pt-6">
            <label className="block text-sm font-semibold text-gray-800">Timezone Settings</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none max-w-md"
              required
            />
          </div>

          {/* Permissions & Disclosures */}
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              Privacy & Consent Controls
            </h3>
            
            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
              {/* Location Toggle */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 text-xs">Enable Location Permission</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Query local coordinates to capture temperature and weather indices.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={locationEnabled}
                  onChange={(e) => setLocationEnabled(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 cursor-pointer mt-1"
                />
              </div>
              
              {/* Env Snapshot Consent */}
              <div className="flex items-start justify-between gap-4 border-t border-gray-200/60 pt-4">
                <div>
                  <h4 className="font-semibold text-gray-900 text-xs">Store Environment Context Snapshots</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Attach weather parameters to logged check-in entries to compute custom correlations.
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

          {/* Save Button */}
          <div className="flex justify-end border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-6 py-2.5 rounded-lg text-sm shadow-md transition-colors"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>

        </form>

      </div>
    </DashboardLayout>
  )
}

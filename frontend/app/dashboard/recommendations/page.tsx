"use client"

import React, { useEffect, useState } from "react"
import DashboardLayout from "@/components/DashboardLayout"
import { Award, CheckCircle2, ThumbsUp, Sparkles, TrendingUp } from "lucide-react"

interface Recommendation {
  id: number
  activity_id: number
  reason: string
  recommendation_score: number
  feedback?: string
  activity: {
    id: number
    name: string
    category: string
    description: string
    duration_minutes: number
  }
}

interface OutcomeItem {
  activity_name: string
  completed_times: number
  helpfulness_rate: number
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [outcomes, setOutcomes] = useState<OutcomeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<Record<number, boolean>>({})

  const fetchData = async () => {
    const token = localStorage.getItem("token")
    try {
      const recRes = await fetch("http://localhost:8000/api/recommendations", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (recRes.status === 200) {
        setRecs(await recRes.json())
      }

      const outcomeRes = await fetch("http://localhost:8000/api/recommendations/outcomes", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (outcomeRes.status === 200) {
        setOutcomes(await outcomeRes.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleFeedback = async (recId: number, feedbackType: string) => {
    const token = localStorage.getItem("token")
    setCompleting(prev => ({ ...prev, [recId]: true }))
    try {
      const res = await fetch(`http://localhost:8000/api/recommendations/${recId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ feedback: feedbackType })
      })
      if (res.status === 200) {
        fetchData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCompleting(prev => ({ ...prev, [recId]: false }))
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-gray-500 text-center font-medium py-10">Calculating personalized recommendations...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Recommendations Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Your Personalized Recommendations
            </h3>
            
            <div className="space-y-4">
              {recs.length > 0 ? (
                recs.map(rec => (
                  <div key={rec.id} className="p-4 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {rec.activity.category}
                          </span>
                          <span className="text-xs text-gray-400">
                            {rec.activity.duration_minutes} min
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 mt-1">{rec.activity.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{rec.activity.description}</p>
                      </div>
                      
                      <div className="shrink-0">
                        {rec.feedback ? (
                          <span className="text-xs text-gray-400 font-semibold flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                            <CheckCircle2 className="w-4 h-4 text-green-500" /> Completed
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleFeedback(rec.id, "👍 Helpful")}
                              disabled={completing[rec.id]}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1"
                            >
                              👍 Helpful
                            </button>
                            <button
                              onClick={() => handleFeedback(rec.id, "👎 Not Helpful")}
                              disabled={completing[rec.id]}
                              className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold px-3.5 py-1.5 rounded-lg"
                            >
                              👎
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/60 text-xs text-blue-800 italic">
                      Recommendation score: {Math.round(rec.recommendation_score * 100)}% Match. <br />
                      Reason: "{rec.reason}"
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-6">No suggestions. Log check-ins to unlock recommendation cards.</p>
              )}
            </div>
          </div>
        </div>

        {/* Outcomes - What Helped Me */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 sticky top-6">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              What Helped Me?
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Based on historical thumbs-up activity ratings. SoulSync prioritizes activities with higher helpfulness rates.
            </p>
            
            <div className="space-y-3 pt-2">
              {outcomes.length > 0 ? (
                outcomes.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-gray-800">{item.activity_name}</p>
                      <p className="text-gray-400 mt-0.5">Completed {item.completed_times} times</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-600">{item.helpfulness_rate}%</p>
                      <p className="text-[10px] text-gray-400">Helpful Rating</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 py-4 text-center">No completed logs registered yet. Complete recommended tasks to compile outcome charts.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}

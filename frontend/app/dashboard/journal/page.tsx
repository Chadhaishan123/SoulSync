"use client"

import React, { useEffect, useState } from "react"
import DashboardLayout from "../../../components/DashboardLayout"
import { motion } from "framer-motion"
import { BookOpen, Sparkles, Plus, Calendar, Smile } from "lucide-react"

interface JournalAnalysis {
  sentiment_score: number
  dominant_emotion: string
  emotion_probabilities: Record<string, number>
  themes: string[]
  summary?: string
}

interface JournalEntry {
  id: number
  content: string
  created_at: string
  analysis?: JournalAnalysis
}

export default function JournalPage() {
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [error, setError] = useState("")

  const fetchJournals = async () => {
    const token = localStorage.getItem("token")
    try {
      const res = await fetch("http://localhost:8000/api/journals", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.status === 200) {
        const data = await res.json()
        setJournals(data)
        if (data.length > 0 && !selectedEntry) {
          setSelectedEntry(data[0])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJournals()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    
    setSaving(true)
    setError("")
    const token = localStorage.getItem("token")
    
    try {
      const res = await fetch("http://localhost:8000/api/journals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      })
      
      if (res.status === 200) {
        const newEntry = await res.json()
        setContent("")
        // Refresh journal list
        await fetchJournals()
        // Select new entry
        setSelectedEntry(newEntry)
      } else {
        setError("Failed to save and analyze entry.")
      }
    } catch (err) {
      console.error(err)
      setError("Network error. Backend might be offline.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-gray-500 text-center font-medium py-10">Synchronizing journal database...</p>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid lg:grid-cols-3 gap-8"
      >
        
        {/* Editor & Logs List Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Editor Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Write in Your Journal
            </h3>
            
            {error && (
              <div className="bg-red-50 text-red-700 text-xs px-4 py-2.5 rounded-lg border border-red-100">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSave} className="space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="How was your day? Write down your thoughts and reflections. Our NLP model will analyze the dominant emotion, extract keywords/themes, and generate an AI summary..."
                className="w-full min-h-[160px] p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y text-sm transition-all"
                required
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !content.trim()}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-6 py-2.5 rounded-lg text-sm shadow-sm transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {saving ? "Running NLP Analysis..." : "Save & Analyze Entry"}
                </button>
              </div>
            </form>
          </div>

          {/* Past Entries Logs */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Journal History</h3>
            <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-2">
              {journals.length > 0 ? (
                journals.map(entry => {
                  const isSelected = selectedEntry?.id === entry.id
                  const entryDate = new Date(entry.created_at).toLocaleDateString()
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`w-full text-left py-4 flex justify-between items-center gap-4 transition-colors px-2 rounded-lg ${
                        isSelected ? "bg-blue-50/40 font-semibold text-blue-900" : "hover:bg-gray-50/50"
                      }`}
                    >
                      <div className="truncate flex-1 space-y-0.5">
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {entryDate}
                        </p>
                        <p className="text-sm text-gray-700 truncate">{entry.content}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                        {entry.analysis?.dominant_emotion || "Neutral"}
                      </span>
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-gray-500 py-6 text-center">No journal logs recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* AI Analysis Sidebar */}
        <div className="space-y-6">
          {selectedEntry ? (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 sticky top-6">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">AI Sentiment Analysis</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Logged on {new Date(selectedEntry.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Dominant Emotion */}
              <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider">Dominant Emotion</p>
                  <p className="text-lg font-bold text-blue-900">{selectedEntry.analysis?.dominant_emotion}</p>
                </div>
                <div className="text-2xl">
                  {selectedEntry.analysis?.dominant_emotion === "Happy" ? "😊" :
                   selectedEntry.analysis?.dominant_emotion === "Sad" ? "😔" :
                   selectedEntry.analysis?.dominant_emotion === "Anxious" ? "😰" :
                   selectedEntry.analysis?.dominant_emotion === "Angry" ? "😡" :
                   selectedEntry.analysis?.dominant_emotion === "Calm" ? "😌" : "😐"}
                </div>
              </div>

              {/* Summary */}
              {selectedEntry.analysis?.summary && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Summary</h4>
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                    "{selectedEntry.analysis.summary}"
                  </p>
                </div>
              )}

              {/* Sentiment Score */}
              {selectedEntry.analysis && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-gray-400 uppercase">
                    <span>Sentiment Score</span>
                    <span className={selectedEntry.analysis.sentiment_score >= 0 ? "text-green-600" : "text-red-600"}>
                      {selectedEntry.analysis.sentiment_score >= 0 ? "+" : ""}
                      {selectedEntry.analysis.sentiment_score.toFixed(2)}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 relative overflow-hidden">
                    <div 
                      className={`h-2 rounded-full ${selectedEntry.analysis.sentiment_score >= 0 ? "bg-green-500" : "bg-red-500"}`} 
                      style={{ 
                        width: `${Math.abs(selectedEntry.analysis.sentiment_score) * 100}%`,
                        marginLeft: selectedEntry.analysis.sentiment_score >= 0 ? "0%" : "auto"
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Themes */}
              {selectedEntry.analysis?.themes && selectedEntry.analysis.themes.length > 0 && (
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detected Themes</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEntry.analysis.themes.map((theme, i) => (
                      <span key={i} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center py-12 text-gray-500 text-sm">
              Select a journal entry to view AI sentiment and theme analytics.
            </div>
          )}
        </div>

      </motion.div>
    </DashboardLayout>
  )
}

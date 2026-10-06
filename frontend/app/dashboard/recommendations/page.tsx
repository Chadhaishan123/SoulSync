"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Award, CheckCircle2, Clock } from "lucide-react"
import { api } from "@/lib/api"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { SkeletonCard } from "@/components/ui/Skeleton"
import { ACTIVITY_CATEGORIES } from "@/lib/constants"
import type { Recommendation } from "@/types/activity"
import toast from "react-hot-toast"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRecs()
  }, [])

  const loadRecs = async () => {
    try {
      const data = await api.recommendations.list()
      setRecs(data)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (recId: number) => {
    try {
      await api.recommendations.feedback(recId, "completed")
      toast.success("Activity completed! 🎉")
      loadRecs()
    } catch {
      toast.error("Failed to record feedback")
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const active = recs.filter((r) => !r.feedback)
  const completed = recs.filter((r) => r.feedback)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Award className="w-6 h-6 text-soul-purple" />
          Recommendations
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Personalized wellness activities generated from your current behavioral profile and recent trends.
        </p>
      </div>

      {/* Active Recommendations */}
      {active.length > 0 ? (
        <motion.div
          className="space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {active.map((rec) => {
            const cat = ACTIVITY_CATEGORIES[rec.activity.category] || { color: "purple", icon: "✨" }
            return (
              <motion.div key={rec.id} variants={itemVariants}>
                <Card variant="interactive" className="!p-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="purple" size="sm">{rec.activity.category}</Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {rec.activity.duration_minutes} min
                        </div>
                      </div>
                      <h4 className="text-base font-bold text-foreground">{rec.activity.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{rec.activity.description}</p>
                      <p className="text-xs text-soul-purple/80 mt-2 italic">
                        💡 {rec.reason}
                      </p>
                    </div>
                    <div className="shrink-0 self-center">
                      <Button size="sm" onClick={() => handleComplete(rec.id)}>
                        Complete ✓
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground text-center py-6">
            Complete a daily check-in to receive personalized recommendations.
          </p>
        </Card>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Completed ({completed.length})
          </h3>
          <div className="space-y-2">
            {completed.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/30 border border-border/50 opacity-60"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-foreground">{rec.activity.name}</span>
                <Badge variant="success" size="sm" className="ml-auto">Done</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

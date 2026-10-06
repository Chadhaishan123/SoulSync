export interface Activity {
  id: number
  name: string
  category: string
  description: string
  duration_minutes: number
  mood_tags: string[]
  created_by_user_id: number | null
}

export interface Recommendation {
  id: number
  user_id: number
  activity_id: number
  reason: string
  recommendation_score: number
  feedback: string | null
  created_at: string
  activity: Activity
}

export interface ActivityCompletion {
  id: number
  user_id: number
  activity_id: number
  completed_at: string
  duration_minutes: number | null
  mood_before: number | null
  mood_after: number | null
  notes: string | null
}

export interface RecommendationFeedback {
  feedback: string
}

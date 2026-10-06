export interface SleepRecord {
  id: number
  user_id: number
  sleep_date: string
  bedtime: string | null
  wake_time: string | null
  duration_minutes: number
  quality_rating: number
  notes: string | null
  created_at: string
}

export interface SleepCreatePayload {
  sleep_date: string
  bedtime?: string
  wake_time?: string
  duration_minutes: number
  quality_rating: number
  notes?: string
}

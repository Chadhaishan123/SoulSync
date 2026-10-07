export interface MoodEntry {
  id: number
  user_id: number
  mood_score: number
  stress_level: number
  energy_level: number
  sleep_quality: number
  primary_emotion: string
  context_tags: string[]
  notes: string | null
  local_date: string
  recorded_at: string
}

export interface CheckinPayload {
  mood_score: number
  stress_level: number
  energy_level: number
  sleep_quality: number
  primary_emotion: string
  context_tags?: string[]
  notes?: string
}

export interface LatestMetrics {
  mood: number
  stress: number
  energy: number
  sleep_quality: number
  primary_emotion: string
  recorded_at?: string
}

export interface DashboardWeather {
  state: string
  forecast: string
  latest_metrics?: LatestMetrics
}

export interface DashboardTwin {
  current_pattern: string
  clusters: Record<string, number>
  total_days: number
}

export interface DashboardTrend {
  value: string
  confidence: number
  explanation: string
}

export interface DashboardAnomaly {
  is_anomaly: boolean
  score: number
  message: string
}

export interface DashboardData {
  weather: DashboardWeather
  digital_twin: DashboardTwin
  trend_prediction: DashboardTrend
  anomaly: DashboardAnomaly
  latest_journal_emotion?: string
}

export interface SimulationPayload {
  sleep_hours: number
  exercise_minutes: number
  meditation_minutes: number
  outdoor_minutes: number
}

export interface SimulationResult {
  baseline_mood: number
  simulated_mood: number
  mood_delta: number
  predicted_weather: string
  forecast_narrative: string
  anxiety_reduction_pct: number
  recommendations: string[]
}

export interface TwinChatResult {
  reply: string
  insights_found: string[]
  dominant_pattern: string
  confidence: number
}


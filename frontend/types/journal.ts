export interface JournalEntry {
  id: number
  user_id: number
  content: string
  entry_type: string
  local_date: string
  written_at: string
  analysis?: JournalAnalysis | null
  gratitude_items?: GratitudeItem[]
}

export type SoulSyncEmotion = "Happy" | "Sad" | "Anxious" | "Angry" | "Calm" | "Neutral"

export interface JournalAnalysis {
  id: number
  journal_entry_id?: number
  dominant_emotion: SoulSyncEmotion | string
  dominant_emotion_score?: number | null
  emotions?: Record<string, number>
  sentiment_score: number
  sentiment_label: string
  sentiment_confidence?: number | null
  themes: string[]
  keywords?: string[]
  engine?: "transformer" | "lexicon" | string
  model_version?: string | null
  analyzed_at: string
}

export interface GratitudeItem {
  id: number
  journal_entry_id: number
  content: string
  position: number
}

export interface JournalCreatePayload {
  content: string
  entry_type?: string
  gratitude_items?: string[]
}

export interface ConversationSession {
  id: number
  user_id: number
  title: string | null
  started_at: string
  last_message_at: string | null
  message_count: number
}

export interface ConversationMessage {
  id: number
  session_id: number
  role: "user" | "assistant"
  content: string
  created_at: string
}

export interface CompanionSendPayload {
  message: string
  session_id?: number | null
}

export interface CompanionResponse {
  reply: string
  session_id: number
  emotion_detected?: string
  data_context?: string
}

export interface User {
  id: number
  name: string
  email: string
  created_at: string
  last_login_at: string | null
}

export interface UserProfile {
  user_id: number
  timezone: string
  wellness_goals: string | null
  reminder_hour: number | null
  sleep_goal_minutes: number | null
  location_enabled: boolean
  environment_enabled: boolean
  nlp_analysis_enabled: boolean
  notifications_enabled: boolean
  personalization_enabled: boolean
  last_latitude: number | null
  last_longitude: number | null
  last_city: string | null
  last_country_code: string | null
  location_updated_at: string | null
  onboarded_at: string | null
  has_real_location: boolean
}

export interface MeResponse {
  id: number
  name: string
  email: string
  created_at: string
  last_login_at: string | null
  profile: UserProfile
  is_onboarded: boolean
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface OnboardingRequest {
  timezone: string
  wellness_goals: string
  reminder_hour: number
  sleep_goal_minutes: number
  location_enabled: boolean
  environment_enabled: boolean
  nlp_analysis_enabled: boolean
  notifications_enabled: boolean
  latitude?: number | null
  longitude?: number | null
}

export interface ConsentUpdate {
  location_enabled?: boolean
  environment_enabled?: boolean
  nlp_analysis_enabled?: boolean
  notifications_enabled?: boolean
  personalization_enabled?: boolean
}

export interface ConsentRecord {
  id: number
  user_id: number
  consent_type: string
  is_granted: boolean
  granted_at: string | null
  revoked_at: string | null
  created_at: string
}

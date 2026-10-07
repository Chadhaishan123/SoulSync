const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

interface FetchOptions {
  method?: Method
  body?: unknown
  headers?: Record<string, string>
  formEncoded?: boolean
}

class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    let message = `API error ${status}`
    if (typeof data === "object" && data !== null && "detail" in data) {
      const detail = (data as Record<string, unknown>).detail
      if (typeof detail === "string") {
        message = detail
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item: unknown) => {
            if (typeof item === "object" && item !== null && "msg" in item) {
              return String((item as Record<string, unknown>).msg).replace(/^Value error,\s*/i, "")
            }
            return String(item)
          })
          .join(". ")
      } else if (typeof detail === "object" && detail !== null) {
        message = JSON.stringify(detail)
      }
    }
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("refresh_token")
}

function setTokens(access: string, refresh?: string) {
  localStorage.setItem("token", access)
  if (refresh) localStorage.setItem("refresh_token", refresh)
}

function clearTokens() {
  localStorage.removeItem("token")
  localStorage.removeItem("refresh_token")
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    })

    if (res.ok) {
      const data = await res.json()
      setTokens(data.access_token, data.refresh_token)
      return data.access_token
    }
  } catch {
    // refresh failed
  }

  clearTokens()
  return null
}

async function request<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, formEncoded = false } = options

  const token = getToken()
  const reqHeaders: Record<string, string> = {
    ...headers,
  }

  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`
  }

  let reqBody: string | undefined

  if (body !== undefined) {
    if (formEncoded) {
      reqHeaders["Content-Type"] = "application/x-www-form-urlencoded"
      reqBody = body as string
    } else {
      reqHeaders["Content-Type"] = "application/json"
      reqBody = JSON.stringify(body)
    }
  }

  let res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: reqBody,
  })

  // Auto-refresh on 401
  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      reqHeaders["Authorization"] = `Bearer ${newToken}`
      res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: reqHeaders,
        body: reqBody,
      })
    }
  }

  if (!res.ok) {
    let data: unknown
    try {
      data = await res.json()
    } catch {
      data = { detail: res.statusText }
    }
    throw new ApiError(res.status, data)
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<import("@/types/auth").AuthResponse>("/api/v1/auth/login", {
        method: "POST",
        body: { email, password },
      }),
    register: (name: string, email: string, password: string) =>
      request<import("@/types/auth").AuthResponse>("/api/v1/auth/register", {
        method: "POST",
        body: { name, email, password },
      }),
    refresh: (token: string) =>
      request<{ access_token: string; refresh_token: string }>(
        "/api/v1/auth/refresh",
        { method: "POST", body: { refresh_token: token } }
      ),
  },

  user: {
    getMe: () =>
      request<import("@/types/auth").MeResponse>("/api/v1/users/me"),
    updateProfile: (data: import("@/types/auth").ProfileUpdateRequest) =>
      request("/api/v1/users/me", { method: "PATCH", body: data }),
    onboarding: (data: import("@/types/auth").OnboardingRequest) =>
      request("/api/v1/users/me/onboarding", { method: "POST", body: data }),
    updateLocation: (lat: number, lon: number, timezone?: string) =>
      request("/api/v1/users/me/location", {
        method: "PUT",
        body: { latitude: lat, longitude: lon, timezone },
      }),
    updateConsents: (data: import("@/types/auth").ConsentUpdate) =>
      request("/api/v1/users/me/consents", { method: "PATCH", body: data }),
    getConsents: () =>
      request<import("@/types/auth").ConsentRecord[]>("/api/v1/users/me/consents"),
    exportData: () =>
      request("/api/v1/users/me/export"),
    deleteAccount: (password: string) =>
      request("/api/v1/users/me", {
        method: "DELETE",
        body: { password },
      }),
  },

  checkins: {
    create: (data: import("@/types/mood").CheckinPayload) =>
      request("/api/v1/users/me/checkins", { method: "POST", body: data }),
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : ""
      return request<import("@/types/mood").MoodEntry[]>(`/api/v1/users/me/checkins${qs}`)
    },
  },

  journal: {
    create: (data: import("@/types/journal").JournalCreatePayload) =>
      request<import("@/types/journal").JournalEntry>("/api/v1/users/me/journal", {
        method: "POST",
        body: data,
      }),
    list: () =>
      request<import("@/types/journal").JournalEntry[]>("/api/v1/users/me/journal"),
    analyze: (entryId: number) =>
      request<import("@/types/journal").JournalAnalysis>(
        `/api/v1/users/me/journal/${entryId}/analyze`,
        { method: "POST" }
      ),
  },

  sleep: {
    create: (data: import("@/types/sleep").SleepCreatePayload) =>
      request<import("@/types/sleep").SleepRecord>("/api/v1/users/me/sleep", {
        method: "POST",
        body: data,
      }),
    list: () =>
      request<import("@/types/sleep").SleepRecord[]>("/api/v1/users/me/sleep"),
  },

  insights: {
    dashboard: () =>
      request<import("@/types/mood").DashboardData>("/api/insights/dashboard"),
    simulate: (payload: import("@/types/mood").SimulationPayload) =>
      request<import("@/types/mood").SimulationResult>("/api/insights/simulate", {
        method: "POST",
        body: payload,
      }),
    twinChat: (message: string) =>
      request<import("@/types/mood").TwinChatResult>("/api/insights/twin/chat", {
        method: "POST",
        body: { message },
      }),
  },

  companion: {
    send: (message: string, sessionId?: number | null) =>
      request<import("@/types/companion").CompanionResponse>(
        "/api/v1/users/me/companion",
        { method: "POST", body: { message, session_id: sessionId } }
      ),
    sessions: () =>
      request<import("@/types/companion").ConversationSession[]>(
        "/api/v1/users/me/companion/sessions"
      ),
  },

  recommendations: {
    list: () =>
      request<import("@/types/activity").Recommendation[]>("/api/recommendations"),
    feedback: (recId: number, feedback: string) =>
      request(`/api/recommendations/${recId}/feedback`, {
        method: "POST",
        body: { feedback },
      }),
  },

  environment: {
    now: (lat?: number, lon?: number) => {
      const params = new URLSearchParams()
      if (lat !== undefined) params.append("lat", lat.toString())
      if (lon !== undefined) params.append("lon", lon.toString())
      const qs = params.toString() ? `?${params.toString()}` : ""
      return request<any>(`/api/v1/env/now${qs}`)
    },
    current: () =>
      request<import("@/types/environment").EnvironmentCurrent>(
        "/api/v1/environment/current"
      ),
  },
}

export { ApiError, clearTokens, setTokens, getToken }
export default api

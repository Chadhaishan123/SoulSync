"use client"

import { useState, useCallback } from "react"
import { api, ApiError } from "@/lib/api"

interface UseApiState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  execute: (...args: unknown[]) => Promise<T | null>
  reset: () => void
}

export function useApi<T>(
  apiCall: (...args: unknown[]) => Promise<T>
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await apiCall(...args)
        setData(result)
        return result
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "An unexpected error occurred"
        setError(message)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [apiCall]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return { data, isLoading, error, execute, reset }
}

export { api, ApiError }
export default useApi

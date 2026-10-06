export interface ClusterData {
  current_pattern: string
  clusters: Record<string, number>
  total_days: number
  cluster_descriptions?: Record<string, string>
}

export interface AnomalyData {
  is_anomaly: boolean
  score: number
  message: string
  deviating_metrics?: string[]
}

export interface TrendPrediction {
  value: "Improving" | "Declining" | "Stable"
  confidence: number
  explanation: string
  features_used?: string[]
}

export interface DetectedPattern {
  id: number
  user_id: number
  pattern_type: string
  description: string
  confidence: number
  detected_at: string
  metadata: Record<string, unknown>
}

export interface MLPrediction {
  id: number
  user_id: number
  prediction_type: string
  predicted_value: string
  confidence: number
  created_at: string
}

export interface InsightsPageData {
  cluster: ClusterData
  anomaly: AnomalyData
  trend: TrendPrediction
  patterns: DetectedPattern[]
  predictions: MLPrediction[]
}

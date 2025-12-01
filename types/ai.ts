export type SentimentProviderKind = 'huggingface' | 'local'

export interface SentimentRequestOptions {
  model?: string
}

export interface SentimentScoreDetail {
  label: string
  score: number
}

export interface SentimentResult {
  method: string
  label?: string
  confidence?: number
  scores?: SentimentScoreDetail[]
  rawResult?: unknown
  provider?: SentimentProviderKind | string
  model?: string
  generatedText?: string
  dominantEmotion?: string
  meta?: Record<string, unknown>
}

export interface SentimentProvider {
  kind: SentimentProviderKind
  analyze(text: string, options?: SentimentRequestOptions): Promise<SentimentResult>
  availableModels?(): Record<string, string>
}

export interface SimilarCase {
  id: string
  title: string
  customer: string
  summary: string
  trigger: string
  matchScore: number
  qualityLevel: 'High' | 'Medium' | 'Low'
  recommendedActions: string[]
  segment?: string
  lastUpdated?: string
}

export interface AiSuggestedSummary {
  headline: string
  keyFindings: string[]
  recommendedActions: string[]
  tone: 'positive' | 'neutral' | 'negative'
  confidence: number
  riskLevel: 'low' | 'medium' | 'high'
}

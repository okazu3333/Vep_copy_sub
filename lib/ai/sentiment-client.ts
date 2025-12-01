import { HuggingFaceProvider } from '@/lib/ai/providers/huggingface'
import { LocalSentimentProvider } from '@/lib/ai/providers/local'
import {
  SentimentProvider,
  SentimentProviderKind,
  SentimentRequestOptions,
  SentimentResult
} from '@/types/ai'

type ProviderFactory = () => SentimentProvider

const PROVIDER_FACTORIES: Record<SentimentProviderKind, ProviderFactory> = {
  huggingface: () => new HuggingFaceProvider(),
  local: () => new LocalSentimentProvider()
}

let cachedProvider: SentimentProvider | null = null

function resolveProvider(): SentimentProvider {
  if (cachedProvider) return cachedProvider

  const key = (process.env.SENTIMENT_PROVIDER as SentimentProviderKind) ?? 'huggingface'
  const factory = PROVIDER_FACTORIES[key]

  if (!factory) {
    throw new Error(`Unsupported sentiment provider: ${key}`)
  }

  cachedProvider = factory()
  return cachedProvider
}

export async function analyzeSentiment(
  text: string,
  options?: SentimentRequestOptions
): Promise<SentimentResult> {
  if (!text) {
    throw new Error('Text is required for sentiment analysis')
  }

  const provider = resolveProvider()

  try {
    const result = await provider.analyze(text, options)
    return {
      ...result,
      provider: result.provider ?? provider.kind
    }
  } catch (error) {
    console.error('Sentiment provider failed. Falling back to rule-based analysis.', error)
    return fallbackRuleBasedAnalysis(text)
  }
}

export function fallbackRuleBasedAnalysis(text: string): SentimentResult {
  const positiveWords = [
    'ありがとう',
    '感謝',
    '素晴らしい',
    '良い',
    '満足',
    '喜び',
    '嬉しい',
    '楽しい',
    '期待',
    '希望',
    '成功',
    '達成',
    '完了',
    '承知',
    '了解',
    '承諾',
    '承認',
    '同意',
    '賛成',
    '支持',
    '応援'
  ]
  const negativeWords = [
    '問題',
    '困った',
    '困っています',
    '大変',
    '難しい',
    '複雑',
    '遅い',
    '遅延',
    '失敗',
    'エラー',
    'バグ',
    '不具合',
    '故障',
    '品質',
    '悪い',
    '粗悪',
    '不満',
    '苦情',
    'クレーム',
    '謝罪',
    '申し訳',
    'すみません',
    'ご迷惑',
    'キャンセル',
    '解約',
    '中止',
    '停止',
    '終了',
    '破棄',
    '取り消し'
  ]
  const urgentWords = [
    '緊急',
    '至急',
    '急ぎ',
    '早急',
    'すぐ',
    '今すぐ',
    '即座',
    '即時',
    '期限',
    '締切',
    '納期',
    '間に合わない',
    '遅れる',
    '遅延',
    'トラブル',
    '障害',
    '停止',
    'ダウン'
  ]

  const scoreCounts = {
    positive: 0,
    negative: 0,
    urgent: 0
  }

  positiveWords.forEach((word) => {
    const matches = text.match(new RegExp(word, 'gi'))
    if (matches) scoreCounts.positive += matches.length
  })

  negativeWords.forEach((word) => {
    const matches = text.match(new RegExp(word, 'gi'))
    if (matches) scoreCounts.negative += matches.length
  })

  urgentWords.forEach((word) => {
    const matches = text.match(new RegExp(word, 'gi'))
    if (matches) scoreCounts.urgent += matches.length
  })

  const total = scoreCounts.positive + scoreCounts.negative + scoreCounts.urgent
  let dominantEmotion = 'neutral'
  let confidence = 0

  if (total > 0) {
    const entries = Object.entries(scoreCounts).sort((a, b) => b[1] - a[1])
    dominantEmotion = entries[0][0]
    confidence = entries[0][1] / total
  }

  return {
    method: 'rule_based_fallback',
    dominantEmotion,
    confidence: Math.round(confidence * 100) / 100,
    scores: [
      { label: 'positive', score: scoreCounts.positive },
      { label: 'negative', score: scoreCounts.negative },
      { label: 'urgent', score: scoreCounts.urgent }
    ],
    rawResult: { counts: scoreCounts, total },
    provider: 'local'
  }
}

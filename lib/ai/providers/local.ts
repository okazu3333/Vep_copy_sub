import { SentimentProvider, SentimentRequestOptions, SentimentResult } from '@/types/ai'

const LOCAL_SENTIMENT_ENDPOINT = process.env.LOCAL_SENTIMENT_ENDPOINT ?? ''

export class LocalSentimentProvider implements SentimentProvider {
  kind: 'local' = 'local'

  async analyze(text: string, options?: SentimentRequestOptions): Promise<SentimentResult> {
    if (!LOCAL_SENTIMENT_ENDPOINT) {
      throw new Error('LOCAL_SENTIMENT_ENDPOINT is not configured')
    }

    const response = await fetch(LOCAL_SENTIMENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model: options?.model
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Local sentiment endpoint error ${response.status}: ${errorText}`)
    }

    const payload = await response.json()
    return normalizeLocalSentiment(payload)
  }
}

function normalizeLocalSentiment(raw: any): SentimentResult {
  if (raw && typeof raw === 'object' && raw.method) {
    return {
      ...raw,
      provider: raw.provider ?? 'local'
    }
  }

  return {
    method: 'local_custom',
    rawResult: raw,
    provider: 'local'
  }
}

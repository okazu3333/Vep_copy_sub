import { SentimentProvider, SentimentRequestOptions, SentimentResult } from '@/types/ai'

const DEFAULT_API_URL = process.env.HUGGINGFACE_API_URL ?? 'https://api-inference.huggingface.co/models'
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY ?? 'hf_xxx'

export const HUGGINGFACE_SENTIMENT_MODELS: Record<string, string> = {
  'japanese-bert': 'cl-tohoku/bert-base-japanese-v3',
  'japanese-gpt': 'rinna/japanese-gpt-neox-3.6b',
  'line-japanese': 'line-corporation/japanese-large-lm'
}

const DEFAULT_MODEL_KEY = 'japanese-bert'

export class HuggingFaceProvider implements SentimentProvider {
  kind: 'huggingface' = 'huggingface'

  availableModels() {
    return HUGGINGFACE_SENTIMENT_MODELS
  }

  async analyze(text: string, options?: SentimentRequestOptions): Promise<SentimentResult> {
    const modelKey = options?.model ?? DEFAULT_MODEL_KEY
    const model = HUGGINGFACE_SENTIMENT_MODELS[modelKey]

    if (!model) {
      throw new Error(`Unsupported Hugging Face model key: ${modelKey}`)
    }

    const response = await fetch(`${DEFAULT_API_URL}/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          max_length: 512,
          return_all_scores: true
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Hugging Face API error ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    return transformHuggingFaceResult(result, modelKey, model)
  }
}

function transformHuggingFaceResult(result: any, modelKey: string, modelName: string): SentimentResult {
  if (Array.isArray(result)) {
    const sorted = [...result].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return {
      method: 'huggingface_classification',
      label: sorted[0]?.label ?? 'unknown',
      confidence: sorted[0]?.score ?? 0,
      scores: sorted.map((item) => ({
        label: item?.label ?? 'unknown',
        score: item?.score ?? 0
      })),
      rawResult: result,
      provider: 'huggingface',
      model: modelName,
      meta: { modelKey }
    }
  }

  if (Array.isArray(result?.generated_text)) {
    return {
      method: 'huggingface_generation',
      generatedText: result.generated_text,
      rawResult: result,
      provider: 'huggingface',
      model: modelName,
      meta: { modelKey }
    }
  }

  if (typeof result?.generated_text === 'string') {
    return {
      method: 'huggingface_generation',
      generatedText: result.generated_text,
      rawResult: result,
      provider: 'huggingface',
      model: modelName,
      meta: { modelKey }
    }
  }

  return {
    method: 'huggingface_unknown',
    rawResult: result,
    provider: 'huggingface',
    model: modelName,
    meta: { modelKey }
  }
}

#!/usr/bin/env node
const API_URL = process.env.HUGGINGFACE_API_URL ?? 'https://api-inference.huggingface.co/models'
const API_KEY = process.env.HUGGINGFACE_API_KEY ?? ''
const MODEL = process.env.HUGGINGFACE_MODEL ?? 'cl-tohoku/bert-base-japanese-v3'

if (!API_KEY) {
  console.error('HUGGINGFACE_API_KEY が設定されていません')
  process.exit(1)
}

const samples = [
  { label: 'urgent', text: '至急対応してください。障害で顧客のシステムが停止しています。' },
  { label: 'positive', text: '資料のご提供ありがとうございます。非常に助かりました。' },
]

async function callSample(sample) {
  const res = await fetch(`${API_URL}/${MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: sample.text,
      parameters: { max_length: 256, return_all_scores: true },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function main() {
  console.log(`=== Hugging Face Sentiment Health Check (model: ${MODEL}) ===`)
  for (const sample of samples) {
    try {
      const result = await callSample(sample)
      const top = Array.isArray(result) ? result[0] : result
      console.log(sample.label.padEnd(10), '->', top?.label, 'score', top?.score)
    } catch (error) {
      console.error(`Failed for sample "${sample.label}":`, error)
      process.exitCode = 1
    }
  }
}

main()

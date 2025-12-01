import { Alert } from '@/types'

type DetectionRuleType = NonNullable<Alert['detectionRule']>['rule_type']

type PersonaConfig = {
  match: (owner: string) => boolean
  subjectPrefix: string
  subjectTopics: string[]
  summaryTemplates: string[]
  customerPool: string[]
  severityPattern: Array<'A' | 'B' | 'C'>
  statusPattern: Array<Alert['status']>
  sentimentRange: [number, number]
  detectionRules: DetectionRuleType[]
  baseHourOffset: number
}

const PERSONA_CONFIGS: PersonaConfig[] = [
  {
    match: (owner) => owner.includes('tanaka'),
    subjectPrefix: '',
    subjectTopics: ['予算取り込み', '特別条件調整', '承認待ち案件', '導入フロー整理', '競合差別化提案'],
    summaryTemplates: [
      '{customer} から年度契約の最終確認依頼。金額と開始時期のすり合わせが必要。',
      '{customer} が稟議承認の条件を追加提示。上層部向け資料の補強を求められている。',
      '{customer} から契約期間見直しとKPIレビューの要望。遅延すると他社比較が進む懸念。',
    ],
    customerPool: ['Metro Logi', 'Innovation Holdings', 'Cross Media', 'Future Works'],
    severityPattern: ['A', 'A', 'B', 'B', 'C'],
    statusPattern: ['unhandled', 'in_progress', 'in_progress', 'completed'],
    sentimentRange: [-0.7, -0.2],
    detectionRules: ['inactivity_72h', 'sentiment_urgency', 'recovery_monitoring'],
    baseHourOffset: 12,
  },
  {
    match: (owner) => owner.includes('sato') || owner.includes('satou'),
    subjectPrefix: 'サポート圧迫 - ',
    subjectTopics: ['夜間問い合わせ', '障害追跡', '品質クレーム', '導入トラブル', '設定ミス連絡'],
    summaryTemplates: [
      '{customer} から深夜対応の改善要望。担当変更と対応ナレッジの共有が必要。',
      '{customer} 側で障害報告が増加。ログ調査と暫定回答を即日提示する必要あり。',
      '{customer} のQAチームから品質指摘。再現動画の提供と今後の抑止案を要求。',
    ],
    customerPool: ['Metro Support', 'Helios Systems', 'Next Stage', 'Urban Works'],
    severityPattern: ['B', 'A', 'B', 'B', 'C'],
    statusPattern: ['in_progress', 'unhandled', 'in_progress', 'completed'],
    sentimentRange: [-0.6, -0.1],
    detectionRules: ['tone_frequency_drop', 'sentiment_urgency', 'night_reply_rate'],
    baseHourOffset: 6,
  },
  {
    match: (owner) => owner.includes('suzuki'),
    subjectPrefix: '追加提案/解約抑止 - ',
    subjectTopics: ['大型オプション見積', '解約兆候ヒアリング', 'PoC結果報告', '意思決定者フォロー', '競合比較対応'],
    summaryTemplates: [
      '{customer} から追加モジュールの費用試算依頼。週内にROI根拠を提示する必要あり。',
      '{customer} による解約検討の再通知。役員帯とのエスカレーションMTGを要請。',
      '{customer} の技術責任者がPoC結果の詳細説明を希望。成功指標の再整理が必要。',
    ],
    customerPool: ['Prime Capital', 'Blue Ocean Retail', 'Skyway Consulting', 'North Data'],
    severityPattern: ['A', 'B', 'A', 'B', 'C'],
    statusPattern: ['unhandled', 'in_progress', 'in_progress', 'in_progress'],
    sentimentRange: [-0.5, 0.1],
    detectionRules: ['sentiment_urgency', 'topic_repetition_tone_drop', 'recovery_monitoring'],
    baseHourOffset: 4,
  },
]

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const pickFrom = <T,>(arr: T[], index: number): T => {
  if (!arr.length) {
    throw new Error('Array must not be empty')
  }
  return arr[index % arr.length]
}

const formatSubject = (subject: string, config: PersonaConfig, index: number) => {
  const topic = pickFrom(config.subjectTopics, index)
  return `${config.subjectPrefix}${topic}`
    .replace(/\s+/g, ' ')
    .trim()
    .concat(subject ? `｜${subject.replace(/^【.*?】/, '').trim()}` : '')
}

const formatSummary = (summary: string, customer: string, config: PersonaConfig, index: number) => {
  const template = pickFrom(config.summaryTemplates, index)
  const base = template.replace('{customer}', customer)
  return summary ? `${base} / ${summary}` : base
}

const deriveSentiment = (config: PersonaConfig, index: number) => {
  const [min, max] = config.sentimentRange
  const steps = config.sentimentRange[0] === config.sentimentRange[1] ? 1 : 5
  const ratio = (index % steps) / (steps - 1 || 1)
  const value = min + (max - min) * ratio
  return Number(clamp(value, -1, 1).toFixed(1))
}

const deriveUpdatedAt = (config: PersonaConfig, index: number) => {
  const hoursAgo = config.baseHourOffset + index * 3
  const date = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
  return date.toISOString()
}

const deriveDetectionRule = (config: PersonaConfig, index: number): Alert['detectionRule'] => {
  const rule = pickFrom(config.detectionRules, index)
  return {
    rule_type: rule,
    score: 60 + ((index * 17) % 35),
  }
}

const matchConfig = (owner?: string | null): PersonaConfig | null => {
  if (!owner) return null
  const normalized = owner.toLowerCase()
  return PERSONA_CONFIGS.find((config) => config.match(normalized)) ?? null
}

export const personalizeAlertsForOwner = (alerts: Alert[], owner?: string | null): Alert[] => {
  const config = matchConfig(owner)
  if (!config) return alerts
  return alerts.map((alert, index) => {
    const clone: Alert = {
      ...alert,
      detectionRule: { ...alert.detectionRule },
      quality: alert.quality ? { ...alert.quality } : undefined,
      phaseC: alert.phaseC ? { ...alert.phaseC } : undefined,
      phaseD: alert.phaseD ? { ...alert.phaseD } : undefined,
    }

    clone.customer = pickFrom(config.customerPool, index)
    clone.subject = formatSubject(alert.subject, config, index)
    clone.ai_summary = formatSummary(alert.ai_summary, clone.customer, config, index)
    clone.severity = pickFrom(config.severityPattern, index)
    clone.status = pickFrom(config.statusPattern, index)
    clone.sentiment_score = deriveSentiment(config, index)
    clone.updated_at = deriveUpdatedAt(config, index)
    clone.detectionRule = deriveDetectionRule(config, index)

    return clone
  })
}

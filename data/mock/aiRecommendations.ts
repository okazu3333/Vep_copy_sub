export interface MockSimilarCase {
  id: string
  title: string
  customer: string
  summary: string
  trigger: string
  matchScore: number
  qualityLevel: 'High' | 'Medium' | 'Low'
  recommendedActions: string[]
  segment: string
  lastUpdated: string
}

export interface MockAiSummary {
  headline: string
  keyFindings: string[]
  recommendedActions: string[]
  tone: 'positive' | 'neutral' | 'negative'
  confidence: number
  riskLevel: 'low' | 'medium' | 'high'
}

const now = new Date()
const daysAgo = (days: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

const SIMILAR_CASE_LIBRARY: Record<string, MockSimilarCase[]> = {
  forecast_trust_risk: [
    {
      id: 'case-TR-001',
      title: '更新折衝中のディスカウント要求',
      customer: 'Metro Holdings',
      summary:
        '価格改定に対する不安から、競合比較とディスカウント要求が継続。役員稟議が3週間停滞したケース。',
      trigger: '価格改定／競合比較',
      matchScore: 0.86,
      qualityLevel: 'High',
      recommendedActions: [
        '意思決定者との1:1セッションを設定',
        '値引き条件＋導入ロードマップのセットで提示',
      ],
      segment: 'forecast_trust_risk',
      lastUpdated: daysAgo(14),
    },
    {
      id: 'case-TR-003',
      title: 'ROI根拠の再提示で解約防止',
      customer: 'Next Link',
      summary:
        '過去ベンダーとの比較でROI差異を求められ、定量的指標を提示後に稟議を再開できた成功例。',
      trigger: 'ROI再確認',
      matchScore: 0.79,
      qualityLevel: 'Medium',
      recommendedActions: ['ROI実績を2パターン提示', '意思決定者向けサマリーを翌営業日までに共有'],
      segment: 'forecast_trust_risk',
      lastUpdated: daysAgo(21),
    },
  ],
  occurrence_followup: [
    {
      id: 'case-FW-002',
      title: 'フォロー打診メールの夜間返信集中',
      customer: 'Urban Works',
      summary: '夜間帯の会議設定が続き、顧客から昼間対応の切り替え要望が発生。日中スロットを追加提案。',
      trigger: '夜間返信異常',
      matchScore: 0.74,
      qualityLevel: 'High',
      recommendedActions: ['翌週の日中帯に再提案', '資料レビュー手順を明示'],
      segment: 'occurrence_followup',
      lastUpdated: daysAgo(9),
    },
  ],
  occurrence_delay: [
    {
      id: 'case-DY-010',
      title: '放置72h後のエスカレーション抑止',
      customer: 'North Data',
      summary:
        '72時間返信漏れで催促が入り、社内テンプレを使って謝罪＋次アクションを明確化して鎮火した例。',
      trigger: '72h未返信',
      matchScore: 0.81,
      qualityLevel: 'Medium',
      recommendedActions: ['遅延要因を透明化', '次の提出期限を明示', 'Slackで担当交代を通知'],
      segment: 'occurrence_delay',
      lastUpdated: daysAgo(5),
    },
  ],
}

const DEFAULT_SIMILAR_CASES: MockSimilarCase[] = [
  {
    id: 'case-GEN-001',
    title: '一般的なフォローアップ遅延',
    customer: 'Global Corp',
    summary: 'フォローアップの遅延でCXが悪化したため、優先度の高い顧客リストを再定義して改善した例。',
    trigger: 'フォロー遅延',
    matchScore: 0.7,
    qualityLevel: 'Medium',
    recommendedActions: ['優先度に合わせたタグ設定', '1営業日以内の確認ルールを設定'],
    segment: 'occurrence_delay',
    lastUpdated: daysAgo(10),
  },
]

const AI_SUMMARY_LIBRARY: Record<string, MockAiSummary> = {
  forecast_trust_risk: {
    headline: '価格改定を起点にした更新稟議の停滞',
    keyFindings: [
      '意思決定者がディスカウント条件の根拠を求めている',
      '競合比較資料の不足により不信感が増幅',
    ],
    recommendedActions: [
      '役員帯向けのROIハイライト資料を次回会議前に共有',
      '値引き条件と導入ロードマップをセットで提示',
    ],
    tone: 'negative',
    confidence: 0.82,
    riskLevel: 'high',
  },
  occurrence_followup: {
    headline: 'フォローアップの時間帯が顧客事情と不一致',
    keyFindings: ['夜間に打ち合わせが集中', '顧客から日中スロットへの変更希望'],
    recommendedActions: ['即日で午前帯の候補を提示', '作業差し替え時間のコミットを宣言'],
    tone: 'neutral',
    confidence: 0.75,
    riskLevel: 'medium',
  },
}

const DEFAULT_AI_SUMMARY: MockAiSummary = {
  headline: '対応優先度: 中',
  keyFindings: ['複数のネガティブ感情が続いています', '直近72時間で返信の空白が検知されました'],
  recommendedActions: ['担当者を再アサイン', '次の連絡時刻を顧客と合意する'],
  tone: 'negative',
  confidence: 0.65,
  riskLevel: 'medium',
}

export function getMockSimilarCases(segment?: string, limit = 3): MockSimilarCase[] {
  if (segment && SIMILAR_CASE_LIBRARY[segment]) {
    return SIMILAR_CASE_LIBRARY[segment].slice(0, limit)
  }
  return DEFAULT_SIMILAR_CASES.slice(0, limit)
}

export function getMockAiSummary(segment?: string): MockAiSummary {
  if (segment && AI_SUMMARY_LIBRARY[segment]) {
    return AI_SUMMARY_LIBRARY[segment]
  }
  return DEFAULT_AI_SUMMARY
}

import { NextRequest, NextResponse } from 'next/server'
import { detectSegment } from '@/lib/segment-detector'
import { SEGMENT_META, type SegmentKey } from '@/lib/segments'

/**
 * POST: ユースケースを分析して検知ルールを提案
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { usecase } = body

    if (!usecase || typeof usecase !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ユースケースが必要です' },
        { status: 400 }
      )
    }

    // キーワード抽出
    const keywordPatterns = {
      urgency: ['至急', '急ぎ', 'すぐ', '早く', 'まだですか', 'いつまで', '対応して', '返事がない', 'お待ちしています', 'ご確認ください'],
      complaint: ['クレーム', '不満', '問題', 'トラブル', '不具合', 'エラー', '悪い', 'ダメ', '失敗'],
      proposal: ['修正', '変更', '違う', '期待', '要望', '確認不足', '資料', '再共有', '説明不足', '条項', '仕様'],
      inquiry: ['確認', '質問', 'お願い', 'ROI', '不安', '懸念', '比較', '競合', '他社', '検討'],
      reoccurrence: ['また', '再度', '再発', '同じ問題', '前回と同じ', '同じ', '繰り返し'],
    }

    const lowerText = usecase.toLowerCase()
    const detectedKeywords: string[] = []
    const keywordCategories: Record<string, string[]> = {
      urgency: [],
      complaint: [],
      proposal: [],
      inquiry: [],
      reoccurrence: [],
    }

    Object.entries(keywordPatterns).forEach(([category, keywords]) => {
      keywords.forEach(kw => {
        if (lowerText.includes(kw.toLowerCase())) {
          detectedKeywords.push(kw)
          keywordCategories[category].push(kw)
        }
      })
    })

    // 感情スコアを推定
    let estimatedSentiment = 0
    if (keywordCategories.complaint.length > 0) {
      estimatedSentiment = -0.5
    } else if (keywordCategories.urgency.length > 0) {
      estimatedSentiment = -0.4
    } else if (keywordCategories.proposal.length > 0) {
      estimatedSentiment = -0.3
    } else if (keywordCategories.inquiry.length > 0) {
      estimatedSentiment = -0.2
    }

    // セグメント検知を試行
    const detectionResult = await detectSegment({
      subject: usecase,
      body: usecase,
      sentiment_score: estimatedSentiment,
      direction: 'inbound',
    })

    // 推奨検知条件を生成
    const suggestedConditions = []
    
    if (keywordCategories.complaint.length > 0) {
      suggestedConditions.push({
        metric: 'sentiment_score',
        operator: 'lt',
        value: -0.4,
        weight: 0.4,
      })
      suggestedConditions.push({
        metric: 'complaint_keywords',
        operator: 'contains',
        value: keywordCategories.complaint,
        weight: 0.6,
      })
    } else if (keywordCategories.urgency.length > 0) {
      suggestedConditions.push({
        metric: 'sentiment_score',
        operator: 'lt',
        value: -0.3,
        weight: 0.3,
      })
      suggestedConditions.push({
        metric: 'urgency_keywords',
        operator: 'contains',
        value: keywordCategories.urgency,
        weight: 0.7,
      })
    } else if (keywordCategories.proposal.length > 0) {
      suggestedConditions.push({
        metric: 'sentiment_score',
        operator: 'lt',
        value: -0.2,
        weight: 0.3,
      })
      suggestedConditions.push({
        metric: 'proposal_keywords',
        operator: 'contains',
        value: keywordCategories.proposal,
        weight: 0.7,
      })
    } else if (keywordCategories.inquiry.length > 0) {
      suggestedConditions.push({
        metric: 'sentiment_score',
        operator: 'lt',
        value: -0.2,
        weight: 0.3,
      })
      suggestedConditions.push({
        metric: 'inquiry_keywords',
        operator: 'contains',
        value: keywordCategories.inquiry,
        weight: 0.7,
      })
    }

    // 推奨セグメントを決定
    let recommendedSegment: SegmentKey | null = detectionResult?.segment || null
    let confidence = detectionResult?.confidence || 0.5

    // キーワードベースでセグメントを推奨
    if (!recommendedSegment) {
      if (keywordCategories.complaint.length > 0) {
        recommendedSegment = 'occurrence_complaint'
        confidence = 0.7
      } else if (keywordCategories.urgency.length > 0) {
        recommendedSegment = 'occurrence_followup'
        confidence = 0.6
      } else if (keywordCategories.proposal.length > 0) {
        recommendedSegment = 'occurrence_proposal_issue'
        confidence = 0.6
      } else if (keywordCategories.inquiry.length > 0) {
        recommendedSegment = 'forecast_trust_risk'
        confidence = 0.5
      }
    }

    return NextResponse.json({
      success: true,
      analysis: {
        segment: recommendedSegment,
        confidence,
        score: confidence * 100,
        reason: detectionResult?.reason || `キーワード分析: ${detectedKeywords.length}個のキーワードを検出`,
        suggested_keywords: detectedKeywords,
        suggested_conditions: suggestedConditions,
        keyword_categories: keywordCategories,
      },
    })
  } catch (error) {
    console.error('ユースケース分析エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'ユースケースの分析に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}


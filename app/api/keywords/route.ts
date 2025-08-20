import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

// キーワード定義
const KEYWORD_PATTERNS = {
  'クレーム・苦情': [
    'クレーム', '苦情', '不満', '問題', 'トラブル', '困った', '困っています',
    '改善', '対応', '解決', '謝罪', '申し訳', 'すみません', 'ご迷惑'
  ],
  'キャンセル・解約': [
    'キャンセル', '解約', '中止', '停止', '終了', '破棄', '取り消し',
    'やめたい', 'やめる', '辞退', '断る', 'お断り'
  ],
  '価格・料金': [
    '高い', '高額', '料金', '価格', '費用', 'コスト', '予算', '割引',
    '値引き', '安く', '安価', '無料', 'タダ'
  ],
  '品質・品質問題': [
    '品質', '質', '悪い', '粗悪', '不良', '不具合', '故障', 'エラー',
    'バグ', '問題', '欠陥', '劣化'
  ],
  '納期・スケジュール': [
    '遅い', '遅延', '遅れる', '間に合わない', '納期', '期限', '締切',
    'スケジュール', '予定', '延期', '変更'
  ],
  '競合・他社': [
    '他社', '競合', 'ライバル', '比較', '検討', '見積もり', '相見積もり',
    '他社の方が', '他社なら'
  ],
  '営業・提案': [
    '提案', '営業', '商談', '打ち合わせ', 'ミーティング', 'プレゼン',
    '見積もり', 'お見積もり', '御見積もり'
  ],
  'サポート・問い合わせ': [
    'サポート', '問い合わせ', '質問', '相談', '困った', '分からない',
    '使い方', 'マニュアル', '説明'
  ]
}

export async function GET(request: NextRequest) {
  try {
    // 現在のキーワード設定を返す
    return NextResponse.json({
      success: true,
      keywords: KEYWORD_PATTERNS,
      message: 'キーワード設定を取得しました'
    })
  } catch (error) {
    console.error('キーワード取得エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'キーワードの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    if (action === 'detect_keywords') {
      // メール内容からキーワードを検知
      const { subject, body } = data
      const detectedKeywords = detectKeywordsFromContent(subject, body)
      
      return NextResponse.json({
        success: true,
        detectedKeywords,
        message: 'キーワード検知が完了しました'
      })
    }
    
    if (action === 'update_keywords') {
      // キーワード設定の更新
      // ここでBigQueryのテーブルを更新する処理を実装
      
      return NextResponse.json({
        success: true,
        message: 'キーワード設定が更新されました'
      })
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: '無効なアクションです'
      },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('キーワード処理エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'キーワード処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// メール内容からキーワードを検知する関数
function detectKeywordsFromContent(subject: string, body: string): string[] {
  const detectedKeywords: string[] = []
  const content = `${subject} ${body}`.toLowerCase()
  
  for (const [category, patterns] of Object.entries(KEYWORD_PATTERNS)) {
    for (const pattern of patterns) {
      if (content.includes(pattern.toLowerCase())) {
        detectedKeywords.push(category)
        break // カテゴリごとに1つ見つかれば十分
      }
    }
  }
  
  return detectedKeywords.length > 0 ? detectedKeywords : ['その他']
} 
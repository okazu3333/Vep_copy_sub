import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    
    // モックの感情分析データを返す
    const mockSentimentData = {
      overallScore: Math.floor(Math.random() * 40) + 60, // 60-100の範囲
      trend: Math.random() > 0.5 ? 'improving' : 'declining',
      messageCount: Math.floor(Math.random() * 50) + 20, // 20-70の範囲
      lastAnalysis: new Date().toISOString().split('T')[0],
      radarData: [
        {
          label: '満足度',
          value: Math.floor(Math.random() * 30) + 70, // 70-100
          description: 'サービス・製品に対する顧客の満足度。メール内容の感情分析から算出。'
        },
        {
          label: '信頼度',
          value: Math.floor(Math.random() * 25) + 75, // 75-100
          description: '当社への信頼レベル。過去のやり取りの内容から判定。'
        },
        {
          label: '継続意向',
          value: Math.floor(Math.random() * 35) + 65, // 65-100
          description: 'サービス継続の意向度。契約更新に関する言及から分析。'
        },
        {
          label: '推奨度',
          value: Math.floor(Math.random() * 40) + 60, // 60-100
          description: '他社への推奨意向。NPS関連の発言から算出。'
        },
        {
          label: '応答性',
          value: Math.floor(Math.random() * 20) + 80, // 80-100
          description: 'メールへの返信速度と頻度。コミュニケーションの活発さを示す。'
        },
        {
          label: '問題解決',
          value: Math.floor(Math.random() * 30) + 70, // 70-100
          description: '問題解決への満足度。サポート対応に関する感情分析結果。'
        }
      ],
      riskFactors: [
        '返信頻度の低下が見られます',
        '価格に関する懸念が表明されています',
        '競合他社への言及が増加しています'
      ],
      positiveFactors: [
        'サポート対応への高い評価',
        '新機能への積極的な関心',
        '長期的な関係構築への意欲'
      ]
    };

    return NextResponse.json(mockSentimentData);
  } catch (error) {
    console.error('Error fetching sentiment data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment data' },
      { status: 500 }
    );
  }
}

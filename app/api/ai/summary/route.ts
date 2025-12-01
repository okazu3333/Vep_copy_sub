import { NextRequest, NextResponse } from 'next/server'

import { getMockAiSummary } from '@/data/mock/aiRecommendations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { segment } = body ?? {}
    const summary = getMockAiSummary(segment)

    return NextResponse.json({
      success: true,
      from: 'mock',
      summary,
    })
  } catch (error) {
    console.error('Failed to load AI summary', error)
    return NextResponse.json(
      {
        success: false,
        error: 'AI要約の取得に失敗しました',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  const summary = getMockAiSummary()
  return NextResponse.json({
    success: true,
    from: 'mock',
    summary,
  })
}

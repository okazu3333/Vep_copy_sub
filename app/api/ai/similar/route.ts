import { NextRequest, NextResponse } from 'next/server'

import { getMockSimilarCases } from '@/data/mock/aiRecommendations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { segment, limit = 3 } = body ?? {}

    // 将来的にはBigQuery/Vertexなどに差し替え
    const cases = getMockSimilarCases(segment, Number(limit) || 3)

    return NextResponse.json({
      success: true,
      from: 'mock',
      count: cases.length,
      cases,
    })
  } catch (error) {
    console.error('Failed to load similar cases', error)
    return NextResponse.json(
      {
        success: false,
        error: '類似事例の取得に失敗しました',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // 互換性: GETでもモックを返す
  const cases = getMockSimilarCases(undefined, 3)
  return NextResponse.json({
    success: true,
    from: 'mock',
    count: cases.length,
    cases,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSegmentRules, getSegmentRule } from '@/lib/segment-rules'
import type { SegmentRule } from '@/lib/segment-classifier'
import type { SegmentKey } from '@/lib/segments'

/**
 * GET: 検知ルール一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const segment = searchParams.get('segment') as SegmentKey | null

    if (segment) {
      const rule = getSegmentRule(segment)
      if (!rule) {
        return NextResponse.json(
          { success: false, error: 'ルールが見つかりません' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        rule,
      })
    }

    const rules = getSegmentRules()
    return NextResponse.json({
      success: true,
      rules,
      count: rules.length,
    })
  } catch (error) {
    console.error('検知ルール取得エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: '検知ルールの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST: 新しい検知ルールを追加
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rule } = body

    if (!rule || !rule.segment) {
      return NextResponse.json(
        { success: false, error: 'ルールデータが不正です' },
        { status: 400 }
      )
    }

    // TODO: 実際の保存処理（DBまたはファイル）
    // 現在はメモリ上のみ（再起動で消える）
    // 将来的には:
    // 1. BigQueryに保存
    // 2. または設定ファイルに保存
    // 3. または環境変数で管理

    console.log('新しい検知ルールを追加:', rule)

    return NextResponse.json({
      success: true,
      message: '検知ルールが追加されました',
      rule,
    })
  } catch (error) {
    console.error('検知ルール追加エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: '検知ルールの追加に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT: 検知ルールを更新
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { segment, rule } = body

    if (!segment || !rule) {
      return NextResponse.json(
        { success: false, error: 'セグメントとルールデータが必要です' },
        { status: 400 }
      )
    }

    // TODO: 実際の更新処理

    console.log('検知ルールを更新:', segment, rule)

    return NextResponse.json({
      success: true,
      message: '検知ルールが更新されました',
      rule,
    })
  } catch (error) {
    console.error('検知ルール更新エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: '検知ルールの更新に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE: 検知ルールを削除
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const segment = searchParams.get('segment') as SegmentKey | null

    if (!segment) {
      return NextResponse.json(
        { success: false, error: 'セグメントが必要です' },
        { status: 400 }
      )
    }

    // TODO: 実際の削除処理

    console.log('検知ルールを削除:', segment)

    return NextResponse.json({
      success: true,
      message: '検知ルールが削除されました',
    })
  } catch (error) {
    console.error('検知ルール削除エラー:', error)
    return NextResponse.json(
      {
        success: false,
        error: '検知ルールの削除に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}


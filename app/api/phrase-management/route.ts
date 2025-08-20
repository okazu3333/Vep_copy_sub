import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    const { category, phrases, priority, delay, description } = await request.json()
    
    if (!category || !phrases || !Array.isArray(phrases)) {
      return NextResponse.json(
        { error: 'カテゴリとフレーズが必須です' },
        { status: 400 }
      )
    }

    console.log('📝 新規フレーズ追加:', { category, phrases, priority, delay })

    // フレーズロジックテーブルに追加
    const query = `
      INSERT INTO \`viewpers.salesguard_data.phrase_logic\`
      (category, phrases, priority, delay, description, created_at)
      VALUES (@category, @phrases, @priority, @delay, @description, @createdAt)
    `

    const params = {
      category,
      phrases: JSON.stringify(phrases),
      priority: priority || 'Medium',
      delay: delay || 1,
      description: description || '新規追加されたフレーズ',
      createdAt: new Date().toISOString()
    }

    await bigquery.query({ query, params })
    console.log('✅ フレーズロジック追加完了')

    return NextResponse.json({
      success: true,
      message: 'フレーズが正常に追加されました',
      data: { category, phrases, priority, delay, description }
    })

  } catch (error) {
    console.error('❌ フレーズ追加エラー:', error)
    return NextResponse.json(
      {
        error: 'フレーズ追加に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = `
      SELECT 
        category,
        phrases,
        priority,
        delay,
        description,
        created_at
      FROM \`viewpers.salesguard_data.phrase_logic\`
      WHERE 1=1
    `

    const params: any = {}

    if (category) {
      query += ' AND category = @category'
      params.category = category
    }

    query += ' ORDER BY created_at DESC'

    const [rows] = await bigquery.query({ query, params })

    // フレーズをJSONから配列に変換
    const formattedRows = rows.map((row: any) => ({
      ...row,
      phrases: JSON.parse(row.phrases)
    }))

    return NextResponse.json({
      success: true,
      data: formattedRows,
      total: formattedRows.length
    })

  } catch (error) {
    console.error('❌ フレーズロジック取得エラー:', error)
    return NextResponse.json(
      {
        error: 'フレーズロジックの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { category, phrases, priority, delay, description } = await request.json()
    
    if (!category) {
      return NextResponse.json(
        { error: 'カテゴリが必須です' },
        { status: 400 }
      )
    }

    console.log('🔄 フレーズ更新:', { category, phrases, priority, delay })

    const query = `
      UPDATE \`viewpers.salesguard_data.phrase_logic\`
      SET 
        phrases = @phrases,
        priority = @priority,
        delay = @delay,
        description = @description,
        updated_at = @updatedAt
      WHERE category = @category
    `

    const params = {
      category,
      phrases: JSON.stringify(phrases),
      priority: priority || 'Medium',
      delay: delay || 1,
      description: description || '更新されたフレーズ',
      updatedAt: new Date().toISOString()
    }

    await bigquery.query({ query, params })
    console.log('✅ フレーズ更新完了')

    return NextResponse.json({
      success: true,
      message: 'フレーズが正常に更新されました'
    })

  } catch (error) {
    console.error('❌ フレーズ更新エラー:', error)
    return NextResponse.json(
      {
        error: 'フレーズ更新に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    
    if (!category) {
      return NextResponse.json(
        { error: 'カテゴリが必須です' },
        { status: 400 }
      )
    }

    console.log('🗑️ フレーズ削除:', { category })

    const query = `
      DELETE FROM \`viewpers.salesguard_data.phrase_logic\`
      WHERE category = @category
    `

    const params = { category }

    await bigquery.query({ query, params })
    console.log('✅ フレーズ削除完了')

    return NextResponse.json({
      success: true,
      message: 'フレーズが正常に削除されました'
    })

  } catch (error) {
    console.error('❌ フレーズ削除エラー:', error)
    return NextResponse.json(
      {
        error: 'フレーズ削除に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
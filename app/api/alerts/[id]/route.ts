import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = params.id

    console.log(`🔍 アラート詳細取得: ${messageId}`)

    const query = `
      SELECT
        message_id,
        thread_id,
        decoded_sender,
        decoded_recipient,
        decoded_subject,
        decoded_snippet,
        message_body,
        created_at,
        status,
        priority,
        customer_name,
        customer_company,
        quality_score,
        encoding_type
      FROM \`viewpers.salesguard_data.japanese_decoded_emails\`
      WHERE message_id = @messageId
      LIMIT 1
    `

    const [rows] = await bigquery.query({
      query,
      params: { messageId }
    })

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'アラートが見つかりません' },
        { status: 404 }
      )
    }

    const alert = rows[0]

    console.log(`✅ アラート詳細取得完了: ${messageId}`)

    return NextResponse.json({
      success: true,
      data: alert
    })

  } catch (error) {
    console.error('❌ アラート詳細取得エラー:', error)
    return NextResponse.json(
      { 
        error: 'アラート詳細の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, assignee, notes, priority } = await request.json()
    const messageId = params.id

    console.log(`🔄 ステータス更新: ${messageId} -> ${status}`)

    // MERGE文でステータス更新
    const query = `
      MERGE \`viewpers.salesguard_data.alert_statuses\` AS target
      USING (
        SELECT 
          @messageId as message_id,
          @status as status,
          @assignee as assignee,
          @notes as notes,
          @priority as priority,
          CURRENT_TIMESTAMP() as updated_at
      ) AS source
      ON target.message_id = source.message_id
      WHEN MATCHED THEN
        UPDATE SET
          status = source.status,
          assignee = source.assignee,
          notes = source.notes,
          priority = source.priority,
          updated_at = source.updated_at
      WHEN NOT MATCHED THEN
        INSERT (message_id, status, assignee, notes, priority, updated_at)
        VALUES (source.message_id, source.status, source.assignee, source.notes, source.priority, source.updated_at)
    `

    await bigquery.query({
      query,
      params: {
        messageId,
        status: status || '未対応',
        assignee: assignee || null,
        notes: notes || null,
        priority: priority || 'medium'
      }
    })

    console.log(`✅ ステータス更新完了: ${messageId}`)

    return NextResponse.json({
      success: true,
      message: 'ステータスが更新されました',
      data: {
        message_id: messageId,
        status,
        assignee,
        notes,
        priority,
        updated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ ステータス更新エラー:', error)
    return NextResponse.json(
      { 
        error: 'ステータス更新に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
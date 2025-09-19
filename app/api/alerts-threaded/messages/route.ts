import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({ projectId: 'viewpers' })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('thread_id') || ''
    if (!threadId) {
      return NextResponse.json({ success: false, message: 'thread_id is required' }, { status: 400 })
    }

    const query = `
      SELECT
        message_id,
        subject,
        from_email AS \`from\`,
        ARRAY_TO_STRING(to_emails, ', ') AS \`to\`,
        body_preview AS body,
        date,
        reply_level,
        is_root,
        body_gcs_uri AS source_file
      FROM \`viewpers.salesguard_alerts.email_messages_threaded_v1\`
      WHERE thread_id = @thread_id
      ORDER BY reply_level ASC, date ASC
    `

    const [rows] = await bigquery.query({
      query,
      params: { thread_id: threadId },
      useLegacySql: false,
      maximumBytesBilled: '20000000000'
    })

    return NextResponse.json({ success: true, messages: rows })
  } catch (error: any) {
    console.error('Thread messages API error:', error)
    return NextResponse.json({ success: false, message: error.message || 'Failed to fetch messages' }, { status: 500 })
  }
} 
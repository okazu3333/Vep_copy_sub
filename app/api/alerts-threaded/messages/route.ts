import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = 'viewpers'
const BIGQUERY_LOCATION = 'asia-northeast1'

interface ThreadedMessageRow {
  message_id: string | null
  subject: string | null
  from: string | null
  to: string | null
  body_preview: string | null
  datetime: string | null
  reply_level: number | null
  is_root: boolean | null
  source_uri: string | null
  in_reply_to: string | null
  thread_id: string | null
  sentiment_label: string | null
  sentiment_score: number | null
  negative_flag: boolean | null
}

const bigquery = new BigQuery({ projectId: PROJECT_ID, location: BIGQUERY_LOCATION })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const threadIdParam = searchParams.get('thread_id') || ''
    const modeParam = (searchParams.get('mode') || 'fast').toLowerCase() as 'fast' | 'full'
    const messageIdParam = searchParams.get('message_id') || ''
    const idParam = searchParams.get('id') || ''
    // Remove date parameters since data is fixed to 2025/7/7-7/14
    // const start = searchParams.get('start') || ''
    // const end = searchParams.get('end') || ''

    if (!threadIdParam && !messageIdParam && !idParam) {
      return NextResponse.json({ success: false, message: 'thread_id or message_id or id is required' }, { status: 400 })
    }

    // Remove date validation since data is fixed
    // if (!start || !end) {
    //   return NextResponse.json({ success: false, message: 'start and end query parameters are required' }, { status: 400 })
    // }

    let resolvedThreadId = threadIdParam

    // If no thread_id provided, try to resolve from message_id or id
    if (!resolvedThreadId && (messageIdParam || idParam)) {
      const lookupId = messageIdParam || idParam
      console.log(`Resolving thread_id for message_id/id: ${lookupId}`)

      const threadResolveQuery = `
        SELECT thread_id
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE message_id = @lookup_id
        LIMIT 1
      `

      try {
        const [threadRows] = await bigquery.query({
          query: threadResolveQuery,
          params: { lookup_id: lookupId },
          useLegacySql: false,
          location: BIGQUERY_LOCATION,
          maximumBytesBilled: '1000000000' // 1GB limit
        })

        if (threadRows.length > 0) {
          resolvedThreadId = threadRows[0].thread_id
          console.log(`Resolved thread_id: ${resolvedThreadId}`)
        }
      } catch (resolveError) {
        console.error('Thread resolve error:', resolveError)
      }
    }

    // If still no thread_id, return single message fallback
    if (!resolvedThreadId) {
      const fallbackId = messageIdParam || idParam
      console.log(`No thread_id found, returning single message for: ${fallbackId}`)

      const singleMessageQuery = `
        SELECT
          message_id,
          subject,
          \`from\`,
          \`to\`,
          body_preview,
          datetime,
          reply_level,
          is_root,
          source_uri,
          in_reply_to,
          thread_id,
          sentiment_label,
          sentiment_score,
          negative_flag
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE message_id = @fallback_id
        LIMIT 1
      `

      const [singleRows] = await bigquery.query({
        query: singleMessageQuery,
        params: { fallback_id: fallbackId },
        useLegacySql: false,
        location: BIGQUERY_LOCATION,
        maximumBytesBilled: '1000000000' // 1GB limit
      })

      if (singleRows.length === 0) {
        return NextResponse.json({ success: false, message: 'Message not found' }, { status: 404 })
      }

      const row = singleRows[0] as ThreadedMessageRow
      const message = {
        message_id: row.message_id,
        subject: row.subject,
        from: row.from,
        to: row.to,
        body_preview: row.body_preview,
        body_gcs_uri: row.source_uri,
        date: row.datetime,
        reply_level: row.reply_level,
        is_root: row.is_root,
        in_reply_to: row.in_reply_to,
        references: null,
        sentiment_label: row.sentiment_label,
        sentiment_score: row.sentiment_score,
        negative_flag: row.negative_flag
      }

      const response = NextResponse.json({
        success: true,
        messages: [message],
        thread_id: row.thread_id,
        total_messages: 1,
        mode: modeParam
      })

      response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120')
      response.headers.set('CDN-Cache-Control', 'public, max-age=120')
      response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=120')

      return response
    }

    // Main thread query
    let query: string
    const params: Record<string, any> = { thread_id: resolvedThreadId }

    if (modeParam === 'full') {
      // Full mode: get all messages in thread with complete data
      query = `
        SELECT
          message_id,
          subject,
          \`from\`,
          \`to\`,
          body_preview,
          datetime,
          reply_level,
          is_root,
          source_uri,
          in_reply_to,
          thread_id,
          sentiment_label,
          sentiment_score,
          negative_flag
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE thread_id = @thread_id
        ORDER BY reply_level ASC, datetime ASC
      `
    } else {
      // Fast mode: get limited messages for quick preview
      query = `
        SELECT
          message_id,
          subject,
          \`from\`,
          \`to\`,
          LEFT(body_preview, 200) as body_preview,
          datetime,
          reply_level,
          is_root,
          source_uri,
          in_reply_to,
          thread_id,
          sentiment_label,
          sentiment_score,
          negative_flag
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE thread_id = @thread_id
        ORDER BY reply_level ASC, datetime ASC
        LIMIT 10
      `
    }

    console.log(`threaded messages query (${modeParam}):`, { thread_id: resolvedThreadId })

    const [rows] = await bigquery.query({
      query,
      params,
      useLegacySql: false,
      location: BIGQUERY_LOCATION,
      maximumBytesBilled: modeParam === 'full' ? '5000000000' : '2000000000' // 5GB for full, 2GB for fast
    })

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, message: 'No messages found for thread' }, { status: 404 })
    }

    // Transform results
    const messages = rows.map((row: ThreadedMessageRow) => ({
      message_id: row.message_id,
      subject: row.subject,
      from: row.from,
      to: row.to,
      body_preview: row.body_preview,
      body_gcs_uri: row.source_uri,
      date: row.datetime,
      reply_level: row.reply_level,
      is_root: row.is_root,
      in_reply_to: row.in_reply_to,
      references: null, // Not available in unified table
      sentiment_label: row.sentiment_label,
      sentiment_score: row.sentiment_score,
      negative_flag: row.negative_flag
    }))

    const response = NextResponse.json({
      success: true,
      messages,
      thread_id: resolvedThreadId,
      total_messages: messages.length,
      mode: modeParam
    })

    // Set cache headers
    response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120')
    response.headers.set('CDN-Cache-Control', 'public, max-age=120')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=120')

    return response

  } catch (error: any) {
    console.error('Thread messages API error:', { message: error?.message, url: request?.url })
    return NextResponse.json({ success: false, message: error.message || 'Failed to fetch thread messages' }, { status: 500 })
  }
}

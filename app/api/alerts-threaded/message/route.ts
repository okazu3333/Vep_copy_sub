import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = process.env.GCP_PROJECT_ID
  || process.env.GOOGLE_CLOUD_PROJECT
  || process.env.PROJECT_ID
  || 'viewpers'
const BIGQUERY_LOCATION = process.env.BIGQUERY_LOCATION || 'asia-northeast1'
const ALERT_VIEW = '`viewpers.salesguard_alerts.alerts_v2_compat_unified`'

const bigquery = new BigQuery({ projectId: PROJECT_ID, location: BIGQUERY_LOCATION })

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id') || ''
    if (!messageId) {
      return NextResponse.json({ success: false, message: 'message_id is required' }, { status: 400 })
    }

    const query = `
      SELECT
        s.message_id,
        s.description AS subject,
        s.person AS \`from\`,
        '' AS \`to\`,
        s.messageBody AS body_preview,
        s.source_file AS body_gcs_uri,
        s.datetime AS date,
        s.reply_level,
        s.is_root,
        n.in_reply_to,
        n.references
      FROM ${ALERT_VIEW} s
      LEFT JOIN \`viewpers.salesguard_alerts.email_messages_normalized\` n
        ON n.message_id = s.message_id
      WHERE s.message_id = @message_id
      LIMIT 1
    `

    const [rows] = await bigquery.query({
      query,
      params: { message_id: messageId },
      useLegacySql: false,
      maximumBytesBilled: '200000000'
    })

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, message: 'message not found' }, { status: 404 })
    }

    const r: any = rows[0]
    const response = NextResponse.json({
      success: true,
      message: {
        message_id: r.message_id,
        subject: r.subject,
        from: r.from,
        to: r.to,
        body_preview: r.body_preview,
        body_gcs_uri: r.body_gcs_uri,
        date: r.date,
        reply_level: r.reply_level,
        is_root: r.is_root,
        in_reply_to: r.in_reply_to,
        references: r.references,
      }
    })

    response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120')
    response.headers.set('CDN-Cache-Control', 'public, max-age=120')
    response.headers.set('Vercel-CDN-Cache-Control', 'public, max-age=120')

    return response
  } catch (error: any) {
    console.error('Single message API error:', { message: error?.message, url: request?.url })
    return NextResponse.json({ success: false, message: error.message || 'Failed to fetch message' }, { status: 500 })
  }
} 

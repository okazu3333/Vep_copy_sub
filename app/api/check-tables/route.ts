import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    const results: any = {}
    
    // 1. alertsテーブルの確認
    try {
      const alertsQuery = `SELECT COUNT(*) as count FROM \`viewpers.salesguard_alerts.alerts\``
      const alertsResult = await bigquery.query({
        query: alertsQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
      results.alerts = {
        exists: true,
        count: alertsResult[0]?.[0]?.count || 0
      }
    } catch (error) {
      results.alerts = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // 2. alerts_v2テーブルの確認
    try {
      const alertsV2Query = `SELECT COUNT(*) as count FROM \`viewpers.salesguard_alerts.alerts_v2\``
      const alertsV2Result = await bigquery.query({
        query: alertsV2Query,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
      results.alerts_v2 = {
        exists: true,
        count: alertsV2Result[0]?.[0]?.count || 0
      }
    } catch (error) {
      results.alerts_v2 = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // 3. email_messagesテーブルの確認
    try {
      const emailMessagesQuery = `SELECT COUNT(*) as count FROM \`viewpers.salesguard_alerts.email_messages\``
      const emailMessagesResult = await bigquery.query({
        query: emailMessagesQuery,
        useLegacySql: false,
        maximumBytesBilled: '1000000000'
      })
      results.email_messages = {
        exists: true,
        count: emailMessagesResult[0]?.[0]?.count || 0
      }
    } catch (error) {
      results.email_messages = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error) {
    console.error('Check tables API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check tables' },
      { status: 500 }
    )
  }
} 
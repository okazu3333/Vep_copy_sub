import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 テーブル構造確認開始')

    const results: any = {}

    // email_messagesテーブルの確認
    try {
      const [rows] = await bigquery.query({
        query: 'SELECT * FROM `viewpers.salesguard_alerts.email_messages` LIMIT 1'
      })
      
      if (rows.length > 0) {
        const row = rows[0]
        results.email_messages = {
          success: true,
          fields: Object.keys(row),
          sample: row
        }
      } else {
        results.email_messages = {
          success: true,
          message: 'テーブルは空です'
        }
      }
    } catch (error) {
      results.email_messages = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // alerts_clean_v7_dedupテーブルの確認
    try {
      const [rows] = await bigquery.query({
        query: 'SELECT * FROM `viewpers.salesguard_alerts.alerts_clean_v7_dedup` LIMIT 1'
      })
      
      if (rows.length > 0) {
        const row = rows[0]
        results.alerts_clean = {
          success: true,
          fields: Object.keys(row),
          sample: row
        }
      } else {
        results.alerts_clean = {
          success: true,
          message: 'テーブルは空です'
        }
      }
    } catch (error) {
      results.alerts_clean = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      message: 'テーブル構造確認が完了しました',
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('テーブル構造確認エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'テーブル構造確認中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
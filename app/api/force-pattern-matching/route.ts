import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'
import { PatternMatcherV2 } from '@/lib/pattern-matcher-v2'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 パターンマッチング強制実行開始...')

    const { action, limit = 50 } = await request.json()

    if (action === 'force_pattern_matching') {
      return await forcePatternMatching(limit)
    } else if (action === 'check_pattern_status') {
      return await checkPatternStatus()
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use force_pattern_matching or check_pattern_status'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ パターンマッチング強制実行エラー:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to force pattern matching',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function forcePatternMatching(limit: number) {
  try {
    console.log(`🔧 ${limit}件のパターンマッチング強制実行開始...`)

    // 日本語NLP分析結果を取得（パターンマッチング結果なし）
    const nlpQuery = `
      SELECT 
        message_id,
        thread_id,
        sender_email,
        subject,
        body,
        date,
        japanese_nlp_analysis,
        analysis_timestamp
      FROM \`viewpers.salesguard_alerts.japanese_nlp_analysis_results\`
      WHERE (pattern_matches_count = 0 OR pattern_matches_count IS NULL)
      ORDER BY analysis_timestamp DESC
      LIMIT ${limit}
    `

    const [nlpResults] = await bigquery.query({ query: nlpQuery, useLegacySql: false })
    console.log(`📊 対象データ: ${nlpResults?.length || 0}件`)

    if (!nlpResults || nlpResults.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'パターンマッチング対象のデータがありません',
        processed: 0
      })
    }

    let processed = 0
    let updated = 0

    for (const nlpResult of nlpResults) {
      try {
        // パターンマッチングを実行（sentimentフィールドなし）
        const patternMatches = PatternMatcherV2.matchPatterns(
          nlpResult.subject || '',
          nlpResult.body || '',
          {
            message_id: nlpResult.message_id,
            thread_id: nlpResult.thread_id,
            subject: nlpResult.subject || '',
            body: nlpResult.body || '',
            sentiment: {
              score: 0, // 感情分析結果がない場合は0
              magnitude: 0,
              label: 'NEUTRAL'
            },
            entities: nlpResult.japanese_nlp_analysis?.entities || [],
            categories: nlpResult.japanese_nlp_analysis?.categories || [],
            syntax: {
              sentences: 1,
              tokens: (nlpResult.body || '').length,
              avg_sentence_length: (nlpResult.body || '').length
            },
            analysis_timestamp: nlpResult.analysis_timestamp
          }
        )

        // 結果をBigQueryに更新（INSERTで代替）
        if (patternMatches.length > 0) {
          // UPDATEが動作しない場合は、新しいレコードとして挿入
          const insertQuery = `
            INSERT INTO \`viewpers.salesguard_alerts.japanese_nlp_analysis_results\`
            (message_id, thread_id, sender_email, subject, body, date, japanese_nlp_analysis, pattern_matches, pattern_matches_count, analysis_timestamp)
            VALUES (@message_id, @thread_id, @sender_email, @subject, @body, @date, @japanese_nlp_analysis, @pattern_matches, @pattern_matches_count, @analysis_timestamp)
          `

          await bigquery.query({
            query: insertQuery,
            params: {
              message_id: nlpResult.message_id,
              thread_id: nlpResult.thread_id,
              sender_email: nlpResult.sender_email,
              subject: nlpResult.subject,
              body: nlpResult.body,
              date: nlpResult.date,
              japanese_nlp_analysis: JSON.stringify(nlpResult.japanese_nlp_analysis),
              pattern_matches: JSON.stringify(patternMatches),
              pattern_matches_count: patternMatches.length,
              analysis_timestamp: nlpResult.analysis_timestamp
            },
            useLegacySql: false
          })

          updated++
          console.log(`✅ パターンマッチング更新: ${nlpResult.message_id} (${patternMatches.length}件)`)
        }

        processed++

        if (processed % 10 === 0) {
          console.log(`📊 進行状況: ${processed}/${nlpResults.length}件`)
        }

      } catch (error) {
        console.error(`❌ パターンマッチングエラー (${nlpResult.message_id}):`, error)
      }
    }

    console.log(`✅ パターンマッチング強制実行完了: ${processed}件処理, ${updated}件更新`)

    return NextResponse.json({
      success: true,
      processed: processed,
      updated: updated,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ パターンマッチング強制実行処理エラー:', error)
    throw error
  }
}

async function checkPatternStatus() {
  try {
    console.log('📊 パターンマッチング状況確認開始...')

    // パターンマッチング状況を確認
    const statusQuery = `
      SELECT 
        CASE 
          WHEN pattern_matches_count > 0 THEN 'matched'
          WHEN pattern_matches_count = 0 THEN 'unmatched'
          ELSE 'unknown'
        END as status,
        COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.japanese_nlp_analysis_results\`
      GROUP BY status
      ORDER BY status
    `

    const [statusResults] = await bigquery.query({ query: statusQuery, useLegacySql: false })

    // サンプルデータも取得
    const sampleQuery = `
      SELECT 
        message_id,
        subject,
        pattern_matches_count
      FROM \`viewpers.salesguard_alerts.japanese_nlp_analysis_results\`
      WHERE pattern_matches_count > 0
      ORDER BY analysis_timestamp DESC
      LIMIT 5
    `

    const [sampleResults] = await bigquery.query({ query: sampleQuery, useLegacySql: false })

    return NextResponse.json({
      success: true,
      status: statusResults || [],
      sample_matched: sampleResults || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ パターンマッチング状況確認エラー:', error)
    throw error
  }
} 
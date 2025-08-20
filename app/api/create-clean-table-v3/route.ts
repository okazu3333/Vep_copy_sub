import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 ワークフロー承認依頼データ除外版クリーンテーブル作成開始')

    // ワークフロー承認依頼データを除外したクリーンテーブルを作成
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.alerts_clean_v3\` AS
      SELECT 
        thread_id,
        message_id,
        subject,
        \`from\`,
        \`to\`,
        body,
        date,
        reply_level,
        is_root,
        source_file,
        -- アラート関連フィールド
        ROW_NUMBER() OVER (ORDER BY MIN(date)) as alert_id,
        'キーワード未設定' as detected_keyword,
        '中' as priority,
        '新規' as status,
        50 as score,
        '営業部' as department,
        COALESCE(\`to\`, 'customer@example.com') as customer_email
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE (
        -- 既存の除外条件
        -- 1. 文字化けデータ
        body NOT LIKE '%?%' AND
        body NOT LIKE '%$B%' AND
        
        -- 2. 配信管理システム
        \`from\` NOT LIKE '%md_sys_admin@%' AND
        
        -- 3. 自動メール
        \`from\` NOT LIKE '%info@%' AND
        \`from\` NOT LIKE '%noreply@%' AND
        \`from\` NOT LIKE '%support@%' AND
        \`from\` NOT LIKE '%magazine@%' AND
        \`from\` NOT LIKE '%learn@%' AND
        
        -- 4. システムメール
        \`from\` NOT LIKE '%root@%' AND
        \`from\` NOT LIKE '%kintai@%' AND
        
        -- 5. 外部サービス
        \`from\` NOT LIKE '%facebookmail.com%' AND
        \`from\` NOT LIKE '%ns.chatwork.com%' AND
        
        -- 6. ワークフロー承認依頼関連（新規追加）
        subject NOT LIKE '%ワークフロー%' AND
        subject NOT LIKE '%承認%' AND
        subject NOT LIKE '%依頼%' AND
        body NOT LIKE '%ワークフロー%' AND
        body NOT LIKE '%承認%' AND
        body NOT LIKE '%依頼%' AND
        
        -- 7. 特定のワークフロー関連件名パターン
        subject NOT LIKE '%RSS%' AND
        subject NOT LIKE '%DAG%' AND
        subject NOT LIKE '%ASSUM%' AND
        subject NOT LIKE '%配信管理システム%' AND
        
        -- 8. 特定の送信者ドメイン
        \`from\` NOT LIKE '%freee.co.jp%' AND
        \`from\` NOT LIKE '%asana.com%' AND
        \`from\` NOT LIKE '%qiqumo.jp%'
      )
      GROUP BY thread_id, message_id, subject, \`from\`, \`to\`, body, date, reply_level, is_root, source_file
    `

    const result = await bigquery.query({
      query: createTableQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // 作成されたテーブルの件数を確認
    const countQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.alerts_clean_v3\`
    `

    const countResult = await bigquery.query({
      query: countQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const recordCount = countResult[0]?.[0]?.count || 0

    // 除外された件数も確認
    const excludedCountQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.email_messages\`
      WHERE (
        body LIKE '%?%' OR
        body LIKE '%$B%' OR
        \`from\` LIKE '%md_sys_admin@%' OR
        \`from\` LIKE '%info@%' OR
        \`from\` NOT LIKE '%noreply@%' OR
        \`from\` LIKE '%support@%' OR
        \`from\` LIKE '%magazine@%' OR
        \`from\` LIKE '%learn@%' OR
        \`from\` LIKE '%root@%' OR
        \`from\` LIKE '%kintai@%' OR
        \`from\` LIKE '%facebookmail.com%' OR
        \`from\` LIKE '%ns.chatwork.com%' OR
        subject LIKE '%ワークフロー%' OR
        subject LIKE '%承認%' OR
        subject LIKE '%依頼%' OR
        body LIKE '%ワークフロー%' OR
        body LIKE '%承認%' OR
        body LIKE '%依頼%' OR
        subject LIKE '%RSS%' OR
        subject LIKE '%DAG%' OR
        subject LIKE '%ASSUM%' OR
        subject LIKE '%配信管理システム%' OR
        \`from\` LIKE '%freee.co.jp%' OR
        \`from\` LIKE '%asana.com%' OR
        \`from\` LIKE '%qiqumo.jp%'
      )
    `

    const excludedResult = await bigquery.query({
      query: excludedCountQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const excludedCount = excludedResult[0]?.[0]?.count || 0

    return NextResponse.json({
      success: true,
      message: 'ワークフロー承認依頼データ除外版クリーンテーブルが正常に作成されました',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_v3',
      recordCount: recordCount,
      excludedRecords: excludedCount,
      originalRecords: 1721,
      exclusionPercentage: Math.round((excludedCount / 1721) * 100),
      excludedConditions: [
        'body LIKE %?% (文字化けデータ)',
        'body LIKE %$B% (文字化けデータ)',
        'from LIKE %md_sys_admin@% (配信管理システム)',
        'from LIKE %info@% (自動メール)',
        'from LIKE %noreply@% (自動メール)',
        'from LIKE %support@% (自動メール)',
        'from LIKE %magazine@% (自動メール)',
        'from LIKE %learn@% (自動メール)',
        'from LIKE %root@% (システムメール)',
        'from LIKE %kintai@% (システムメール)',
        'from LIKE %facebookmail.com% (外部サービス)',
        'from LIKE %ns.chatwork.com% (外部サービス)',
        'subject/body LIKE %ワークフロー% (ワークフロー関連)',
        'subject/body LIKE %承認% (承認関連)',
        'subject/body LIKE %依頼% (依頼関連)',
        'subject LIKE %RSS% (RSS関連)',
        'subject LIKE %DAG% (DAG関連)',
        'subject LIKE %ASSUM% (ASSUM関連)',
        'subject LIKE %配信管理システム% (配信管理)',
        'from LIKE %freee.co.jp% (freee会計)',
        'from LIKE %asana.com% (Asana)',
        'from LIKE %qiqumo.jp% (QiQUMO)'
      ]
    })

  } catch (error) {
    console.error('Clean table creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create clean table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 
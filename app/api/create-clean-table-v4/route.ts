import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 広告・プロモーション系メール除外版クリーンテーブル作成開始')

    // 広告・プロモーション系メールも除外したクリーンテーブルを作成
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.alerts_clean_v4\` AS
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
        
        -- 6. ワークフロー承認依頼関連
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
        \`from\` NOT LIKE '%qiqumo.jp%' AND
        
        -- 9. 広告・プロモーション系メール（新規追加）
        subject NOT LIKE '%注目%' AND
        subject NOT LIKE '%ゲーム%' AND
        subject NOT LIKE '%メダル%' AND
        subject NOT LIKE '%ポイント%' AND
        subject NOT LIKE '%dジョブ%' AND
        subject NOT LIKE '%スマホワーク%' AND
        subject NOT LIKE '%広告%' AND
        subject NOT LIKE '%プロモーション%' AND
        subject NOT LIKE '%キャンペーン%' AND
        subject NOT LIKE '%セール%' AND
        subject NOT LIKE '%割引%' AND
        subject NOT LIKE '%無料%' AND
        subject NOT LIKE '%限定%' AND
        subject NOT LIKE '%お得%' AND
        subject NOT LIKE '%特典%' AND
        
        -- 10. 特定の広告・プロモーション送信者ドメイン
        \`from\` NOT LIKE '%fruitmail.net%' AND
        \`from\` NOT LIKE '%gendama.jp%' AND
        \`from\` NOT LIKE '%chobirich.com%' AND
        \`from\` NOT LIKE '%bizocean.jp%' AND
        \`from\` NOT LIKE '%msandc.co.jp%' AND
        \`from\` NOT LIKE '%line.me%'
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
      FROM \`viewpers.salesguard_alerts.alerts_clean_v4\`
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
        \`from\` LIKE '%noreply@%' OR
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
        \`from\` LIKE '%qiqumo.jp%' OR
        subject LIKE '%注目%' OR
        subject LIKE '%ゲーム%' OR
        subject LIKE '%メダル%' OR
        subject LIKE '%ポイント%' OR
        subject LIKE '%dジョブ%' OR
        subject LIKE '%スマホワーク%' OR
        subject LIKE '%広告%' OR
        subject LIKE '%プロモーション%' OR
        subject LIKE '%キャンペーン%' OR
        subject LIKE '%セール%' OR
        subject LIKE '%割引%' OR
        subject LIKE '%無料%' OR
        subject LIKE '%限定%' OR
        subject LIKE '%お得%' OR
        subject LIKE '%特典%' OR
        \`from\` LIKE '%fruitmail.net%' OR
        \`from\` LIKE '%gendama.jp%' OR
        \`from\` LIKE '%chobirich.com%' OR
        \`from\` LIKE '%bizocean.jp%' OR
        \`from\` LIKE '%msandc.co.jp%' OR
        \`from\` LIKE '%line.me%'
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
      message: '広告・プロモーション系メール除外版クリーンテーブルが正常に作成されました',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_v4',
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
        'from LIKE %qiqumo.jp% (QiQUMO)',
        'subject LIKE %注目% (広告・プロモーション)',
        'subject LIKE %ゲーム% (広告・プロモーション)',
        'subject LIKE %メダル% (広告・プロモーション)',
        'subject LIKE %ポイント% (広告・プロモーション)',
        'subject LIKE %dジョブ% (広告・プロモーション)',
        'subject LIKE %スマホワーク% (広告・プロモーション)',
        'subject LIKE %広告% (広告・プロモーション)',
        'subject LIKE %プロモーション% (広告・プロモーション)',
        'subject LIKE %キャンペーン% (広告・プロモーション)',
        'subject LIKE %セール% (広告・プロモーション)',
        'subject LIKE %割引% (広告・プロモーション)',
        'subject LIKE %無料% (広告・プロモーション)',
        'subject LIKE %限定% (広告・プロモーション)',
        'subject LIKE %お得% (広告・プロモーション)',
        'subject LIKE %特典% (広告・プロモーション)',
        'from LIKE %fruitmail.net% (フルーツメール)',
        'from LIKE %gendama.jp% (げん玉)',
        'from LIKE %chobirich.com% (ちょびリッチ)',
        'from LIKE %bizocean.jp% (bizocean)',
        'from LIKE %msandc.co.jp% (MS&Consulting)',
        'from LIKE %line.me% (LINE)'
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
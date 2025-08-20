import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery()

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 スレッド重複問題修正版クリーンテーブル作成開始')

    // 転送サービス経由の重複メッセージを適切に処理したクリーンテーブルを作成
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.alerts_clean_v7\` AS
      SELECT 
        thread_id,
        message_id,
        subject,
        \`from\`,
        improved_to as \`to\`,
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
        improved_customer_email as customer_email,
        -- スレッド表示用の追加フィールド
        CASE 
          WHEN improved_to LIKE '%ml.cross-m.co.jp%' THEN true
          ELSE false
        END as is_forwarding_service,
        -- 転送サービス経由の場合の本来の宛先
        CASE 
          WHEN improved_to LIKE '%ml.cross-m.co.jp%' AND body LIKE '%To:%' THEN
            COALESCE(
              REGEXP_EXTRACT(body, r'To:\s*([^\\r\\n]+)'),
              REGEXP_EXTRACT(body, r'宛先:\s*([^\\r\\n]+)'),
              REGEXP_EXTRACT(body, r'送信先:\s*([^\\r\\n]+)'),
              'customer@example.com'
            )
          WHEN improved_to LIKE '%ml.cross-m.co.jp%' AND body LIKE '%for <%' THEN
            COALESCE(
              REGEXP_EXTRACT(body, r'for\s+<([^>]+)>'),
              'customer@example.com'
            )
          ELSE 'customer@example.com'
        END as original_recipient,
        -- 重複除去用のハッシュ
        MD5(CONCAT(thread_id, '|', subject, '|', \`from\`, '|', SUBSTRING(body, 1, 100))) as message_hash
      FROM (
        SELECT 
          thread_id,
          message_id,
          subject,
          \`from\`,
          -- 転送サービス問題を改善したTo情報
          CASE 
            -- 転送サービス経由の場合、本文から本来のTo情報を抽出
            WHEN \`to\` LIKE '%ml.cross-m.co.jp%' AND body LIKE '%To:%' THEN
              COALESCE(
                REGEXP_EXTRACT(body, r'To:\s*([^\\r\\n]+)'),
                REGEXP_EXTRACT(body, r'宛先:\s*([^\\r\\n]+)'),
                REGEXP_EXTRACT(body, r'送信先:\s*([^\\r\\n]+)'),
                \`to\`
              )
            -- 転送サービス経由の場合、本文から本来のTo情報を抽出（別パターン）
            WHEN \`to\` LIKE '%ml.cross-m.co.jp%' AND body LIKE '%for <%' THEN
              COALESCE(
                REGEXP_EXTRACT(body, r'for\s+<([^>]+)>'),
                \`to\`
              )
            -- その他の場合は通常のTo情報を使用
            ELSE \`to\`
          END as improved_to,
          -- 改善された顧客メールアドレス
          CASE 
            WHEN \`to\` LIKE '%ml.cross-m.co.jp%' AND body LIKE '%To:%' THEN
              COALESCE(
                REGEXP_EXTRACT(body, r'To:\s*([^\\r\\n]+)'),
                REGEXP_EXTRACT(body, r'宛先:\s*([^\\r\\n]+)'),
                REGEXP_EXTRACT(body, r'送信先:\s*([^\\r\\n]+)'),
                'customer@example.com'
              )
            WHEN \`to\` LIKE '%ml.cross-m.co.jp%' AND body LIKE '%for <%' THEN
              COALESCE(
                REGEXP_EXTRACT(body, r'for\s+<([^>]+)>'),
                'customer@example.com'
              )
            ELSE COALESCE(\`to\`, 'customer@example.com')
          END as improved_customer_email,
          body,
          date,
          reply_level,
          is_root,
          source_file
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
          
          -- 9. 広告・プロモーション系メール
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
      ) improved_data
      GROUP BY thread_id, message_id, subject, \`from\`, improved_to, body, date, reply_level, is_root, source_file, improved_customer_email
    `

    const result = await bigquery.query({
      query: createTableQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // 重複除去後のテーブルを作成
    const deduplicateQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\` AS
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
        alert_id,
        detected_keyword,
        priority,
        status,
        score,
        department,
        customer_email,
        is_forwarding_service,
        original_recipient,
        message_hash
      FROM (
        SELECT 
          *,
          ROW_NUMBER() OVER (
            PARTITION BY message_hash 
            ORDER BY date ASC, message_id ASC
          ) as rn
        FROM \`viewpers.salesguard_alerts.alerts_clean_v7\`
      )
      WHERE rn = 1
    `

    const dedupResult = await bigquery.query({
      query: deduplicateQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    // 重複除去後のテーブルの件数を確認
    const countQuery = `
      SELECT COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
    `

    const countResult = await bigquery.query({
      query: countQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const recordCount = countResult[0]?.[0]?.count || 0

    // 重複除去の効果を確認
    const dedupEffectQuery = `
      SELECT 
        COUNT(DISTINCT thread_id) as unique_threads,
        COUNT(*) as total_messages,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT thread_id), 2) as avg_messages_per_thread
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
    `

    const dedupEffectResult = await bigquery.query({
      query: dedupEffectQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    const dedupData = dedupEffectResult[0]?.[0] || {}

    // 元のテーブルとの比較
    const comparisonQuery = `
      SELECT 
        'Before Deduplication' as status,
        COUNT(DISTINCT thread_id) as unique_threads,
        COUNT(*) as total_messages,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT thread_id), 2) as avg_messages_per_thread
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7\`
      UNION ALL
      SELECT 
        'After Deduplication' as status,
        COUNT(DISTINCT thread_id) as unique_threads,
        COUNT(*) as total_messages,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT thread_id), 2) as avg_messages_per_thread
      FROM \`viewpers.salesguard_alerts.alerts_clean_v7_dedup\`
    `

    const comparisonResult = await bigquery.query({
      query: comparisonQuery,
      useLegacySql: false,
      maximumBytesBilled: '1000000000'
    })

    return NextResponse.json({
      success: true,
      message: 'スレッド重複問題修正版クリーンテーブルが正常に作成されました',
      tableName: 'viewpers.salesguard_alerts.alerts_clean_v7_dedup',
      recordCount: recordCount,
      originalRecords: 1721,
      deduplicationEffect: {
        uniqueThreads: dedupData.unique_threads || 0,
        totalMessages: dedupData.total_messages || 0,
        avgMessagesPerThread: dedupData.avg_messages_per_thread || 0
      },
      comparison: comparisonResult[0] || [],
      improvementFeatures: [
        '転送サービス経由メールの本来のTo情報抽出',
        '本文からの宛先情報復元',
        '顧客メールアドレスの正確性向上',
        '営業関連メールの品質向上',
        'スレッド表示の改善',
        '転送サービス経由重複メッセージの適切な処理',
        '重複メッセージの完全除去',
        'スレッド件数とメッセージ件数の整合性確保'
      ],
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
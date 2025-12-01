#!/usr/bin/env tsx
/**
 * 検知ルール結果をアラートとしてBigQueryに保存するバッチ処理
 * 
 * 実行方法:
 *   npx tsx scripts/sync_detection_alerts.ts
 * 
 * または:
 *   npm run sync-detection-alerts
 */

import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: 'viewpers' });
const DATASET = 'viewpers.salesguard_alerts';

/**
 * 検知ルール結果を取得してアラートテーブルに保存
 */
async function syncDetectionAlerts() {
  console.log('🔄 検知ルール結果の同期を開始...');

  try {
    // 検知ルール結果を取得
    const detectionQuery = `
      -- 72時間放置検知
      WITH inactivity_72h AS (
        SELECT 
          CONCAT('DR-', CAST(FARM_FINGERPRINT(thread_id) AS STRING), '-72h') AS alert_id,
          thread_id,
          MAX(message_id) AS message_id,
          'detection_rule' AS detection_source,
          'inactivity_72h' AS rule_type,
          MAX(datetime) AS detected_at,
          LEAST(100, (TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(datetime), HOUR) - 72) / 24.0 * 20 + 50) AS score,
          CASE 
            WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(datetime), HOUR) >= 168 THEN 'A'
            WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(datetime), HOUR) >= 120 THEN 'B'
            ELSE 'C'
          END AS severity,
          STRUCT(
            TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(datetime), HOUR) AS hours_since_last_activity,
            ANY_VALUE(company_domain) AS company_domain,
            ANY_VALUE(\`from\`) AS sender
          ) AS details,
          '顧客からの問い合わせに対して速やかに返信する' AS recommended_action,
          'forecast_inactive' AS segment
        FROM \`${DATASET}.unified_email_messages\`
        WHERE direction = 'inbound'
        GROUP BY thread_id
        HAVING TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(datetime), HOUR) >= 72
      ),
      -- 感情ダウン + 催促ワード検知
      sentiment_urgency AS (
        SELECT 
          CONCAT('DR-', CAST(FARM_FINGERPRINT(thread_id) AS STRING), '-urg') AS alert_id,
          thread_id,
          message_id,
          'detection_rule' AS detection_source,
          'sentiment_urgency' AS rule_type,
          datetime AS detected_at,
          LEAST(100, (ABS(sentiment_score) * 30) + (urgency_word_count * 20) + 30) AS score,
          CASE 
            WHEN sentiment_score < -0.6 AND urgency_word_count >= 2 THEN 'A'
            WHEN sentiment_score < -0.3 AND urgency_word_count >= 1 THEN 'B'
            ELSE 'C'
          END AS severity,
          STRUCT(
            sentiment_score AS sentiment_score,
            urgency_word_count AS urgency_word_count,
            subject AS subject,
            body_preview AS body_preview,
            \`from\` AS sender,
            company_domain AS company_domain
          ) AS details,
          '不安傾向にあるので、不安解消フォロー' AS recommended_action,
          'occurrence_followup' AS segment
        FROM (
          SELECT 
            thread_id,
            message_id,
            subject,
            body_preview,
            sentiment_score,
            datetime,
            \`from\`,
            company_domain,
            (
              SELECT COUNT(*)
              FROM UNNEST(['進捗いかが', '進捗いかがでしょうか', 'お返事いただけますでしょうか', '確認させていただきたいのですが', 'まだですか', '対応して', '返事がない', 'お待ちしています', 'ご確認ください', '至急', '急ぎ']) AS keyword
              WHERE CONCAT(COALESCE(subject, ''), ' ', COALESCE(body_preview, '')) LIKE CONCAT('%', keyword, '%')
            ) AS urgency_word_count
          FROM \`${DATASET}.unified_email_messages\`
          WHERE direction = 'inbound'
            AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
            AND sentiment_score < -0.3
        )
        WHERE urgency_word_count > 0
      ),
      -- トーンダウン + 返信頻度変化検知
      tone_frequency_drop AS (
        SELECT 
          CONCAT('DR-', CAST(FARM_FINGERPRINT(thread_id) AS STRING), '-tone') AS alert_id,
          thread_id,
          last_message_id AS message_id,
          'detection_rule' AS detection_source,
          'tone_frequency_drop' AS rule_type,
          last_message_time AS detected_at,
          LEAST(100, (ABS(sentiment_drop) * 50) + ((1 - frequency_ratio) * 50)) AS score,
          CASE 
            WHEN sentiment_drop < -0.4 AND frequency_ratio < 0.3 THEN 'A'
            WHEN sentiment_drop < -0.2 AND frequency_ratio < 0.5 THEN 'B'
            ELSE 'C'
          END AS severity,
          STRUCT(
            sentiment_drop AS sentiment_drop,
            frequency_ratio AS frequency_ratio
          ) AS details,
          '返信案やワードチョイスの改善' AS recommended_action,
          'forecast_tone_down' AS segment
        FROM (
          WITH thread_metrics_30d AS (
            SELECT 
              thread_id,
              AVG(sentiment_score) AS avg_sentiment_30d,
              COUNT(*) AS message_count_30d,
              MAX(datetime) AS last_message_time,
              MAX(message_id) AS last_message_id
            FROM \`${DATASET}.unified_email_messages\`
            WHERE direction = 'inbound'
              AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
            GROUP BY thread_id
            HAVING message_count_30d >= 3
          ),
          thread_metrics_7d AS (
            SELECT 
              thread_id,
              AVG(sentiment_score) AS avg_sentiment_7d,
              COUNT(*) AS message_count_7d
            FROM \`${DATASET}.unified_email_messages\`
            WHERE direction = 'inbound'
              AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
            GROUP BY thread_id
          )
          SELECT 
            tm30.thread_id,
            tm30.last_message_id,
            tm30.last_message_time,
            tm30.avg_sentiment_30d - COALESCE(tm7.avg_sentiment_7d, tm30.avg_sentiment_30d) AS sentiment_drop,
            (COALESCE(tm7.message_count_7d, 0) / NULLIF(tm30.message_count_30d, 0)) AS frequency_ratio
          FROM thread_metrics_30d tm30
          LEFT JOIN thread_metrics_7d tm7 ON tm30.thread_id = tm7.thread_id
          WHERE 
            (tm30.avg_sentiment_30d - COALESCE(tm7.avg_sentiment_7d, tm30.avg_sentiment_30d)) < -0.2
            AND (COALESCE(tm7.message_count_7d, 0) / NULLIF(tm30.message_count_30d, 0)) < 0.5
        )
      )
      SELECT 
        alert_id,
        thread_id,
        message_id,
        detection_source,
        rule_type,
        detected_at,
        score,
        severity,
        TO_JSON_STRING(details) AS details_json,
        recommended_action,
        segment,
        CURRENT_TIMESTAMP() AS created_at
      FROM inactivity_72h
      UNION ALL
      SELECT 
        alert_id,
        thread_id,
        message_id,
        detection_source,
        rule_type,
        detected_at,
        score,
        severity,
        TO_JSON_STRING(details) AS details_json,
        recommended_action,
        segment,
        CURRENT_TIMESTAMP() AS created_at
      FROM sentiment_urgency
      UNION ALL
      SELECT 
        alert_id,
        thread_id,
        message_id,
        detection_source,
        rule_type,
        detected_at,
        score,
        severity,
        TO_JSON_STRING(details) AS details_json,
        recommended_action,
        segment,
        CURRENT_TIMESTAMP() AS created_at
      FROM tone_frequency_drop
    `;

    const [detectionRows] = await bigquery.query({
      query: detectionQuery,
      useLegacySql: false,
    });

    console.log(`✅ ${detectionRows.length} 件の検知ルール結果を取得しました`);

    if (detectionRows.length === 0) {
      console.log('⚠️  検知結果がありません');
      return;
    }

    // アラートテーブルが存在するか確認（なければ作成）
    const tableId = `${DATASET}.detection_alerts`;
    try {
      await bigquery.dataset(DATASET).table('detection_alerts').get();
    } catch (error: any) {
      if (error.code === 404) {
        console.log('📋 アラートテーブルを作成中...');
        const createTableQuery = `
          CREATE TABLE \`${tableId}\` (
            alert_id STRING,
            thread_id STRING,
            message_id STRING,
            detection_source STRING,
            rule_type STRING,
            detected_at TIMESTAMP,
            score FLOAT64,
            severity STRING,
            details_json STRING,
            recommended_action STRING,
            segment STRING,
            created_at TIMESTAMP
          )
          PARTITION BY DATE(detected_at)
          CLUSTER BY thread_id, severity
        `;
        await bigquery.query({
          query: createTableQuery,
          useLegacySql: false,
        });
        console.log('✅ アラートテーブルを作成しました');
      } else {
        throw error;
      }
    }

    // 既存のアラートを削除（同じalert_idのもの）
    const alertIds = detectionRows.map((r: any) => r.alert_id);
    const deleteQuery = `
      DELETE FROM \`${tableId}\`
      WHERE alert_id IN UNNEST(@alert_ids)
    `;
    await bigquery.query({
      query: deleteQuery,
      params: { alert_ids: alertIds },
      useLegacySql: false,
    });

    // 新しいアラートを挿入
    if (detectionRows.length > 0) {
      await bigquery.dataset(DATASET).table('detection_alerts').insert(detectionRows);
      console.log(`✅ ${detectionRows.length} 件のアラートを保存しました`);
    }

    console.log('✅ 検知ルール結果の同期が完了しました');
  } catch (error: any) {
    console.error('❌ エラー:', error);
    throw error;
  }
}

// メイン実行
if (require.main === module) {
  syncDetectionAlerts()
    .then(() => {
      console.log('✅ 処理完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 処理失敗:', error);
      process.exit(1);
    });
}

export { syncDetectionAlerts };


import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: 'viewpers' });
const DATASET = 'viewpers.salesguard_alerts';

/**
 * 検知ルール実装
 * - 72時間放置検知
 * - 夜間返信率異常検知
 * - 感情ダウン + 催促ワードの組み合わせ検知
 * - トーンダウン + 返信頻度変化の組み合わせ検知
 * - トラブル発生後の沈静化監視
 * - 同一トピック繰り返しによるトーンダウン検知
 */

type DetectionRuleType = 'inactivity_72h' | 'night_reply_rate' | 'sentiment_urgency' | 'tone_frequency_drop' | 'recovery_monitoring' | 'topic_repetition_tone_drop';

interface DetectionRuleResult {
  rule_type: DetectionRuleType;
  thread_id: string;
  message_id: string;
  detected_at: string;
  score: number;
  details: Record<string, any>;
  recommended_action: string;
}

// 催促ワードパターン
const URGENCY_KEYWORDS = [
  '進捗いかが',
  '進捗いかがでしょうか',
  'お返事いただけますでしょうか',
  '確認させていただきたいのですが',
  'まだですか',
  '対応して',
  '返事がない',
  'お待ちしています',
  'ご確認ください',
  '至急',
  '急ぎ',
];

/**
 * 72時間放置検知
 */
async function detectInactivity72h(limit: number = 100): Promise<DetectionRuleResult[]> {
  const query = `
    WITH latest_activity AS (
      SELECT 
        thread_id,
        MAX(datetime) AS last_activity,
        MAX(message_id) AS last_message_id,
        ANY_VALUE(company_domain) AS company_domain,
        ANY_VALUE(\`from\`) AS sender
      FROM \`${DATASET}.unified_email_messages\`
      WHERE direction = 'inbound'
      GROUP BY thread_id
    ),
    inactive_threads AS (
      SELECT 
        la.thread_id,
        la.last_message_id AS message_id,
        la.last_activity,
        la.company_domain,
        la.sender,
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), la.last_activity, HOUR) AS hours_since_last_activity,
        CASE 
          WHEN TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), la.last_activity, HOUR) >= 72 THEN 1
          ELSE 0
        END AS is_inactive
      FROM latest_activity la
      WHERE TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), la.last_activity, HOUR) >= 72
    )
    SELECT 
      thread_id,
      message_id,
      last_activity AS detected_at,
      hours_since_last_activity,
      company_domain,
      sender,
      -- スコア: 放置時間が長いほど高い
      LEAST(100, (hours_since_last_activity - 72) / 24.0 * 20 + 50) AS score
    FROM inactive_threads
    ORDER BY hours_since_last_activity DESC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { limit },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    rule_type: 'inactivity_72h',
    thread_id: row.thread_id,
    message_id: row.message_id,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    details: {
      hours_since_last_activity: row.hours_since_last_activity,
      company_domain: row.company_domain,
      sender: row.sender,
    },
    recommended_action: 'ボール判定し、返信判断',
  }));
}

/**
 * 夜間返信率異常検知
 */
async function detectNightReplyRate(threshold: number = 0.5, lookbackDays: number = 30): Promise<DetectionRuleResult[]> {
  const query = `
    WITH sender_stats AS (
      SELECT 
        \`from\` AS sender,
        COUNT(*) AS total_replies,
        COUNTIF(EXTRACT(HOUR FROM datetime) >= 22 OR EXTRACT(HOUR FROM datetime) < 6) AS night_replies,
        COUNT(*) AS total_replies_30d
      FROM \`${DATASET}.unified_email_messages\`
      WHERE direction = 'outbound'
        AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @lookback_days DAY)
      GROUP BY sender
      HAVING total_replies >= 10  -- 最低10件の返信がある担当者のみ
    ),
    baseline_stats AS (
      SELECT 
        sender,
        AVG(night_replies / NULLIF(total_replies, 0)) AS avg_night_ratio
      FROM sender_stats
      GROUP BY sender
    ),
    recent_stats AS (
      SELECT 
        \`from\` AS sender,
        COUNT(*) AS recent_total,
        COUNTIF(EXTRACT(HOUR FROM datetime) >= 22 OR EXTRACT(HOUR FROM datetime) < 6) AS recent_night,
        MAX(thread_id) AS latest_thread_id,
        MAX(message_id) AS latest_message_id,
        MAX(datetime) AS latest_datetime
      FROM \`${DATASET}.unified_email_messages\`
      WHERE direction = 'outbound'
        AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
      GROUP BY sender
      HAVING recent_total >= 5
    ),
    anomalies AS (
      SELECT 
        rs.sender,
        rs.recent_night / NULLIF(rs.recent_total, 0) AS recent_night_ratio,
        COALESCE(bs.avg_night_ratio, 0.2) AS baseline_night_ratio,
        rs.latest_thread_id AS thread_id,
        rs.latest_message_id AS message_id,
        rs.latest_datetime AS detected_at,
        (rs.recent_night / NULLIF(rs.recent_total, 0)) - COALESCE(bs.avg_night_ratio, 0.2) AS ratio_delta
      FROM recent_stats rs
      LEFT JOIN baseline_stats bs ON rs.sender = bs.sender
      WHERE (rs.recent_night / NULLIF(rs.recent_total, 0)) >= @threshold
        AND (rs.recent_night / NULLIF(rs.recent_total, 0)) - COALESCE(bs.avg_night_ratio, 0.2) >= 0.2
    )
    SELECT 
      sender,
      thread_id,
      message_id,
      detected_at,
      recent_night_ratio,
      baseline_night_ratio,
      ratio_delta,
      -- スコア: 夜間返信率が高いほど、ベースラインからの差が大きいほど高い
      LEAST(100, (recent_night_ratio * 50) + (ratio_delta * 100)) AS score
    FROM anomalies
    ORDER BY score DESC
    LIMIT 50
  `;

  const [rows] = await bigquery.query({
    query,
    params: {
      threshold,
      lookback_days: lookbackDays,
    },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    rule_type: 'night_reply_rate',
    thread_id: row.thread_id,
    message_id: row.message_id,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    details: {
      sender: row.sender,
      recent_night_ratio: row.recent_night_ratio,
      baseline_night_ratio: row.baseline_night_ratio,
      ratio_delta: row.ratio_delta,
    },
    recommended_action: '本質改善もしくは、リソース分配',
  }));
}

/**
 * 感情ダウン + 催促ワードの組み合わせ検知
 */
async function detectSentimentUrgency(limit: number = 100): Promise<DetectionRuleResult[]> {
  // 催促ワードをSQL用にエスケープ
  const urgencyKeywords = URGENCY_KEYWORDS.map(kw => kw.replace(/'/g, "''"));

  const query = `
    WITH recent_messages AS (
      SELECT 
        thread_id,
        message_id,
        subject,
        body_preview,
        sentiment_score,
        datetime,
        \`from\` AS sender,
        company_domain,
        -- 催促ワードチェック（簡易版：文字列包含チェック）
        (
          SELECT COUNT(*)
          FROM UNNEST([${urgencyKeywords.map(kw => `'${kw}'`).join(',')}]) AS keyword
          WHERE CONCAT(COALESCE(subject, ''), ' ', COALESCE(body_preview, '')) LIKE CONCAT('%', keyword, '%')
        ) AS urgency_word_count
      FROM \`${DATASET}.unified_email_messages\`
      WHERE direction = 'inbound'
        AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        AND sentiment_score < -0.3
    ),
    sentiment_trends AS (
      SELECT 
        thread_id,
        AVG(sentiment_score) AS avg_sentiment_30d,
        COUNT(*) AS message_count
      FROM \`${DATASET}.unified_email_messages\`
      WHERE direction = 'inbound'
        AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      GROUP BY thread_id
    ),
    detected AS (
      SELECT 
        rm.thread_id,
        rm.message_id,
        rm.datetime AS detected_at,
        rm.sentiment_score,
        rm.urgency_word_count,
        rm.sender,
        rm.company_domain,
        COALESCE(st.avg_sentiment_30d, rm.sentiment_score) AS avg_sentiment_30d,
        -- スコア: 感情スコアが低く、催促ワードが多いほど高い
        LEAST(100, (ABS(rm.sentiment_score) * 30) + (rm.urgency_word_count * 20) + 30) AS score
      FROM recent_messages rm
      LEFT JOIN sentiment_trends st ON rm.thread_id = st.thread_id
      WHERE rm.urgency_word_count > 0
        AND rm.sentiment_score < -0.3
    )
    SELECT *
    FROM detected
    ORDER BY score DESC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { limit },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    rule_type: 'sentiment_urgency',
    thread_id: row.thread_id,
    message_id: row.message_id,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    details: {
      sentiment_score: row.sentiment_score,
      urgency_word_count: row.urgency_word_count,
      avg_sentiment_30d: row.avg_sentiment_30d,
      sender: row.sender,
      company_domain: row.company_domain,
    },
    recommended_action: '不安傾向にあるので、不安解消フォロー',
  }));
}

/**
 * トーンダウン + 返信頻度変化の組み合わせ検知
 */
async function detectToneFrequencyDrop(limit: number = 100): Promise<DetectionRuleResult[]> {
  const query = `
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
    ),
    detected AS (
      SELECT 
        tm30.thread_id,
        tm30.last_message_id AS message_id,
        tm30.last_message_time AS detected_at,
        tm30.avg_sentiment_30d,
        COALESCE(tm7.avg_sentiment_7d, tm30.avg_sentiment_30d) AS avg_sentiment_7d,
        tm30.message_count_30d,
        COALESCE(tm7.message_count_7d, 0) AS message_count_7d,
        -- 感情スコアの下降
        tm30.avg_sentiment_30d - COALESCE(tm7.avg_sentiment_7d, tm30.avg_sentiment_30d) AS sentiment_drop,
        -- 返信頻度の下降（7日間のメッセージ数 / 30日間のメッセージ数）
        (COALESCE(tm7.message_count_7d, 0) / NULLIF(tm30.message_count_30d, 0)) AS frequency_ratio
      FROM thread_metrics_30d tm30
      LEFT JOIN thread_metrics_7d tm7 ON tm30.thread_id = tm7.thread_id
      WHERE 
        -- 感情スコアが下降
        (tm30.avg_sentiment_30d - COALESCE(tm7.avg_sentiment_7d, tm30.avg_sentiment_30d)) < -0.2
        -- かつ返信頻度も下降
        AND (COALESCE(tm7.message_count_7d, 0) / NULLIF(tm30.message_count_30d, 0)) < 0.5
    )
    SELECT 
      thread_id,
      message_id,
      detected_at,
      sentiment_drop,
      frequency_ratio,
      -- スコア: 感情下降と頻度下降の両方が大きいほど高い
      LEAST(100, (ABS(sentiment_drop) * 50) + ((1 - frequency_ratio) * 50)) AS score
    FROM detected
    ORDER BY score DESC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { limit },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    rule_type: 'tone_frequency_drop',
    thread_id: row.thread_id,
    message_id: row.message_id,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    details: {
      sentiment_drop: row.sentiment_drop,
      frequency_ratio: row.frequency_ratio,
    },
    recommended_action: '返信案やワードチョイスの改善',
  }));
}

/**
 * トラブル発生後の沈静化監視
 * 対応実施後の感情スコア回復状況を監視し、沈静化の度合いを定量化
 */
async function detectRecoveryMonitoring(limit: number = 100): Promise<DetectionRuleResult[]> {
  const query = `
    WITH incident_detections AS (
      -- 過去に検知されたインシデント（発生セグメント）
      SELECT DISTINCT
        thread_id,
        MAX(datetime) AS incident_detected_at,
        AVG(sentiment_score) AS incident_sentiment
      FROM \`${DATASET}.unified_email_messages\`
      WHERE direction = 'inbound'
        AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY)
      GROUP BY thread_id
      HAVING COUNT(*) >= 3  -- 最低3件のメッセージがあるスレッド
    ),
    followup_messages AS (
      -- 対応後のメッセージ（検知後24時間以降）
      SELECT 
        u.thread_id,
        u.message_id,
        u.datetime,
        u.sentiment_score,
        u.subject,
        u.body_preview,
        id.incident_detected_at,
        id.incident_sentiment,
        TIMESTAMP_DIFF(u.datetime, id.incident_detected_at, HOUR) AS hours_after_incident
      FROM \`${DATASET}.unified_email_messages\` u
      INNER JOIN incident_detections id ON u.thread_id = id.thread_id
      WHERE u.direction = 'inbound'
        AND u.datetime > TIMESTAMP_ADD(id.incident_detected_at, INTERVAL 24 HOUR)
        AND u.datetime <= TIMESTAMP_ADD(id.incident_detected_at, INTERVAL 14 DAY)
    ),
    recovery_metrics AS (
      SELECT 
        thread_id,
        MAX(message_id) AS latest_message_id,
        MAX(datetime) AS detected_at,
        AVG(sentiment_score) AS post_incident_sentiment,
        MIN(incident_sentiment) AS incident_sentiment,
        AVG(sentiment_score) - MIN(incident_sentiment) AS sentiment_recovery,
        COUNT(*) AS followup_message_count,
        MAX(hours_after_incident) AS hours_after_incident
      FROM followup_messages
      GROUP BY thread_id
      HAVING COUNT(*) >= 2  -- 最低2件のフォローアップメッセージ
    ),
    detected AS (
      SELECT 
        rm.thread_id,
        rm.latest_message_id AS message_id,
        rm.detected_at,
        rm.incident_sentiment,
        rm.post_incident_sentiment,
        rm.sentiment_recovery,
        rm.followup_message_count,
        rm.hours_after_incident,
        -- スコア: 回復が遅い、または回復していない場合に高い
        -- 感情スコアが回復していない（負の値または小さい正の値）ほど高いスコア
        LEAST(100, 
          CASE 
            WHEN rm.sentiment_recovery < -0.1 THEN 80 + (ABS(rm.sentiment_recovery) * 50)
            WHEN rm.sentiment_recovery < 0.1 THEN 60 + (ABS(rm.sentiment_recovery) * 100)
            WHEN rm.sentiment_recovery < 0.3 THEN 40 + ((0.3 - rm.sentiment_recovery) * 50)
            ELSE 20
          END
        ) AS score
      FROM recovery_metrics rm
      WHERE 
        -- 回復が不十分なケースを検知
        (rm.sentiment_recovery < 0.3 OR rm.post_incident_sentiment < -0.2)
        AND rm.hours_after_incident >= 48  -- 48時間以上経過している
    )
    SELECT *
    FROM detected
    ORDER BY score DESC, hours_after_incident DESC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { limit },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    rule_type: 'recovery_monitoring',
    thread_id: row.thread_id,
    message_id: row.message_id,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    details: {
      incident_sentiment: row.incident_sentiment,
      post_incident_sentiment: row.post_incident_sentiment,
      sentiment_recovery: row.sentiment_recovery,
      followup_message_count: row.followup_message_count,
      hours_after_incident: row.hours_after_incident,
    },
    recommended_action: '沈静化が進んでいないため、追加フォローと状況確認が必要',
  }));
}

/**
 * 同一トピック繰り返しによるトーンダウン検知
 * 同じトピックを繰り返し送信することで顧客のトーンが下がるケースを検知
 */
async function detectTopicRepetitionToneDrop(limit: number = 100): Promise<DetectionRuleResult[]> {
  const query = `
    WITH outbound_messages AS (
      -- 送信メッセージ（トピック抽出用）
      SELECT 
        thread_id,
        message_id,
        datetime,
        subject,
        body_preview,
        -- 簡易的なトピック抽出（件名と本文の最初の100文字からキーワード抽出）
        LOWER(CONCAT(COALESCE(subject, ''), ' ', COALESCE(SUBSTRING(body_preview, 1, 100), ''))) AS topic_text
      FROM \`${DATASET}.unified_email_messages\`
      WHERE direction = 'outbound'
        AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY)
    ),
    topic_similarity AS (
      -- トピックの類似度を計算（簡易版：共通キーワード数）
      SELECT 
        o1.thread_id,
        o1.message_id AS current_message_id,
        o1.datetime AS current_datetime,
        o1.topic_text,
        COUNT(DISTINCT o2.message_id) AS similar_topic_count,
        -- 共通キーワードの抽出（簡易版：3文字以上の単語）
        ARRAY_LENGTH(SPLIT(o1.topic_text, ' ')) AS current_word_count
      FROM outbound_messages o1
      LEFT JOIN outbound_messages o2 
        ON o1.thread_id = o2.thread_id
        AND o2.datetime < o1.datetime
        AND o2.datetime >= TIMESTAMP_SUB(o1.datetime, INTERVAL 30 DAY)
        -- 簡易的な類似度判定（同じキーワードが3つ以上含まれる）
        AND (
          -- 件名の類似度
          (o1.subject IS NOT NULL AND o2.subject IS NOT NULL 
           AND LENGTH(o1.subject) > 0 AND LENGTH(o2.subject) > 0
           AND (
             -- 件名が50%以上一致
             LENGTH(o1.subject) <= LENGTH(o2.subject) 
             AND o2.subject LIKE CONCAT('%', o1.subject, '%')
             OR LENGTH(o2.subject) <= LENGTH(o1.subject)
             AND o1.subject LIKE CONCAT('%', o2.subject, '%')
           ))
          OR
          -- 本文の類似度（最初の100文字）
          (LENGTH(o1.body_preview) > 20 AND LENGTH(o2.body_preview) > 20
           AND (
             -- 本文が30%以上一致
             LENGTH(o1.body_preview) <= LENGTH(o2.body_preview)
             AND o2.body_preview LIKE CONCAT('%', SUBSTRING(o1.body_preview, 1, 30), '%')
             OR LENGTH(o2.body_preview) <= LENGTH(o1.body_preview)
             AND o1.body_preview LIKE CONCAT('%', SUBSTRING(o2.body_preview, 1, 30), '%')
           ))
        )
      GROUP BY o1.thread_id, o1.message_id, o1.datetime, o1.topic_text, o1.subject, o1.body_preview
    ),
    inbound_sentiment AS (
      -- 受信メッセージの感情スコア
      SELECT 
        thread_id,
        message_id,
        datetime,
        sentiment_score
      FROM \`${DATASET}.unified_email_messages\`
      WHERE direction = 'inbound'
        AND datetime >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 60 DAY)
    ),
    detected AS (
      SELECT 
        ts.thread_id,
        ts.current_message_id AS message_id,
        ts.current_datetime AS detected_at,
        ts.similar_topic_count,
        -- 繰り返し後の顧客の感情スコア
        (
          SELECT AVG(sentiment_score)
          FROM inbound_sentiment ins
          WHERE ins.thread_id = ts.thread_id
            AND ins.datetime > ts.current_datetime
            AND ins.datetime <= TIMESTAMP_ADD(ts.current_datetime, INTERVAL 7 DAY)
        ) AS post_repetition_sentiment,
        -- 繰り返し前の顧客の感情スコア
        (
          SELECT AVG(sentiment_score)
          FROM inbound_sentiment ins
          WHERE ins.thread_id = ts.thread_id
            AND ins.datetime < ts.current_datetime
            AND ins.datetime >= TIMESTAMP_SUB(ts.current_datetime, INTERVAL 7 DAY)
        ) AS pre_repetition_sentiment
      FROM topic_similarity ts
      WHERE ts.similar_topic_count >= 2  -- 同じトピックを2回以上繰り返している
    ),
    scored AS (
      SELECT 
        thread_id,
        message_id,
        detected_at,
        similar_topic_count,
        post_repetition_sentiment,
        pre_repetition_sentiment,
        COALESCE(post_repetition_sentiment, 0) - COALESCE(pre_repetition_sentiment, 0) AS sentiment_drop,
        -- スコア: 繰り返し回数が多く、感情スコアが下がっているほど高い
        LEAST(100,
          (similar_topic_count * 15) + 
          (CASE 
            WHEN COALESCE(post_repetition_sentiment, 0) - COALESCE(pre_repetition_sentiment, 0) < -0.2 THEN 50
            WHEN COALESCE(post_repetition_sentiment, 0) - COALESCE(pre_repetition_sentiment, 0) < -0.1 THEN 30
            WHEN COALESCE(post_repetition_sentiment, 0) - COALESCE(pre_repetition_sentiment, 0) < 0 THEN 15
            ELSE 0
          END)
        ) AS score
      FROM detected
      WHERE 
        -- 感情スコアが下がっている、または繰り返し回数が多い
        (COALESCE(post_repetition_sentiment, 0) - COALESCE(pre_repetition_sentiment, 0) < -0.1
         OR similar_topic_count >= 3)
    )
    SELECT *
    FROM scored
    ORDER BY score DESC, similar_topic_count DESC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { limit },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    rule_type: 'topic_repetition_tone_drop',
    thread_id: row.thread_id,
    message_id: row.message_id,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    details: {
      similar_topic_count: row.similar_topic_count,
      pre_repetition_sentiment: row.pre_repetition_sentiment,
      post_repetition_sentiment: row.post_repetition_sentiment,
      sentiment_drop: row.sentiment_drop,
    },
    recommended_action: '同一トピックの繰り返しが顧客のトーンを下げている可能性。アプローチ方法の見直しが必要',
  }));
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const ruleType = url.searchParams.get('rule_type') as DetectionRuleType | null;
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100;
    const useDummy = process.env.NEXT_PUBLIC_USE_DUMMY_ALERTS !== '0';

    // ダミーデータモード
    if (useDummy) {
      const dummyResults: DetectionRuleResult[] = [
        {
          rule_type: 'inactivity_72h',
          thread_id: 'thread-002',
          message_id: 'msg-006',
          detected_at: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
          score: 70,
          details: {
            hours_since_last_activity: 96,
            company_domain: 'VIP Co.',
            sender: 'vip_client@example.com',
          },
          recommended_action: 'ボール判定し、返信判断',
        },
        {
          rule_type: 'sentiment_urgency',
          thread_id: 'thread-002',
          message_id: 'msg-006',
          detected_at: new Date().toISOString(),
          score: 85,
          details: {
            sentiment_score: -0.55,
            urgency_word_count: 2,
            avg_sentiment_30d: -0.4,
            sender: 'vip_client@example.com',
            company_domain: 'VIP Co.',
          },
          recommended_action: '不安傾向にあるので、不安解消フォロー',
        },
        {
          rule_type: 'tone_frequency_drop',
          thread_id: 'thread-001',
          message_id: 'msg-003',
          detected_at: new Date().toISOString(),
          score: 65,
          details: {
            sentiment_drop: -0.25,
            frequency_ratio: 0.4,
          },
          recommended_action: '返信案やワードチョイスの改善',
        },
        {
          rule_type: 'recovery_monitoring',
          thread_id: 'thread-011',
          message_id: 'msg-025',
          detected_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          score: 75,
          details: {
            incident_sentiment: -0.45,
            post_incident_sentiment: -0.25,
            sentiment_recovery: 0.20,
            followup_message_count: 3,
            hours_after_incident: 72,
          },
          recommended_action: '沈静化が進んでいないため、追加フォローと状況確認が必要',
        },
        {
          rule_type: 'topic_repetition_tone_drop',
          thread_id: 'thread-003',
          message_id: 'msg-012',
          detected_at: new Date().toISOString(),
          score: 70,
          details: {
            similar_topic_count: 3,
            pre_repetition_sentiment: -0.15,
            post_repetition_sentiment: -0.35,
            sentiment_drop: -0.20,
          },
          recommended_action: '同一トピックの繰り返しが顧客のトーンを下げている可能性。アプローチ方法の見直しが必要',
        },
      ];

      const filtered = ruleType 
        ? dummyResults.filter(r => r.rule_type === ruleType)
        : dummyResults;

      return NextResponse.json({
        success: true,
        rule_type: ruleType || 'all',
        total: filtered.length,
        results: filtered.slice(0, limit),
        timestamp: new Date().toISOString(),
        dummy_mode: true,
      });
    }

    let results: DetectionRuleResult[] = [];

    if (!ruleType || ruleType === 'inactivity_72h') {
      const inactivity = await detectInactivity72h(limit);
      results = results.concat(inactivity);
    }

    if (!ruleType || ruleType === 'night_reply_rate') {
      const nightRate = await detectNightReplyRate();
      results = results.concat(nightRate);
    }

    if (!ruleType || ruleType === 'sentiment_urgency') {
      const sentimentUrgency = await detectSentimentUrgency(limit);
      results = results.concat(sentimentUrgency);
    }

    if (!ruleType || ruleType === 'tone_frequency_drop') {
      const toneFreq = await detectToneFrequencyDrop(limit);
      results = results.concat(toneFreq);
    }

    if (!ruleType || ruleType === 'recovery_monitoring') {
      const recovery = await detectRecoveryMonitoring(limit);
      results = results.concat(recovery);
    }

    if (!ruleType || ruleType === 'topic_repetition_tone_drop') {
      const topicRepetition = await detectTopicRepetitionToneDrop(limit);
      results = results.concat(topicRepetition);
    }

    // スコア順にソート
    results.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      rule_type: ruleType || 'all',
      total: results.length,
      results: results.slice(0, limit),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Detection rules API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run detection rules',
      },
      { status: 500 }
    );
  }
}

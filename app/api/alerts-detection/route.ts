import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: 'viewpers' });
const DATASET = 'viewpers.salesguard_alerts';

/**
 * 統合アラート検知API
 * 新しい分析モデル（検知ルール、フェーズC、フェーズD）の結果を統合してアラートを生成
 */

interface DetectionAlert {
  alert_id: string;
  thread_id: string;
  message_id: string | null;
  detection_source: 'detection_rule' | 'phase_c' | 'phase_d' | 'combined';
  rule_type?: string;
  detected_at: string;
  score: number;
  severity: 'A' | 'B' | 'C';
  details: {
    // 検知ルール固有
    hours_since_last_activity?: number;
    night_reply_ratio?: number;
    urgency_word_count?: number;
    sentiment_drop?: number;
    frequency_ratio?: number;
    // フェーズC固有
    p_resolved_24h?: number;
    ttr_pred_min?: number;
    hazard_score?: number;
    // フェーズD固有
    quality_score?: number;
    quality_level?: string;
    // 共通
    subject?: string;
    body_preview?: string;
    sender?: string;
    company_domain?: string;
    sentiment_score?: number;
  };
  recommended_action: string;
  segment?: string;
}

/**
 * 検知ルールからアラートを生成
 */
async function getDetectionRuleAlerts(limit: number = 100): Promise<DetectionAlert[]> {
  const query = `
    -- 72時間放置検知
    WITH inactivity_72h AS (
      SELECT 
        CONCAT('DR-', CAST(FARM_FINGERPRINT(thread_id) AS STRING), '-72h') AS alert_id,
        thread_id,
        last_message_id AS message_id,
        'detection_rule' AS detection_source,
        'inactivity_72h' AS rule_type,
        last_activity AS detected_at,
        LEAST(100, (hours_since_last_activity - 72) / 24.0 * 20 + 50) AS score,
        CASE 
          WHEN hours_since_last_activity >= 168 THEN 'A'
          WHEN hours_since_last_activity >= 120 THEN 'B'
          ELSE 'C'
        END AS severity,
        STRUCT(
          hours_since_last_activity AS hours_since_last_activity,
          company_domain AS company_domain,
          sender AS sender
        ) AS details,
        'ボール判定し、返信判断' AS recommended_action,
        'inactivity_risk' AS segment
      FROM (
        SELECT 
          thread_id,
          MAX(datetime) AS last_activity,
          MAX(message_id) AS last_message_id,
          ANY_VALUE(company_domain) AS company_domain,
          ANY_VALUE(\`from\`) AS sender,
          TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(datetime), HOUR) AS hours_since_last_activity
        FROM \`${DATASET}.unified_email_messages\`
        WHERE direction = 'inbound'
        GROUP BY thread_id
        HAVING hours_since_last_activity >= 72
      )
      ORDER BY hours_since_last_activity DESC
      LIMIT @limit_72h
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
      ORDER BY score DESC
      LIMIT @limit_urg
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
      ORDER BY score DESC
      LIMIT @limit_tone
    )
    SELECT * FROM inactivity_72h
    UNION ALL
    SELECT * FROM sentiment_urgency
    UNION ALL
    SELECT * FROM tone_frequency_drop
    ORDER BY score DESC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: {
      limit_72h: Math.floor(limit / 3),
      limit_urg: Math.floor(limit / 3),
      limit_tone: Math.floor(limit / 3),
      limit,
    },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    alert_id: row.alert_id,
    thread_id: row.thread_id,
    message_id: row.message_id,
    detection_source: row.detection_source,
    rule_type: row.rule_type,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    severity: row.severity,
    details: row.details || {},
    recommended_action: row.recommended_action,
    segment: row.segment,
  }));
}

/**
 * フェーズCの予測結果からアラートを生成（低鎮火確率のケース）
 */
async function getPhaseCAlerts(threshold: number = 0.3, limit: number = 50): Promise<DetectionAlert[]> {
  const query = `
    SELECT 
      CONCAT('PC-', CAST(FARM_FINGERPRINT(io.thread_id) AS STRING), '-', io.rule_id) AS alert_id,
      io.thread_id,
      NULL AS message_id,
      'phase_c' AS detection_source,
      'incident_outcome_prediction' AS rule_type,
      io.predicted_at AS detected_at,
      (1.0 - io.p_resolved_24h) * 100 AS score,
      CASE 
        WHEN io.p_resolved_24h < 0.2 THEN 'A'
        WHEN io.p_resolved_24h < 0.3 THEN 'B'
        ELSE 'C'
      END AS severity,
      STRUCT(
        io.p_resolved_24h AS p_resolved_24h,
        io.ttr_pred_min AS ttr_pred_min,
        io.hazard_score AS hazard_score,
        a.subject AS subject,
        a.body_preview AS body_preview
      ) AS details,
      '鎮火確率が低いため、早期対応を推奨' AS recommended_action,
      a.primary_segment AS segment
    FROM \`${DATASET}.incident_outcomes\` io
    LEFT JOIN \`${DATASET}.alerts_v2_scored\` a ON io.thread_id = a.thread_id
    WHERE io.p_resolved_24h < @threshold
      AND io.predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY io.thread_id ORDER BY io.predicted_at DESC) = 1
    ORDER BY io.p_resolved_24h ASC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { threshold, limit },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    alert_id: row.alert_id,
    thread_id: row.thread_id,
    message_id: row.message_id,
    detection_source: row.detection_source,
    rule_type: row.rule_type,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    severity: row.severity,
    details: row.details || {},
    recommended_action: row.recommended_action,
    segment: row.segment,
  }));
}

/**
 * フェーズDの品質スコアからアラートを生成（低品質返信）
 */
async function getPhaseDAlerts(threshold: number = 60, limit: number = 50): Promise<DetectionAlert[]> {
  const query = `
    SELECT 
      CONCAT('PD-', CAST(FARM_FINGERPRINT(rq.thread_id) AS STRING), '-', rq.message_id) AS alert_id,
      rq.thread_id,
      rq.message_id,
      'phase_d' AS detection_source,
      'reply_quality_low' AS rule_type,
      rq.scored_at AS detected_at,
      100 - rq.score AS score,
      CASE 
        WHEN rq.score < 40 THEN 'A'
        WHEN rq.score < 60 THEN 'B'
        ELSE 'C'
      END AS severity,
      STRUCT(
        rq.score AS quality_score,
        rq.level AS quality_level,
        rq.politeness AS politeness,
        rq.specificity AS specificity,
        rq.coverage AS coverage,
        rq.structure AS structure,
        rq.sentiment AS sentiment,
        u.subject AS subject,
        u.body_preview AS body_preview
      ) AS details,
      '返信品質が低いため、改善を推奨' AS recommended_action,
      a.primary_segment AS segment
    FROM \`${DATASET}.reply_quality\` rq
    LEFT JOIN \`${DATASET}.unified_email_messages\` u ON rq.message_id = u.message_id
    LEFT JOIN \`${DATASET}.alerts_v2_scored\` a ON rq.thread_id = a.thread_id
    WHERE rq.score < @threshold
      AND rq.scored_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY rq.thread_id ORDER BY rq.scored_at DESC) = 1
    ORDER BY rq.score ASC
    LIMIT @limit
  `;

  const [rows] = await bigquery.query({
    query,
    params: { threshold, limit },
    useLegacySql: false,
  });

  return rows.map((row: any) => ({
    alert_id: row.alert_id,
    thread_id: row.thread_id,
    message_id: row.message_id,
    detection_source: row.detection_source,
    rule_type: row.rule_type,
    detected_at: row.detected_at?.value || row.detected_at,
    score: row.score,
    severity: row.severity,
    details: row.details || {},
    recommended_action: row.recommended_action,
    segment: row.segment,
  }));
}

/**
 * 統合アラート取得
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const includeDetectionRules = url.searchParams.get('include_detection_rules') !== 'false';
    const includePhaseC = url.searchParams.get('include_phase_c') !== 'false';
    const includePhaseD = url.searchParams.get('include_phase_d') !== 'false';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const severity = url.searchParams.get('severity')?.toUpperCase();
    const segment = url.searchParams.get('segment');
    const useDummy = process.env.NEXT_PUBLIC_USE_DUMMY_ALERTS !== '0';

    // ダミーデータモード
    if (useDummy) {
      const dummyAlerts: DetectionAlert[] = [
        {
          alert_id: 'DR-dummy-001-72h',
          thread_id: 'thread-002',
          message_id: 'msg-006',
          detection_source: 'detection_rule',
          rule_type: 'inactivity_72h',
          detected_at: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
          score: 70,
          severity: 'B',
          details: {
            hours_since_last_activity: 96,
            subject: '導入後の不具合について',
            body_preview: 'ログを添付し、解決期限を確認する催促。感情はさらに悪化。',
            sender: 'vip_client@example.com',
            company_domain: 'VIP Co.',
            sentiment_score: -0.55,
          },
          recommended_action: 'ボール判定し、返信判断',
          segment: 'inactivity_risk',
        },
        {
          alert_id: 'DR-dummy-002-urg',
          thread_id: 'thread-002',
          message_id: 'msg-006',
          detection_source: 'detection_rule',
          rule_type: 'sentiment_urgency',
          detected_at: new Date().toISOString(),
          score: 85,
          severity: 'A',
          details: {
            sentiment_score: -0.55,
            urgency_word_count: 2,
            subject: '導入後の不具合について',
            body_preview: 'ログを添付し、解決期限を確認する催促。感情はさらに悪化。',
            sender: 'vip_client@example.com',
            company_domain: 'VIP Co.',
          },
          recommended_action: '不安傾向にあるので、不安解消フォロー',
          segment: 'forecast_trust_risk',
        },
        {
          alert_id: 'PC-dummy-001',
          thread_id: 'thread-002',
          message_id: null,
          detection_source: 'phase_c',
          rule_type: 'incident_outcome_prediction',
          detected_at: new Date().toISOString(),
          score: 75,
          severity: 'A',
          details: {
            p_resolved_24h: 0.25,
            ttr_pred_min: 1440,
            hazard_score: 0.8,
            subject: '導入後の不具合について',
            body_preview: '導入直後に発生した重大な不具合について、顧客が解決期限を強く要求しています。',
          },
          recommended_action: '鎮火確率が低いため、早期対応を推奨',
          segment: 'occurrence_followup',
        },
        {
          alert_id: 'PD-dummy-001',
          thread_id: 'thread-002',
          message_id: 'msg-006',
          detection_source: 'phase_d',
          rule_type: 'reply_quality_low',
          detected_at: new Date().toISOString(),
          score: 55,
          severity: 'B',
          details: {
            quality_score: 45,
            quality_level: 'Low',
            subject: '導入後の不具合について',
            body_preview: 'ログを添付し、解決期限を確認する催促。感情はさらに悪化。',
          },
          recommended_action: '返信品質が低いため、改善を推奨',
          segment: 'occurrence_followup',
        },
      ];

      let filtered = dummyAlerts;
      if (severity) {
        filtered = filtered.filter(a => a.severity === severity);
      }
      if (segment) {
        filtered = filtered.filter(a => a.segment === segment);
      }

      return NextResponse.json({
        success: true,
        total: filtered.length,
        alerts: filtered.slice(0, limit),
        timestamp: new Date().toISOString(),
        dummy_mode: true,
      });
    }

    const allAlerts: DetectionAlert[] = [];

    // 検知ルールアラート
    if (includeDetectionRules) {
      const detectionAlerts = await getDetectionRuleAlerts(limit);
      allAlerts.push(...detectionAlerts);
    }

    // フェーズCアラート
    if (includePhaseC) {
      const phaseCAlerts = await getPhaseCAlerts(0.3, Math.floor(limit / 2));
      allAlerts.push(...phaseCAlerts);
    }

    // フェーズDアラート
    if (includePhaseD) {
      const phaseDAlerts = await getPhaseDAlerts(60, Math.floor(limit / 2));
      allAlerts.push(...phaseDAlerts);
    }

    // フィルタリング
    let filteredAlerts = allAlerts;

    if (severity) {
      filteredAlerts = filteredAlerts.filter((a) => a.severity === severity);
    }

    if (segment) {
      filteredAlerts = filteredAlerts.filter((a) => a.segment === segment);
    }

    // スコア順にソート
    filteredAlerts.sort((a, b) => b.score - a.score);

    // 重複除去（同じthread_idで最新のもののみ）
    const uniqueAlerts = new Map<string, DetectionAlert>();
    for (const alert of filteredAlerts) {
      const key = alert.thread_id;
      if (!uniqueAlerts.has(key) || uniqueAlerts.get(key)!.score < alert.score) {
        uniqueAlerts.set(key, alert);
      }
    }

    const finalAlerts = Array.from(uniqueAlerts.values())
      .slice(0, limit)
      .map((alert) => ({
        ...alert,
        detection_source: 'combined' as const, // 統合されたことを示す
      }));

    return NextResponse.json({
      success: true,
      total: finalAlerts.length,
      alerts: finalAlerts,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Alerts detection API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get detection alerts',
      },
      { status: 500 }
    );
  }
}

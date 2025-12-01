/**
 * アラートセグメント遷移と自動解決のバッチ処理
 * 
 * 機能:
 * 1. 予兆→発生の自動遷移判定
 * 2. 発生→回復の自動遷移判定
 * 3. ポジティブ反応による自動completed化
 */

import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: 'viewpers' });
const DATASET = 'viewpers.salesguard_alerts';

interface TransitionCandidate {
  thread_id: string;
  alert_id: string;
  from_segment: string;
  to_segment: string;
  transition_type: string;
  transition_score: number;
  transition_reason: string;
}

interface AutoResolutionCandidate {
  thread_id: string;
  alert_id: string;
  previous_status: string;
  resolution_type: string;
  resolution_score: number;
  resolution_reason: string;
}

/**
 * セグメント遷移の実行
 */
async function processSegmentTransitions(): Promise<number> {
  console.log('🔄 セグメント遷移処理を開始...');

  try {
    // 遷移候補を取得
    const transitionQuery = `
      SELECT 
        thread_id,
        alert_id,
        from_segment,
        to_segment,
        transition_type,
        transition_score,
        transition_reason
      FROM \`${DATASET}.vw_alert_transition_candidates\`
      ORDER BY transition_score DESC
    `;

    const [transitionRows] = await bigquery.query({
      query: transitionQuery,
      useLegacySql: false,
    });

    if (transitionRows.length === 0) {
      console.log('✅ 遷移候補なし');
      return 0;
    }

    console.log(`📊 ${transitionRows.length}件の遷移候補を検出`);

    // 遷移履歴を記録
    const historyRows = transitionRows.map((row: TransitionCandidate, index: number) => ({
      id: `transition_${Date.now()}_${index}`,
      alert_id: row.alert_id || row.thread_id,
      thread_id: row.thread_id,
      from_segment: row.from_segment,
      to_segment: row.to_segment,
      transition_reason: row.transition_reason,
      transition_score: row.transition_score,
      transitioned_by: 'system',
      created_at: new Date().toISOString(),
    }));

    // 履歴テーブルに挿入
    const historyTable = bigquery.dataset('salesguard_alerts').table('alert_segment_history');
    await historyTable.insert(historyRows);

    console.log(`✅ ${historyRows.length}件の遷移履歴を記録`);

    // アラートのセグメントを更新
    for (const row of transitionRows as TransitionCandidate[]) {
      const updateQuery = `
        UPDATE \`${DATASET}.alerts_v2_scored\`
        SET 
          primary_segment = @to_segment,
          updated_at = CURRENT_TIMESTAMP()
        WHERE thread_id = @thread_id
          AND (primary_segment = @from_segment OR primary_segment IS NULL)
      `;

      await bigquery.query({
        query: updateQuery,
        params: {
          thread_id: row.thread_id,
          from_segment: row.from_segment,
          to_segment: row.to_segment,
        },
        useLegacySql: false,
      });
    }

    console.log(`✅ ${transitionRows.length}件のアラートセグメントを更新`);

    return transitionRows.length;
  } catch (error: any) {
    console.error('❌ セグメント遷移処理エラー:', error);
    throw error;
  }
}

/**
 * 自動解決の実行
 */
async function processAutoResolutions(): Promise<number> {
  console.log('🔄 自動解決処理を開始...');

  try {
    // 自動解決候補を取得
    const resolutionQuery = `
      SELECT 
        thread_id,
        alert_id,
        previous_status,
        resolution_type,
        resolution_score,
        resolution_reason
      FROM \`${DATASET}.vw_auto_resolution_candidates\`
      WHERE resolution_type IS NOT NULL
    `;

    const [resolutionRows] = await bigquery.query({
      query: resolutionQuery,
      useLegacySql: false,
    });

    if (resolutionRows.length === 0) {
      console.log('✅ 自動解決候補なし');
      return 0;
    }

    console.log(`📊 ${resolutionRows.length}件の自動解決候補を検出`);

    // 自動解決履歴を記録
    const historyRows = resolutionRows.map((row: AutoResolutionCandidate, index: number) => ({
      id: `resolution_${Date.now()}_${index}`,
      alert_id: row.alert_id || row.thread_id,
      thread_id: row.thread_id,
      resolution_type: row.resolution_type,
      resolution_score: row.resolution_score,
      resolution_reason: row.resolution_reason,
      previous_status: row.previous_status,
      resolved_at: new Date().toISOString(),
    }));

    // 履歴テーブルに挿入
    const resolutionTable = bigquery.dataset('salesguard_alerts').table('alert_auto_resolutions');
    await resolutionTable.insert(historyRows);

    console.log(`✅ ${historyRows.length}件の自動解決履歴を記録`);

    // アラートのステータスを更新
    for (const row of resolutionRows as AutoResolutionCandidate) {
      const updateQuery = `
        UPDATE \`${DATASET}.alerts_v2_scored\`
        SET 
          status = 'completed',
          updated_at = CURRENT_TIMESTAMP()
        WHERE thread_id = @thread_id
          AND status IN ('unhandled', 'in_progress')
      `;

      await bigquery.query({
        query: updateQuery,
        params: {
          thread_id: row.thread_id,
        },
        useLegacySql: false,
      });
    }

    console.log(`✅ ${resolutionRows.length}件のアラートを自動解決`);

    return resolutionRows.length;
  } catch (error: any) {
    console.error('❌ 自動解決処理エラー:', error);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 アラート遷移・自動解決バッチ処理を開始');
  console.log('==========================================');

  try {
    const transitionCount = await processSegmentTransitions();
    const resolutionCount = await processAutoResolutions();

    console.log('==========================================');
    console.log(`✅ 処理完了:`);
    console.log(`   - セグメント遷移: ${transitionCount}件`);
    console.log(`   - 自動解決: ${resolutionCount}件`);
  } catch (error: any) {
    console.error('❌ バッチ処理エラー:', error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main();
}

export { processSegmentTransitions, processAutoResolutions };



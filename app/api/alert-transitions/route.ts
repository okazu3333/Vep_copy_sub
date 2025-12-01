/**
 * アラートセグメント遷移と自動解決のAPI
 * 
 * GET: 遷移履歴・自動解決履歴の取得
 * POST: 手動での遷移実行
 */

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { SegmentTransition, AutoResolution } from '@/types';

const bigquery = new BigQuery({ projectId: 'viewpers' });
const DATASET = 'viewpers.salesguard_alerts';

/**
 * 遷移履歴の取得
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const threadId = url.searchParams.get('thread_id');
    const alertId = url.searchParams.get('alert_id');
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50;

    // 遷移履歴の取得
    let transitionQuery = `
      SELECT 
        id,
        alert_id,
        thread_id,
        from_segment,
        to_segment,
        transition_reason,
        transition_score,
        transitioned_by,
        created_at
      FROM \`${DATASET}.alert_segment_history\`
      WHERE 1=1
    `;

    const transitionParams: any = { limit };

    if (threadId) {
      transitionQuery += ' AND thread_id = @thread_id';
      transitionParams.thread_id = threadId;
    }
    if (alertId) {
      transitionQuery += ' AND alert_id = @alert_id';
      transitionParams.alert_id = alertId;
    }

    transitionQuery += ' ORDER BY created_at DESC LIMIT @limit';

    const [transitionRows] = await bigquery.query({
      query: transitionQuery,
      params: transitionParams,
      useLegacySql: false,
    });

    // 自動解決履歴の取得
    let resolutionQuery = `
      SELECT 
        id,
        alert_id,
        thread_id,
        resolution_type,
        resolution_score,
        resolution_reason,
        previous_status,
        resolved_at
      FROM \`${DATASET}.alert_auto_resolutions\`
      WHERE 1=1
    `;

    const resolutionParams: any = { limit };

    if (threadId) {
      resolutionQuery += ' AND thread_id = @thread_id';
      resolutionParams.thread_id = threadId;
    }
    if (alertId) {
      resolutionQuery += ' AND alert_id = @alert_id';
      resolutionParams.alert_id = alertId;
    }

    resolutionQuery += ' ORDER BY resolved_at DESC LIMIT @limit';

    const [resolutionRows] = await bigquery.query({
      query: resolutionQuery,
      params: resolutionParams,
      useLegacySql: false,
    });

    return NextResponse.json({
      success: true,
      transitions: transitionRows.map((row: any) => ({
        id: row.id,
        alert_id: row.alert_id,
        thread_id: row.thread_id,
        from_segment: row.from_segment,
        to_segment: row.to_segment,
        transition_reason: row.transition_reason,
        transition_score: row.transition_score,
        transitioned_by: row.transitioned_by,
        created_at: row.created_at?.value || row.created_at,
      })) as SegmentTransition[],
      auto_resolutions: resolutionRows.map((row: any) => ({
        id: row.id,
        alert_id: row.alert_id,
        thread_id: row.thread_id,
        resolution_type: row.resolution_type,
        resolution_score: row.resolution_score,
        resolution_reason: row.resolution_reason,
        previous_status: row.previous_status,
        resolved_at: row.resolved_at?.value || row.resolved_at,
      })) as AutoResolution[],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Alert transitions API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get alert transitions',
      },
      { status: 500 }
    );
  }
}

/**
 * 手動での遷移実行
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { thread_id, alert_id, from_segment, to_segment, transition_reason, transitioned_by } = body;

    if (!thread_id || !to_segment) {
      return NextResponse.json(
        {
          success: false,
          error: 'thread_id and to_segment are required',
        },
        { status: 400 }
      );
    }

    // 遷移履歴を記録
    const historyId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const insertQuery = `
      INSERT INTO \`${DATASET}.alert_segment_history\`
      (id, alert_id, thread_id, from_segment, to_segment, transition_reason, transition_score, transitioned_by, created_at)
      VALUES
      (@id, @alert_id, @thread_id, @from_segment, @to_segment, @transition_reason, 100, @transitioned_by, CURRENT_TIMESTAMP())
    `;

    await bigquery.query({
      query: insertQuery,
      params: {
        id: historyId,
        alert_id: alert_id || thread_id,
        thread_id,
        from_segment: from_segment || null,
        to_segment,
        transition_reason: transition_reason || '手動遷移',
        transitioned_by: transitioned_by || 'manual',
      },
      useLegacySql: false,
    });

    // アラートのセグメントを更新
    const updateQuery = `
      UPDATE \`${DATASET}.alerts_v2_scored\`
      SET 
        primary_segment = @to_segment,
        updated_at = CURRENT_TIMESTAMP()
      WHERE thread_id = @thread_id
    `;

    await bigquery.query({
      query: updateQuery,
      params: {
        thread_id,
        to_segment,
      },
      useLegacySql: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Segment transition completed',
      data: {
        id: historyId,
        thread_id,
        from_segment,
        to_segment,
        transitioned_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ Alert transition POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute transition',
      },
      { status: 500 }
    );
  }
}



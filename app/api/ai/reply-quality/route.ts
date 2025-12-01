import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: 'viewpers' });
const DATASET = 'viewpers.salesguard_alerts';

type ReplyQualityRequest = {
  thread_id?: string;
  message_id?: string;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params: ReplyQualityRequest = {
      thread_id: url.searchParams.get('thread_id') ?? undefined,
      message_id: url.searchParams.get('message_id') ?? undefined,
    };

    if (!params.thread_id && !params.message_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'thread_id or message_id is required',
        },
        { status: 400 }
      );
    }

    // BigQueryから最新の品質スコアを取得
    let query = '';
    if (params.message_id) {
      query = `
        SELECT 
          message_id,
          thread_id,
          sender,
          scored_at,
          score,
          politeness,
          specificity,
          coverage,
          structure,
          sentiment,
          level,
          model_version,
          signals
        FROM \`${DATASET}.reply_quality\`
        WHERE message_id = @message_id
        ORDER BY scored_at DESC
        LIMIT 1
      `;
    } else {
      query = `
        SELECT 
          message_id,
          thread_id,
          sender,
          scored_at,
          score,
          politeness,
          specificity,
          coverage,
          structure,
          sentiment,
          level,
          model_version,
          signals
        FROM \`${DATASET}.reply_quality\`
        WHERE thread_id = @thread_id
        ORDER BY scored_at DESC
        LIMIT 1
      `;
    }

    const options = {
      query,
      params: params.message_id
        ? { message_id: params.message_id }
        : { thread_id: params.thread_id },
      useLegacySql: false,
    };

    const [rows] = await bigquery.query(options);

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No quality score found for the given thread_id or message_id',
      });
    }

    const row = rows[0];
    let signals = {};
    try {
      if (row.signals) {
        signals = typeof row.signals === 'string' ? JSON.parse(row.signals) : row.signals;
      }
    } catch (e) {
      console.warn('Failed to parse signals JSON:', e);
    }

    return NextResponse.json({
      success: true,
      data: {
        message_id: row.message_id,
        thread_id: row.thread_id,
        sender: row.sender,
        scored_at: row.scored_at?.value || row.scored_at,
        score: row.score,
        level: row.level,
        breakdown: {
          politeness: row.politeness,
          specificity: row.specificity,
          coverage: row.coverage,
          structure: row.structure,
          sentiment: row.sentiment,
        },
        model_version: row.model_version,
        signals,
      },
    });
  } catch (error: any) {
    console.error('❌ Reply quality API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch reply quality',
      },
      { status: 500 }
    );
  }
}


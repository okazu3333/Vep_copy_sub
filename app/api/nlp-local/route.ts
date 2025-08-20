import { NextRequest, NextResponse } from 'next/server';
import { nlpProcessor } from '@/lib/nlp-processor';

export async function POST(request: NextRequest) {
  try {
    const { text, alert_id } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'テキストが提供されていません' },
        { status: 400 }
      );
    }

    console.log(`🤖 NLP処理開始: ${alert_id || 'unknown'}`);

    // NLP処理実行
    const nlpResult = await nlpProcessor.processText(text);

    // 既存セグメントへのマッピング
    const segmentMapping = nlpProcessor.mapToExistingSegments(nlpResult);

    const result = {
      alert_id,
      nlp_result: nlpResult,
      segment_mapping: segmentMapping,
      processing_timestamp: new Date().toISOString()
    };

    console.log(`✅ NLP処理完了: ${alert_id || 'unknown'} (${nlpResult.processing_time_ms}ms)`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ NLP処理エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'NLP処理中にエラーが発生しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // NLP処理エンジンの状態を確認
    const status = nlpProcessor.getStatus();
    
    return NextResponse.json({
      status: 'success',
      nlp_engine: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 状態確認エラー:', error);
    
    return NextResponse.json(
      { 
        error: '状態確認中にエラーが発生しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 
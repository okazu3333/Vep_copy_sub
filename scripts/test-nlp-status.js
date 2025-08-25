#!/usr/bin/env node

/**
 * NLP分析状況をテスト用に更新するスクリプト
 * 実際のNLP分析パイプラインと連携する前の動作確認用
 */

const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery();

async function testNLPStatusUpdate() {
  try {
    console.log('🚀 NLP分析状況のテスト更新を開始...');

    // 1. 現在のNLP分析状況を確認
    console.log('\n📊 現在のNLP分析状況を確認中...');
    const currentStatusQuery = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN nlp_analysis_completed THEN 1 END) as nlp_completed,
        COUNT(CASE WHEN keyword_analysis_completed THEN 1 END) as keyword_completed,
        COUNT(CASE WHEN pattern_analysis_completed THEN 1 END) as pattern_completed,
        COUNT(CASE WHEN sentiment_analysis_completed THEN 1 END) as sentiment_completed,
        COUNT(CASE WHEN thread_analysis_completed THEN 1 END) as thread_completed
      FROM \`salesguard_alerts.alerts_clean_v7_dedup\`
    `;

    const [currentStatusRows] = await bigquery.query({ query: currentStatusQuery });
    const currentStatus = currentStatusRows[0];
    
    console.log('📈 現在の状況:');
    console.log(`  総メッセージ数: ${currentStatus.total_messages}`);
    console.log(`  NLP分析完了: ${currentStatus.nlp_completed}`);
    console.log(`  キーワード分析完了: ${currentStatus.keyword_completed}`);
    console.log(`  パターンマッチング完了: ${currentStatus.pattern_completed}`);
    console.log(`  感情分析完了: ${currentStatus.sentiment_completed}`);
    console.log(`  スレッド分析完了: ${currentStatus.thread_completed}`);

    // 2. テスト用の分析完了データを生成
    console.log('\n🧪 テスト用の分析完了データを生成中...');
    
    // ランダムに分析完了フラグを設定
    const testUpdateQuery = `
      UPDATE \`salesguard_alerts.alerts_clean_v7_dedup\`
      SET 
        keyword_analysis_completed = CASE 
          WHEN RAND() < 0.8 THEN TRUE 
          ELSE FALSE 
        END,
        pattern_analysis_completed = CASE 
          WHEN RAND() < 0.7 THEN TRUE 
          ELSE FALSE 
        END,
        sentiment_analysis_completed = CASE 
          WHEN RAND() < 0.6 THEN TRUE 
          ELSE FALSE 
        END,
        thread_analysis_completed = CASE 
          WHEN RAND() < 0.9 THEN TRUE 
          ELSE FALSE 
        END,
        nlp_analysis_timestamp = CURRENT_TIMESTAMP(),
        nlp_analysis_version = '1.0.0-test',
        nlp_confidence_score = RAND() * 0.5 + 0.5, -- 0.5-1.0の範囲
        nlp_analysis_quality = CASE 
          WHEN RAND() < 0.7 THEN 'high'
          WHEN RAND() < 0.9 THEN 'medium'
          ELSE 'low'
        END
      WHERE RAND() < 0.3 -- 30%のメッセージをテスト対象とする
    `;

    await bigquery.query({ query: testUpdateQuery });
    console.log('✅ テストデータの更新完了');

    // 3. 更新後の状況を確認
    console.log('\n📊 更新後のNLP分析状況を確認中...');
    const [updatedStatusRows] = await bigquery.query({ query: currentStatusQuery });
    const updatedStatus = updatedStatusRows[0];
    
    console.log('📈 更新後の状況:');
    console.log(`  総メッセージ数: ${updatedStatus.total_messages}`);
    console.log(`  NLP分析完了: ${updatedStatus.nlp_completed}`);
    console.log(`  キーワード分析完了: ${updatedStatus.keyword_completed}`);
    console.log(`  パターンマッチング完了: ${updatedStatus.pattern_completed}`);
    console.log(`  感情分析完了: ${updatedStatus.sentiment_completed}`);
    console.log(`  スレッド分析完了: ${updatedStatus.thread_completed}`);

    // 4. 全分析完了フラグを更新
    console.log('\n🔄 全分析完了フラグを更新中...');
    const completeUpdateQuery = `
      UPDATE \`salesguard_alerts.alerts_clean_v7_dedup\`
      SET nlp_analysis_completed = TRUE
      WHERE keyword_analysis_completed = TRUE 
        AND pattern_analysis_completed = TRUE 
        AND sentiment_analysis_completed = TRUE 
        AND thread_analysis_completed = TRUE
    `;

    await bigquery.query({ query: completeUpdateQuery });
    console.log('✅ 全分析完了フラグの更新完了');

    // 5. 最終確認
    console.log('\n📊 最終確認中...');
    const [finalStatusRows] = await bigquery.query({ query: currentStatusQuery });
    const finalStatus = finalStatusRows[0];
    
    console.log('🎯 最終状況:');
    console.log(`  総メッセージ数: ${finalStatus.total_messages}`);
    console.log(`  NLP分析完了: ${finalStatus.nlp_completed}`);
    console.log(`  キーワード分析完了: ${finalStatus.keyword_completed}`);
    console.log(`  パターンマッチング完了: ${finalStatus.pattern_completed}`);
    console.log(`  感情分析完了: ${finalStatus.sentiment_completed}`);
    console.log(`  スレッド分析完了: ${finalStatus.thread_completed}`);

    // 6. 信頼度スコアの統計
    console.log('\n📊 信頼度スコアの統計:');
    const confidenceQuery = `
      SELECT 
        AVG(nlp_confidence_score) as avg_confidence,
        MIN(nlp_confidence_score) as min_confidence,
        MAX(nlp_confidence_score) as max_confidence,
        COUNT(CASE WHEN nlp_confidence_score IS NOT NULL THEN 1 END) as confidence_count
      FROM \`salesguard_alerts.alerts_clean_v7_dedup\`
      WHERE nlp_confidence_score IS NOT NULL
    `;

    const [confidenceRows] = await bigquery.query({ query: confidenceQuery });
    const confidence = confidenceRows[0];
    
    console.log(`  平均信頼度: ${confidence.avg_confidence?.toFixed(3) || 'N/A'}`);
    console.log(`  最小信頼度: ${confidence.min_confidence?.toFixed(3) || 'N/A'}`);
    console.log(`  最大信頼度: ${confidence.max_confidence?.toFixed(3) || 'N/A'}`);
    console.log(`  信頼度設定済み: ${confidence.confidence_count}`);

    console.log('\n🎉 NLP分析状況のテスト更新が完了しました！');
    console.log('\n📝 次のステップ:');
    console.log('  1. レポートページでNLP分析進捗を確認');
    console.log('  2. APIエンドポイントの動作確認');
    console.log('  3. 実際のNLP分析パイプラインとの連携');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
if (require.main === module) {
  testNLPStatusUpdate();
}

module.exports = { testNLPStatusUpdate }; 
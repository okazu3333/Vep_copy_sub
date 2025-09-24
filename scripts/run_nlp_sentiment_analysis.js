const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const bq = new BigQuery({ projectId: 'viewpers' });
    
    console.log('=== NLP感情分析実行 ===');
    
    // 1. 現在の感情分析状況確認
    console.log('📊 Step 1: 現在の感情分析状況確認');
    
    const statusQuery = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN sentiment_label IS NOT NULL THEN 1 END) as analyzed_count,
        COUNT(CASE WHEN sentiment_label IS NULL AND (subject IS NOT NULL OR body_preview IS NOT NULL) THEN 1 END) as pending_count
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND primary_risk_type != 'low'
    `;
    
    const [statusResult] = await bq.query({ query: statusQuery, useLegacySql: false });
    const status = statusResult[0];
    
    console.log(`  総メッセージ数: ${status.total_messages?.toLocaleString()}件`);
    console.log(`  分析済み: ${status.analyzed_count?.toLocaleString()}件`);
    console.log(`  分析待ち: ${status.pending_count?.toLocaleString()}件`);
    
    if (status.pending_count === 0) {
      console.log('✅ 全てのメッセージが分析済みです');
      return;
    }
    
    // 2. 簡易感情分析の実装（Google Cloud Natural Language APIの代替）
    console.log('\n📊 Step 2: 簡易感情分析実行');
    
    const sentimentAnalysisQuery = `
      UPDATE \`viewpers.salesguard_alerts.unified_email_messages\`
      SET 
        sentiment_label = CASE
          -- ネガティブキーワードベース判定
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
            r'(問題|トラブル|エラー|不具合|苦情|クレーム|困っ|悩み|心配|不安|不満|怒り|腹立|イライラ|ストレス|最悪|ひどい|だめ|ダメ|無理|できない|失敗|間違い|ミス|遅れ|遅い|急い|至急|緊急|大変|困る|やばい|まずい|危険|リスク|警告|注意|解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)') 
          THEN 'negative'
          
          -- ポジティブキーワードベース判定
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
            r'(ありがとう|感謝|嬉しい|良い|いい|素晴らしい|最高|完璧|成功|達成|満足|喜び|楽しい|安心|順調|スムーズ|効果|改善|向上|優秀|優れ|推奨|おすすめ|期待|希望|前向き|ポジティブ|プラス|メリット|利益|価値|便利|簡単|快適|効率)') 
          THEN 'positive'
          
          -- デフォルトはニュートラル
          ELSE 'neutral'
        END,
        
        sentiment_score = CASE
          -- ネガティブスコア計算
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
            r'(問題|トラブル|エラー|不具合|苦情|クレーム|困っ|悩み|心配|不安|不満|怒り|腹立|イライラ|ストレス|最悪|ひどい|だめ|ダメ|無理|できない|失敗|間違い|ミス|遅れ|遅い|急い|至急|緊急|大変|困る|やばい|まずい|危険|リスク|警告|注意|解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)') 
          THEN -0.5 - (
            (REGEXP_EXTRACT_ALL(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(問題|トラブル|エラー|不具合|苦情|クレーム|困っ|悩み|心配|不安|不満|怒り|腹立|イライラ|ストレス|最悪|ひどい|だめ|ダメ|無理|できない|失敗|間違い|ミス|遅れ|遅い|急い|至急|緊急|大変|困る|やばい|まずい|危険|リスク|警告|注意|解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)') |> ARRAY_LENGTH) * 0.1
          )
          
          -- ポジティブスコア計算
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
            r'(ありがとう|感謝|嬉しい|良い|いい|素晴らしい|最高|完璧|成功|達成|満足|喜び|楽しい|安心|順調|スムーズ|効果|改善|向上|優秀|優れ|推奨|おすすめ|期待|希望|前向き|ポジティブ|プラス|メリット|利益|価値|便利|簡単|快適|効率)') 
          THEN 0.5 + (
            (REGEXP_EXTRACT_ALL(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(ありがとう|感謝|嬉しい|良い|いい|素晴らしい|最高|完璧|成功|達成|満足|喜び|楽しい|安心|順調|スムーズ|効果|改善|向上|優秀|優れ|推奨|おすすめ|期待|希望|前向き|ポジティブ|プラス|メリット|利益|価値|便利|簡単|快適|効率)') |> ARRAY_LENGTH) * 0.1
          )
          
          -- ニュートラル
          ELSE 0.0
        END,
        
        negative_flag = CASE
          WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
            r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念|苦情|クレーム|問題|トラブル|エラー|不具合|困っ|悩み|心配|不安|不満|怒り|最悪|ひどい|だめ|ダメ|無理|できない|失敗|間違い|ミス|急い|至急|緊急|大変|困る|やばい|まずい|危険)') 
          THEN true
          ELSE false
        END
        
      WHERE sentiment_label IS NULL
        AND DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND (subject IS NOT NULL OR body_preview IS NOT NULL)
    `;
    
    console.log('実行中: 簡易感情分析...');
    const [updateJob] = await bq.createQueryJob({
      query: sentimentAnalysisQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });
    
    await updateJob.getQueryResults();
    const [updateMeta] = await updateJob.getMetadata();
    const updatedRows = updateMeta.statistics?.query?.numDmlAffectedRows || 0;
    console.log(`✅ 感情分析完了: ${updatedRows}件更新`);
    
    // 3. 分析結果確認
    console.log('\n📊 Step 3: 分析結果確認');
    
    const resultQuery = `
      SELECT 
        COUNT(*) as total_analyzed,
        COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_count,
        COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment_label = 'neutral' THEN 1 END) as neutral_count,
        COUNT(CASE WHEN negative_flag = true THEN 1 END) as negative_flag_count,
        ROUND(AVG(sentiment_score), 3) as avg_sentiment_score,
        MIN(sentiment_score) as min_score,
        MAX(sentiment_score) as max_score
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND sentiment_label IS NOT NULL
    `;
    
    const [resultData] = await bq.query({ query: resultQuery, useLegacySql: false });
    const result = resultData[0];
    
    console.log('📈 感情分析結果:');
    console.log(`  総分析済み: ${result.total_analyzed?.toLocaleString()}件`);
    console.log(`  ネガティブ: ${result.negative_count?.toLocaleString()}件 (${((result.negative_count/result.total_analyzed)*100).toFixed(1)}%)`);
    console.log(`  ポジティブ: ${result.positive_count?.toLocaleString()}件 (${((result.positive_count/result.total_analyzed)*100).toFixed(1)}%)`);
    console.log(`  ニュートラル: ${result.neutral_count?.toLocaleString()}件 (${((result.neutral_count/result.total_analyzed)*100).toFixed(1)}%)`);
    console.log(`  ネガティブフラグ: ${result.negative_flag_count?.toLocaleString()}件`);
    console.log(`  平均スコア: ${result.avg_sentiment_score}`);
    console.log(`  スコア範囲: ${result.min_score} ～ ${result.max_score}`);
    
    // 4. サンプル表示
    console.log('\n📊 Step 4: 感情分析サンプル表示');
    
    const sampleQuery = `
      SELECT 
        subject,
        body_preview,
        sentiment_label,
        sentiment_score,
        negative_flag,
        score as risk_score
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND sentiment_label IS NOT NULL
        AND primary_risk_type != 'low'
      ORDER BY ABS(sentiment_score) DESC
      LIMIT 10
    `;
    
    const [samples] = await bq.query({ query: sampleQuery, useLegacySql: false });
    
    console.log('感情分析サンプル（感情スコア順）:');
    samples.forEach((sample, i) => {
      console.log(`  ${i+1}. [${sample.sentiment_label}] スコア${sample.sentiment_score} | リスク${sample.risk_score} | ネガフラグ${sample.negative_flag}`);
      console.log(`     件名: ${sample.subject?.substring(0, 60)}...`);
      console.log(`     本文: ${sample.body_preview?.substring(0, 80)}...`);
      console.log('');
    });
    
    console.log('🎯 次のステップ:');
    console.log('1. NLP感情分析結果を活用したセグメント検知の実行');
    console.log('2. APIでのセグメント検知ロジック統合');
    console.log('3. UIでの感情分析結果表示');
    console.log('4. より高精度なGoogle Cloud Natural Language API統合（オプション）');
    
  } catch (e) {
    console.error('NLP感情分析エラー:', e?.message || e);
    process.exit(1);
  }
})(); 
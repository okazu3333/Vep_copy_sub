const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const bq = new BigQuery({ projectId: 'viewpers' });
    
    console.log('=== NLP活用セグメント検知ロジック実装 ===');
    
    // 1. 現在のデータ状況確認
    console.log('📊 Step 1: 現在のデータ状況確認');
    
    const dataStatusQuery = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN primary_risk_type != 'low' THEN 1 END) as risk_messages,
        COUNT(CASE WHEN sentiment_label IS NOT NULL THEN 1 END) as sentiment_analyzed,
        COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_sentiment,
        COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_sentiment,
        COUNT(CASE WHEN sentiment_label = 'neutral' THEN 1 END) as neutral_sentiment,
        ROUND(AVG(CASE WHEN sentiment_score IS NOT NULL THEN sentiment_score END), 3) as avg_sentiment_score,
        COUNT(CASE WHEN negative_flag = true THEN 1 END) as negative_flag_count
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY)
    `;
    
    const [dataStatus] = await bq.query({ query: dataStatusQuery, useLegacySql: false });
    const stats = dataStatus[0];
    
    console.log('📈 データ状況:');
    console.log(`  総メッセージ数: ${stats.total_messages?.toLocaleString()}件`);
    console.log(`  リスクメッセージ: ${stats.risk_messages?.toLocaleString()}件 (${((stats.risk_messages/stats.total_messages)*100).toFixed(1)}%)`);
    console.log(`  感情分析済み: ${stats.sentiment_analyzed?.toLocaleString()}件 (${((stats.sentiment_analyzed/stats.total_messages)*100).toFixed(1)}%)`);
    console.log(`  ネガティブ: ${stats.negative_sentiment?.toLocaleString()}件`);
    console.log(`  ポジティブ: ${stats.positive_sentiment?.toLocaleString()}件`);
    console.log(`  ニュートラル: ${stats.neutral_sentiment?.toLocaleString()}件`);
    console.log(`  平均感情スコア: ${stats.avg_sentiment_score}`);
    console.log(`  ネガティブフラグ: ${stats.negative_flag_count?.toLocaleString()}件`);
    
    // 2. NLP + キーワードベースのセグメント検知ロジック実装
    console.log('\n📊 Step 2: NLP + キーワードベースセグメント検知');
    
    const segmentDetectionQuery = `
      WITH SegmentAnalysis AS (
        SELECT 
          message_id,
          subject,
          body_preview,
          sentiment_label,
          sentiment_score,
          negative_flag,
          primary_risk_type,
          score,
          direction,
          company_domain,
          
          -- 失注・解約セグメント (NLP + キーワード)
          CASE 
            WHEN (
              sentiment_label = 'negative' 
              AND sentiment_score < -0.3
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念|解除|取り消し)')
            ) OR (
              negative_flag = true
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約.*決定|キャンセル.*確定|契約.*終了|サービス.*停止)')
            )
            THEN true 
            ELSE false 
          END as seg_lose,
          
          -- 競合比較セグメント (NLP + キーワード)
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'negative')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(競合|他社|比較|検討|相見積|vs|対抗|選定|評価|ベンダー)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(他社.*提案|競合.*比較|価格.*比較|機能.*比較)')
            )
            THEN true 
            ELSE false 
          END as seg_rival,
          
          -- 追加要望セグメント (NLP + キーワード)
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'positive')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(追加|オプション|機能|要望|改善|拡張|カスタマイズ|新機能|アップグレード)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(機能.*追加|オプション.*検討|カスタマイズ.*希望)')
            )
            THEN true 
            ELSE false 
          END as seg_addreq,
          
          -- 更新・継続セグメント (NLP + キーワード)
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'positive')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(更新|継続|契約|延長|リニューアル|再契約|期限|満了)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(契約.*更新|サービス.*継続|ライセンス.*延長)')
            )
            THEN true 
            ELSE false 
          END as seg_renewal
          
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY)
          AND primary_risk_type != 'low'
      )
      SELECT 
        COUNT(*) as total_risk_messages,
        COUNT(CASE WHEN seg_lose = true THEN 1 END) as lose_count,
        COUNT(CASE WHEN seg_rival = true THEN 1 END) as rival_count,
        COUNT(CASE WHEN seg_addreq = true THEN 1 END) as addreq_count,
        COUNT(CASE WHEN seg_renewal = true THEN 1 END) as renewal_count,
        COUNT(CASE WHEN seg_lose = true OR seg_rival = true OR seg_addreq = true OR seg_renewal = true THEN 1 END) as categorized_count
      FROM SegmentAnalysis
    `;
    
    const [segmentResult] = await bq.query({ query: segmentDetectionQuery, useLegacySql: false });
    const segStats = segmentResult[0];
    
    console.log('🎯 NLP + キーワードベース検知結果:');
    console.log(`  総リスクメッセージ: ${segStats.total_risk_messages?.toLocaleString()}件`);
    console.log(`  失注・解約: ${segStats.lose_count?.toLocaleString()}件 (${((segStats.lose_count/segStats.total_risk_messages)*100).toFixed(1)}%)`);
    console.log(`  競合比較: ${segStats.rival_count?.toLocaleString()}件 (${((segStats.rival_count/segStats.total_risk_messages)*100).toFixed(1)}%)`);
    console.log(`  追加要望: ${segStats.addreq_count?.toLocaleString()}件 (${((segStats.addreq_count/segStats.total_risk_messages)*100).toFixed(1)}%)`);
    console.log(`  更新・継続: ${segStats.renewal_count?.toLocaleString()}件 (${((segStats.renewal_count/segStats.total_risk_messages)*100).toFixed(1)}%)`);
    console.log(`  カテゴライズ済み: ${segStats.categorized_count?.toLocaleString()}件 (${((segStats.categorized_count/segStats.total_risk_messages)*100).toFixed(1)}%)`);
    
    // 3. セグメント別サンプル表示
    console.log('\n📊 Step 3: セグメント別サンプル表示');
    
    const segments = [
      { name: '失注・解約', condition: 'seg_lose = true', priority: 'critical' },
      { name: '競合比較', condition: 'seg_rival = true', priority: 'high' },
      { name: '追加要望', condition: 'seg_addreq = true', priority: 'medium' },
      { name: '更新・継続', condition: 'seg_renewal = true', priority: 'high' }
    ];
    
    for (const segment of segments) {
      console.log(`\n🔍 ${segment.name} セグメントサンプル (優先度: ${segment.priority}):`);
      
      const sampleQuery = `
        WITH SegmentAnalysis AS (
          SELECT 
            message_id,
            subject,
            body_preview,
            sentiment_label,
            sentiment_score,
            negative_flag,
            score,
            direction,
            company_domain,
            
            -- 失注・解約セグメント
            CASE 
              WHEN (
                sentiment_label = 'negative' 
                AND sentiment_score < -0.3
                AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念|解除|取り消し)')
              ) OR (
                negative_flag = true
                AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)')
              ) OR (
                REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(解約.*決定|キャンセル.*確定|契約.*終了|サービス.*停止)')
              )
              THEN true 
              ELSE false 
            END as seg_lose,
            
            -- 競合比較セグメント
            CASE 
              WHEN (
                sentiment_label IN ('neutral', 'negative')
                AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(競合|他社|比較|検討|相見積|vs|対抗|選定|評価|ベンダー)')
              ) OR (
                REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(他社.*提案|競合.*比較|価格.*比較|機能.*比較)')
              )
              THEN true 
              ELSE false 
            END as seg_rival,
            
            -- 追加要望セグメント
            CASE 
              WHEN (
                sentiment_label IN ('neutral', 'positive')
                AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(追加|オプション|機能|要望|改善|拡張|カスタマイズ|新機能|アップグレード)')
              ) OR (
                REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(機能.*追加|オプション.*検討|カスタマイズ.*希望)')
              )
              THEN true 
              ELSE false 
            END as seg_addreq,
            
            -- 更新・継続セグメント
            CASE 
              WHEN (
                sentiment_label IN ('neutral', 'positive')
                AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(更新|継続|契約|延長|リニューアル|再契約|期限|満了)')
              ) OR (
                REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                  r'(契約.*更新|サービス.*継続|ライセンス.*延長)')
              )
              THEN true 
              ELSE false 
            END as seg_renewal
            
          FROM \`viewpers.salesguard_alerts.unified_email_messages\`
          WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            AND primary_risk_type != 'low'
        )
        SELECT 
          subject,
          body_preview,
          sentiment_label,
          sentiment_score,
          negative_flag,
          score,
          direction,
          company_domain
        FROM SegmentAnalysis
        WHERE ${segment.condition}
        ORDER BY score DESC
        LIMIT 5
      `;
      
      const [samples] = await bq.query({ query: sampleQuery, useLegacySql: false });
      
      if (samples.length === 0) {
        console.log('  該当するサンプルがありません');
      } else {
        samples.forEach((sample, i) => {
          console.log(`  ${i+1}. [${sample.sentiment_label}] スコア${sample.score} (${sample.direction})`);
          console.log(`     件名: ${sample.subject?.substring(0, 60)}...`);
          console.log(`     本文: ${sample.body_preview?.substring(0, 80)}...`);
          console.log(`     感情: ${sample.sentiment_score} | ネガフラグ: ${sample.negative_flag} | ドメイン: ${sample.company_domain}`);
          console.log('');
        });
      }
    }
    
    // 4. API実装用のSQLクエリ生成
    console.log('\n📊 Step 4: API実装用SQLクエリ生成');
    
    const apiSegmentQuery = `
      -- セグメント検知用のCTE（APIで使用）
      WITH SegmentDetection AS (
        SELECT 
          message_id,
          
          -- 失注・解約セグメント (NLP + キーワード)
          CASE 
            WHEN (
              sentiment_label = 'negative' 
              AND sentiment_score < -0.3
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念|解除|取り消し)')
            ) OR (
              negative_flag = true
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(解約.*決定|キャンセル.*確定|契約.*終了|サービス.*停止)')
            )
            THEN true 
            ELSE false 
          END as seg_lose,
          
          -- 競合比較セグメント (NLP + キーワード)
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'negative')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(競合|他社|比較|検討|相見積|vs|対抗|選定|評価|ベンダー)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(他社.*提案|競合.*比較|価格.*比較|機能.*比較)')
            )
            THEN true 
            ELSE false 
          END as seg_rival,
          
          -- 追加要望セグメント (NLP + キーワード)
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'positive')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(追加|オプション|機能|要望|改善|拡張|カスタマイズ|新機能|アップグレード)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(機能.*追加|オプション.*検討|カスタマイズ.*希望)')
            )
            THEN true 
            ELSE false 
          END as seg_addreq,
          
          -- 更新・継続セグメント (NLP + キーワード)
          CASE 
            WHEN (
              sentiment_label IN ('neutral', 'positive')
              AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(更新|継続|契約|延長|リニューアル|再契約|期限|満了)')
            ) OR (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(契約.*更新|サービス.*継続|ライセンス.*延長)')
            )
            THEN true 
            ELSE false 
          END as seg_renewal
          
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE DATE(datetime) >= @start_date
          AND DATE(datetime) < @end_date
          AND primary_risk_type != 'low'
      )
      SELECT 
        COUNT(CASE WHEN seg_lose = true THEN 1 END) as lose_count,
        COUNT(CASE WHEN seg_rival = true THEN 1 END) as rival_count,
        COUNT(CASE WHEN seg_addreq = true THEN 1 END) as addreq_count,
        COUNT(CASE WHEN seg_renewal = true THEN 1 END) as renewal_count
      FROM SegmentDetection
    `;
    
    console.log('✅ API実装用SQLクエリ準備完了');
    console.log('');
    console.log('🔧 実装推奨事項:');
    console.log('1. NLP感情分析結果（sentiment_label, sentiment_score, negative_flag）を活用');
    console.log('2. キーワードマッチングと感情分析の組み合わせで精度向上');
    console.log('3. 文脈を考慮した複合パターンマッチング');
    console.log('4. セグメント優先度に基づくアラート分類');
    console.log('5. リアルタイム検知のためのAPI統合');
    
    // 5. 改善提案
    console.log('\n💡 Step 5: 検知精度改善提案');
    
    if (segStats.total_risk_messages === 0) {
      console.log('⚠️ 問題: リスクメッセージが0件です');
      console.log('対策:');
      console.log('  1. primary_risk_type の判定基準を緩和');
      console.log('  2. score の閾値を下げる (例: score > 5)');
      console.log('  3. 日付範囲を拡大して確認');
    } else if (segStats.categorized_count < segStats.total_risk_messages * 0.3) {
      console.log('⚠️ 問題: セグメント分類率が低い (30%未満)');
      console.log('対策:');
      console.log('  1. キーワードパターンを拡張');
      console.log('  2. NLP感情分析の閾値を調整');
      console.log('  3. 表記ゆれ対応を強化');
    } else {
      console.log('✅ セグメント検知が正常に動作しています');
      console.log(`分類率: ${((segStats.categorized_count/segStats.total_risk_messages)*100).toFixed(1)}%`);
    }
    
    console.log('\n🎯 次のステップ:');
    console.log('1. APIにNLP + キーワードベースセグメント検知を統合');
    console.log('2. UIでセグメント別フィルタリング機能を有効化');
    console.log('3. セグメント別アラート優先度の設定');
    console.log('4. 管理者向けセグメント分析ダッシュボード実装');
    
  } catch (e) {
    console.error('NLPセグメント検知エラー:', e?.message || e);
    process.exit(1);
  }
})(); 
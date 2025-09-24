const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const bq = new BigQuery({ projectId: 'viewpers' });
    
    console.log('=== セグメント検知ロジック分析・テスト ===');
    
    // 1. 現在のデータサンプル確認
    console.log('📊 Step 1: 現在のデータサンプル確認');
    const sampleQuery = `
      SELECT 
        message_id,
        subject,
        body_preview,
        primary_risk_type,
        score,
        company_domain,
        direction
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND (
          REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'(解約|キャンセル|中止|やめ|辞め)')
          OR REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'(競合|他社|比較|検討)')
          OR REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'(追加|オプション|機能|要望)')
          OR REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'(更新|継続|契約|延長)')
        )
      ORDER BY score DESC
      LIMIT 10
    `;
    
    const [sampleResult] = await bq.query({ query: sampleQuery, useLegacySql: false });
    console.log(`  マッチしたメッセージ: ${sampleResult.length}件`);
    
    sampleResult.forEach((row, i) => {
      console.log(`  ${i+1}. [${row.primary_risk_type}] スコア${row.score}: ${row.subject?.substring(0, 50)}...`);
      console.log(`     本文: ${row.body_preview?.substring(0, 100)}...`);
      console.log(`     ドメイン: ${row.company_domain} (${row.direction})`);
      console.log('');
    });
    
    // 2. セグメント別検知テスト
    console.log('📊 Step 2: セグメント別検知テスト');
    
    const segmentTests = [
      {
        name: '失注・解約 (lose)',
        keywords: ['解約', 'キャンセル', '中止', 'やめ', '辞め', '終了', '停止', '見送り', '断念'],
        regex: '(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)'
      },
      {
        name: '競合比較 (rival)', 
        keywords: ['競合', '他社', '比較', '検討', '相見積', 'vs', '対抗'],
        regex: '(競合|他社|比較|検討|相見積|vs|対抗)'
      },
      {
        name: '追加要望 (addreq)',
        keywords: ['追加', 'オプション', '機能', '要望', '改善', '拡張', 'カスタマイズ'],
        regex: '(追加|オプション|機能|要望|改善|拡張|カスタマイズ)'
      },
      {
        name: '更新・継続 (renewal)',
        keywords: ['更新', '継続', '契約', '延長', 'リニューアル', '再契約'],
        regex: '(更新|継続|契約|延長|リニューアル|再契約)'
      }
    ];
    
    for (const segment of segmentTests) {
      console.log(`\n🔍 ${segment.name} セグメント検知テスト:`);
      
      const testQuery = `
        SELECT 
          COUNT(*) as total_matches,
          COUNT(DISTINCT message_id) as unique_messages,
          COUNT(CASE WHEN primary_risk_type != 'low' THEN 1 END) as risk_matches,
          ROUND(AVG(score), 1) as avg_score,
          COUNT(CASE WHEN direction = 'external' THEN 1 END) as external_matches,
          COUNT(CASE WHEN direction = 'internal' THEN 1 END) as internal_matches
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
          AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'${segment.regex}')
      `;
      
      const [testResult] = await bq.query({ query: testQuery, useLegacySql: false });
      const stats = testResult[0];
      
      console.log(`  総マッチ数: ${stats.total_matches}件`);
      console.log(`  ユニークメッセージ: ${stats.unique_messages}件`);
      console.log(`  リスクメッセージ: ${stats.risk_matches}件`);
      console.log(`  平均スコア: ${stats.avg_score}`);
      console.log(`  外部: ${stats.external_matches}件, 内部: ${stats.internal_matches}件`);
      
      // サンプル表示
      if (stats.total_matches > 0) {
        const sampleQuery = `
          SELECT 
            subject,
            body_preview,
            score,
            direction,
            company_domain
          FROM \`viewpers.salesguard_alerts.unified_email_messages\`
          WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
            AND REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'${segment.regex}')
          ORDER BY score DESC
          LIMIT 3
        `;
        
        const [samples] = await bq.query({ query: sampleQuery, useLegacySql: false });
        console.log('  サンプル:');
        samples.forEach((sample, i) => {
          console.log(`    ${i+1}. [${sample.direction}] スコア${sample.score}: ${sample.subject?.substring(0, 40)}...`);
        });
      }
    }
    
    // 3. 現在のAPI実装との比較
    console.log('\n📊 Step 3: 現在のAPI実装チェック');
    
    const apiTestQuery = `
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'(解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念)') THEN 1 END) as lose_count,
        COUNT(CASE WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'(競合|他社|比較|検討|相見積|vs|対抗)') THEN 1 END) as rival_count,
        COUNT(CASE WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'(追加|オプション|機能|要望|改善|拡張|カスタマイズ)') THEN 1 END) as addreq_count,
        COUNT(CASE WHEN REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), r'(更新|継続|契約|延長|リニューアル|再契約)') THEN 1 END) as renewal_count
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY)
        AND primary_risk_type != 'low'
    `;
    
    const [apiResult] = await bq.query({ query: apiTestQuery, useLegacySql: false });
    const apiStats = apiResult[0];
    
    console.log('API実装での検知結果 (過去120日):');
    console.log(`  総アラート数: ${apiStats.total_alerts}件`);
    console.log(`  失注・解約: ${apiStats.lose_count}件 (${((apiStats.lose_count/apiStats.total_alerts)*100).toFixed(1)}%)`);
    console.log(`  競合比較: ${apiStats.rival_count}件 (${((apiStats.rival_count/apiStats.total_alerts)*100).toFixed(1)}%)`);
    console.log(`  追加要望: ${apiStats.addreq_count}件 (${((apiStats.addreq_count/apiStats.total_alerts)*100).toFixed(1)}%)`);
    console.log(`  更新・継続: ${apiStats.renewal_count}件 (${((apiStats.renewal_count/apiStats.total_alerts)*100).toFixed(1)}%)`);
    
    // 4. 改善提案
    console.log('\n💡 Step 4: 検知ロジック改善提案');
    
    if (apiStats.total_alerts === 0) {
      console.log('⚠️ 問題: リスクアラートが0件です');
      console.log('原因候補:');
      console.log('  1. primary_risk_type の判定ロジックが厳しすぎる');
      console.log('  2. score の閾値が高すぎる');
      console.log('  3. データの日付範囲が適切でない');
      
      // 全データでの確認
      const allDataQuery = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN primary_risk_type != 'low' THEN 1 END) as risk_messages,
          COUNT(CASE WHEN score > 0 THEN 1 END) as scored_messages,
          ROUND(AVG(score), 1) as avg_score,
          MAX(score) as max_score,
          MIN(score) as min_score
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY)
      `;
      
      const [allDataResult] = await bq.query({ query: allDataQuery, useLegacySql: false });
      const allStats = allDataResult[0];
      
      console.log('\n📊 全データ分析:');
      console.log(`  総メッセージ数: ${allStats.total_messages}件`);
      console.log(`  リスクメッセージ: ${allStats.risk_messages}件 (${((allStats.risk_messages/allStats.total_messages)*100).toFixed(1)}%)`);
      console.log(`  スコア付きメッセージ: ${allStats.scored_messages}件`);
      console.log(`  平均スコア: ${allStats.avg_score}, 最大: ${allStats.max_score}, 最小: ${allStats.min_score}`);
    }
    
    // 5. 推奨設定
    console.log('\n🎯 Step 5: 推奨セグメント設定');
    
    const recommendations = [
      {
        segment: '失注・解約 (lose)',
        keywords: '解約|キャンセル|中止|やめ|辞め|終了|停止|見送り|断念|解除',
        priority: 'high',
        action: '即座にマネージャーへエスカレート'
      },
      {
        segment: '競合比較 (rival)',
        keywords: '競合|他社|比較|検討|相見積|vs|対抗|選定|評価',
        priority: 'medium',
        action: '営業チームで対応戦略検討'
      },
      {
        segment: '追加要望 (addreq)',
        keywords: '追加|オプション|機能|要望|改善|拡張|カスタマイズ|新機能',
        priority: 'medium',
        action: 'プロダクトチームと連携'
      },
      {
        segment: '更新・継続 (renewal)',
        keywords: '更新|継続|契約|延長|リニューアル|再契約|期限',
        priority: 'high',
        action: 'アカウントマネージャーでフォロー'
      }
    ];
    
    recommendations.forEach(rec => {
      console.log(`\n📋 ${rec.segment}:`);
      console.log(`  キーワード: ${rec.keywords}`);
      console.log(`  優先度: ${rec.priority}`);
      console.log(`  推奨アクション: ${rec.action}`);
    });
    
    console.log('\n🔧 実装推奨事項:');
    console.log('1. primary_risk_type の判定基準を緩和 (score > 10 → score > 5)');
    console.log('2. セグメント検知を subject + body_preview の組み合わせで実行');
    console.log('3. 日本語の表記ゆれに対応 (ひらがな・カタカナ・漢字)');
    console.log('4. 否定文の除外ロジック追加 ("解約しない" などを除外)');
    console.log('5. 文脈を考慮した検知 (前後の文章も含めて判定)');
    
  } catch (e) {
    console.error('分析エラー:', e?.message || e);
    process.exit(1);
  }
})(); 
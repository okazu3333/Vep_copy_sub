const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({ projectId: 'viewpers' });

async function testSegmentLogic() {
  console.log('🔍 セグメント検知ロジックのテスト...');

  try {
    // 実際のセグメント検知クエリをテスト
    const testQuery = `
      SELECT 
        subject,
        sentiment_score,
        negative_flag,
        body_preview,
        -- 新しいセグメント検知ロジック（優先度順・排他的・ノイズ除去強化）
        CASE 
          -- 🔴 緊急対応（最優先）
          WHEN (
            -- キーワード条件
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(緊急|至急|すぐに|急いで|早急|まだですか|いつまで|催促|返事がない|問題|トラブル|不具合|エラー|困っている)')
            AND (
              -- 感情条件（いずれかが必要）
              sentiment_score < -0.5 OR
              negative_flag = true OR
              -- 文脈条件
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(対応.*お願い|早急.*対応|至急.*連絡)')
            )
            AND (
              -- 除外条件（ノイズ除去）
              NOT REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(ありがとう|感謝|お疲れ様|セミナー|案内)')
            )
          ) THEN 'urgent_response'
          
          -- 🟠 解約リスク（第2優先）
          WHEN (
            -- キーワード条件
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(解約|キャンセル|中止|やめ|終了|停止|見送り|断念)')
            AND (
              -- 感情条件（必須）
              sentiment_score < -0.3 OR negative_flag = true
            )
            AND (
              -- 除外条件（ノイズ除去）
              NOT REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(ありがとう|感謝|お疲れ様|退職|挨拶)')
            )
          ) THEN 'churn_risk'
          
          -- 🟡 競合脅威（第3優先）
          WHEN (
            -- キーワード条件
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(競合|他社|比較|検討|相見積|vs|対抗|選定|評価|ベンダー)')
            AND (
              -- 文脈条件（いずれかが必要）
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(価格.*比較|機能.*比較|他社.*検討|乗り換え)') OR
              sentiment_score < 0 OR
              -- 長さ条件（短すぎる挨拶メールを除外）
              LENGTH(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')) > 50
            )
          ) THEN 'competitive_threat'
          
          -- 🔵 契約関連（第4優先）
          WHEN (
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(更新|継続|契約|延長|リニューアル|再契約|期限|満了)')
            AND LENGTH(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')) > 30  -- 短すぎるメールを除外
          ) THEN 'contract_related'
          
          -- 🟢 売上機会（第5優先）
          WHEN (
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(追加|拡張|新機能|アップグレード|オプション|新規|別の部署|グループ会社)')
            AND (sentiment_score >= 0 OR sentiment_score IS NULL)  -- ポジティブまたは中立のみ
          ) THEN 'revenue_opportunity'
          
          ELSE NULL
        END as detected_segment
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE subject = 'Re: 昨夜はありがとうございました'
      LIMIT 5
    `;

    const [rows] = await bigquery.query({ query: testQuery, useLegacySql: false });
    
    console.log('\n📊 テスト結果:');
    rows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.subject}`);
      console.log(`   sentiment_score: ${row.sentiment_score}`);
      console.log(`   negative_flag: ${row.negative_flag}`);
      console.log(`   body_preview: ${row.body_preview ? 'あり' : 'なし'}`);
      console.log(`   detected_segment: ${row.detected_segment}`);
    });

    // 全体のセグメント分布も確認
    const countQuery = `
      SELECT 
        CASE 
          WHEN (
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(緊急|至急|すぐに|急いで|早急|まだですか|いつまで|催促|返事がない|問題|トラブル|不具合|エラー|困っている)')
            AND (
              sentiment_score < -0.5 OR
              negative_flag = true OR
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(対応.*お願い|早急.*対応|至急.*連絡)')
            )
            AND (
              NOT REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(ありがとう|感謝|お疲れ様|セミナー|案内)')
            )
          ) THEN 'urgent_response'
          
          WHEN (
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(解約|キャンセル|中止|やめ|終了|停止|見送り|断念)')
            AND (
              sentiment_score < -0.3 OR negative_flag = true
            )
            AND (
              NOT REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(ありがとう|感謝|お疲れ様|退職|挨拶)')
            )
          ) THEN 'churn_risk'
          
          WHEN (
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(競合|他社|比較|検討|相見積|vs|対抗|選定|評価|ベンダー)')
            AND (
              REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
                r'(価格.*比較|機能.*比較|他社.*検討|乗り換え)') OR
              sentiment_score < 0 OR
              LENGTH(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')) > 50
            )
          ) THEN 'competitive_threat'
          
          WHEN (
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(更新|継続|契約|延長|リニューアル|再契約|期限|満了)')
            AND LENGTH(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')) > 30
          ) THEN 'contract_related'
          
          WHEN (
            REGEXP_CONTAINS(LOWER(COALESCE(subject, '') || ' ' || COALESCE(body_preview, '')), 
              r'(追加|拡張|新機能|アップグレード|オプション|新規|別の部署|グループ会社)')
            AND (sentiment_score >= 0 OR sentiment_score IS NULL)
          ) THEN 'revenue_opportunity'
          
          ELSE NULL
        END as segment,
        COUNT(*) as count
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      GROUP BY 1
      ORDER BY count DESC
    `;

    const [countRows] = await bigquery.query({ query: countQuery, useLegacySql: false });
    
    console.log('\n📈 セグメント分布:');
    countRows.forEach(row => {
      console.log(`   ${row.segment || 'NULL'}: ${row.count.toLocaleString()}件`);
    });

  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

testSegmentLogic();




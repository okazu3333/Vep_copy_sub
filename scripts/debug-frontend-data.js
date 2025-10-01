const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function debugFrontendData() {
  try {
    console.log('🔍 フロントエンドデータのデバッグ...');

    // APIと同じクエリを実行
    const debugQuery = `
      WITH SegmentDetection AS (
        SELECT
          message_id,
          subject,
          sentiment_label,
          sentiment_score,
          negative_flag,
          primary_risk_type,
          
          -- 新しいセグメント検知ロジック
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
          END as primary_segment
          
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE primary_risk_type != 'low'
        LIMIT 10
      )
      SELECT 
        message_id,
        subject,
        primary_segment,
        sentiment_score,
        negative_flag,
        -- 緊急度スコア計算
        CASE 
          WHEN primary_segment = 'urgent_response' THEN 50
          WHEN primary_segment = 'churn_risk' THEN 40
          WHEN primary_segment = 'competitive_threat' THEN 25
          WHEN primary_segment = 'contract_related' THEN 15
          WHEN primary_segment = 'revenue_opportunity' THEN 10
          ELSE 0
        END +
        CASE 
          WHEN sentiment_score < -0.6 THEN 40
          WHEN sentiment_score < -0.3 THEN 25
          WHEN sentiment_score < 0 THEN 10
          ELSE 0
        END +
        CASE WHEN negative_flag = true THEN 10 ELSE 0 END as urgency_score
      FROM SegmentDetection
      WHERE primary_segment IS NOT NULL
    `;

    const [rows] = await bigquery.query({
      query: debugQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log('\n📊 デバッグ結果:');
    rows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.subject}`);
      console.log(`   primary_segment: ${row.primary_segment}`);
      console.log(`   urgency_score: ${row.urgency_score}`);
      console.log(`   sentiment_score: ${row.sentiment_score}`);
      console.log(`   negative_flag: ${row.negative_flag}`);
      console.log(`   フィルタ通過: ${row.urgency_score >= 30 ? '✅ YES' : '❌ NO'}`);
    });

    console.log(`\n📈 統計:`);
    console.log(`   総件数: ${rows.length}`);
    console.log(`   30点以上: ${rows.filter(r => r.urgency_score >= 30).length}件`);
    console.log(`   セグメント別:`);
    
    const segmentCounts = {};
    rows.forEach(row => {
      if (row.primary_segment) {
        segmentCounts[row.primary_segment] = (segmentCounts[row.primary_segment] || 0) + 1;
      }
    });
    
    Object.entries(segmentCounts).forEach(([segment, count]) => {
      console.log(`     ${segment}: ${count}件`);
    });

  } catch (error) {
    console.error('❌ デバッグエラー:', error);
    throw error;
  }
}

if (require.main === module) {
  debugFrontendData()
    .catch(error => {
      console.error('💥 デバッグ失敗:', error);
      process.exit(1);
    });
}

module.exports = { debugFrontendData };


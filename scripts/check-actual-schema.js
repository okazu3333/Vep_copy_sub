const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function checkActualSchema() {
  try {
    console.log('🔍 実際のテーブル構造を確認中...');

    // 全カラム構造確認
    const schemaQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM \`viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'unified_email_messages'
      ORDER BY ordinal_position
    `;

    const [schema] = await bigquery.query({
      query: schemaQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log('\n📋 全カラム構造:');
    schema.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });

    // サンプルデータで確認
    const sampleQuery = `
      SELECT 
        message_id,
        subject,
        sentiment_label,
        sentiment_score,
        negative_flag,
        primary_segment,
        segment_confidence
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE subject IS NOT NULL
      LIMIT 5
    `;

    const [samples] = await bigquery.query({
      query: sampleQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log('\n📊 サンプルデータ:');
    samples.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.subject}`);
      console.log(`     sentiment: ${row.sentiment_label} (${row.sentiment_score})`);
      console.log(`     negative_flag: ${row.negative_flag}`);
      console.log(`     primary_segment: ${row.primary_segment || 'NULL'}`);
      console.log(`     segment_confidence: ${row.segment_confidence || 'NULL'}`);
      console.log('');
    });

    console.log('✅ テーブル構造確認完了！');
    return { success: true, schema, samples };

  } catch (error) {
    console.error('❌ テーブル構造確認エラー:', error);
    throw error;
  }
}

if (require.main === module) {
  checkActualSchema()
    .catch(error => {
      console.error('💥 確認失敗:', error);
      process.exit(1);
    });
}

module.exports = { checkActualSchema };




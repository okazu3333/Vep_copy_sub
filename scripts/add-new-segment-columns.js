const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function addNewSegmentColumns() {
  try {
    console.log('🔧 新しいセグメントカラムを追加中...');

    // 1. 新しいカラムを追加
    const alterTableQuery = `
      ALTER TABLE \`viewpers.salesguard_alerts.unified_email_messages\`
      ADD COLUMN IF NOT EXISTS primary_segment STRING,
      ADD COLUMN IF NOT EXISTS segment_confidence FLOAT64
    `;

    await bigquery.query({
      query: alterTableQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log('✅ 新しいカラム追加完了');

    // 2. テーブル構造確認
    const schemaQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM \`viewpers.salesguard_alerts.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'unified_email_messages'
        AND column_name IN ('primary_segment', 'segment_confidence', 'seg_lose', 'seg_rival', 'seg_addreq', 'seg_renewal')
      ORDER BY column_name
    `;

    const [schema] = await bigquery.query({
      query: schemaQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log('\n📋 セグメント関連カラム:');
    schema.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });

    // 3. サンプルデータで確認
    const sampleQuery = `
      SELECT 
        message_id,
        subject,
        primary_segment,
        segment_confidence,
        seg_lose,
        seg_rival,
        seg_addreq,
        seg_renewal
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      LIMIT 3
    `;

    const [samples] = await bigquery.query({
      query: sampleQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log('\n📊 サンプルデータ:');
    samples.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.message_id}`);
      console.log(`     primary_segment: ${row.primary_segment || 'NULL'}`);
      console.log(`     segment_confidence: ${row.segment_confidence || 'NULL'}`);
      console.log(`     旧セグメント: lose=${row.seg_lose}, rival=${row.seg_rival}, addreq=${row.seg_addreq}, renewal=${row.seg_renewal}`);
    });

    console.log('\n🎉 スキーマ拡張完了！');
    return { success: true };

  } catch (error) {
    console.error('❌ スキーマ拡張エラー:', error);
    throw error;
  }
}

if (require.main === module) {
  addNewSegmentColumns()
    .then(() => {
      console.log('\n✅ Phase 1 完了: BigQueryスキーマ拡張');
      console.log('次は新しいセグメント検知ロジックの実装です。');
    })
    .catch(error => {
      console.error('💥 Phase 1 失敗:', error);
      process.exit(1);
    });
}

module.exports = { addNewSegmentColumns };


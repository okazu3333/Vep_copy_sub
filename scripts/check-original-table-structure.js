const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function checkOriginalTableStructure() {
  try {
    console.log('🔍 元データテーブルの構造を確認中...\n');

    // mbox_emailsテーブルの構造を確認
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM \`viewpers.salesguard_data.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'mbox_emails'
      ORDER BY ordinal_position
    `;

    const [columns] = await bigquery.query({ query });

    console.log('📋 mbox_emailsテーブルの構造:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable})`);
    });

    // サンプルデータも確認
    console.log('\n📧 サンプルデータ（最初の3件）:');
    const sampleQuery = `
      SELECT *
      FROM \`viewpers.salesguard_data.mbox_emails\`
      LIMIT 3
    `;

    const [sampleData] = await bigquery.query({ query: sampleQuery });
    sampleData.forEach((row, index) => {
      console.log(`\n  レコード ${index + 1}:`);
      Object.keys(row).forEach(key => {
        const value = row[key];
        const displayValue = typeof value === 'string' && value.length > 100 
          ? value.substring(0, 100) + '...' 
          : value;
        console.log(`    ${key}: ${displayValue}`);
      });
    });

    // 統計情報
    console.log('\n📊 統計情報:');
    const statsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN message_body IS NOT NULL THEN 1 END) as has_body,
        COUNT(CASE WHEN message_body IS NOT NULL AND message_body != '' THEN 1 END) as non_empty_body
      FROM \`viewpers.salesguard_data.mbox_emails\`
    `;

    const [stats] = await bigquery.query({ query: statsQuery });
    const stat = stats[0];
    console.log(`  - 総レコード数: ${stat.total_records.toLocaleString()}件`);
    console.log(`  - 本文あり: ${stat.has_body.toLocaleString()}件 (${(stat.has_body/stat.total_records*100).toFixed(1)}%)`);
    console.log(`  - 非空本文: ${stat.non_empty_body.toLocaleString()}件 (${(stat.non_empty_body/stat.total_records*100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ エラー:', error.message);
    throw error;
  }
}

// 実行
if (require.main === module) {
  checkOriginalTableStructure()
    .then(() => console.log('\n✅ 構造確認完了'))
    .catch(console.error);
}

module.exports = { checkOriginalTableStructure }; 
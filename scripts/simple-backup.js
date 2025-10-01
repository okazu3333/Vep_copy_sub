const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function createSimpleBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    console.log(`🛡️ BigQueryバックアップ開始: ${timestamp}`);

    // 1. バックアップテーブル作成
    const backupTableName = `unified_email_messages_backup_${timestamp}`;
    console.log(`📊 バックアップテーブル作成: ${backupTableName}`);
    
    const backupQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.${backupTableName}\` AS
      SELECT * FROM \`viewpers.salesguard_alerts.unified_email_messages\`
    `;

    await bigquery.query({
      query: backupQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log(`✅ バックアップ完了: ${backupTableName}`);

    // 2. バックアップ確認
    const confirmQuery = `
      SELECT 
        COUNT(*) as total_records,
        MIN(datetime) as earliest_date,
        MAX(datetime) as latest_date
      FROM \`viewpers.salesguard_alerts.${backupTableName}\`
    `;

    const [stats] = await bigquery.query({
      query: confirmQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    const stat = stats[0];
    console.log('\n📊 バックアップ統計:');
    console.log(`  - 総レコード数: ${stat.total_records.toLocaleString()}件`);
    console.log(`  - 期間: ${stat.earliest_date} ～ ${stat.latest_date}`);

    // 3. 復元スクリプト生成
    const restoreScript = `-- 🔄 復元スクリプト
-- 作成日: ${new Date().toISOString()}
-- バックアップ: ${backupTableName}

-- 緊急復元（現在のテーブルを置き換え）
DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.unified_email_messages\`;
CREATE TABLE \`viewpers.salesguard_alerts.unified_email_messages\` AS
SELECT * FROM \`viewpers.salesguard_alerts.${backupTableName}\`;

-- 確認クエリ
SELECT 
  COUNT(*) as total_records,
  MIN(datetime) as earliest_date,
  MAX(datetime) as latest_date
FROM \`viewpers.salesguard_alerts.unified_email_messages\`;
`;

    require('fs').writeFileSync(`restore_${backupTableName}.sql`, restoreScript);
    console.log(`📄 復元スクリプト生成: restore_${backupTableName}.sql`);

    console.log('\n🎉 バックアップ処理完了！');
    console.log(`📁 バックアップテーブル: viewpers.salesguard_alerts.${backupTableName}`);
    console.log(`📋 復元スクリプト: restore_${backupTableName}.sql`);

    return {
      success: true,
      backupTable: backupTableName,
      recordCount: stat.total_records,
      timestamp
    };

  } catch (error) {
    console.error('❌ バックアップエラー:', error);
    throw error;
  }
}

if (require.main === module) {
  createSimpleBackup()
    .then(result => {
      console.log('\n✅ セグメント変更作業の準備完了！');
      console.log('これで安全にセグメントロジックを変更できます。');
    })
    .catch(error => {
      console.error('💥 バックアップ失敗:', error);
      process.exit(1);
    });
}

module.exports = { createSimpleBackup };


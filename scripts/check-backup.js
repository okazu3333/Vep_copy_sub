const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function checkBackup() {
  try {
    console.log('🔍 既存バックアップの確認...');

    const backupTableName = 'unified_email_messages_backup_2025-09-26';
    
    // バックアップテーブルの統計確認
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
    console.log('\n✅ バックアップ確認完了！');
    console.log(`📁 バックアップテーブル: viewpers.salesguard_alerts.${backupTableName}`);
    console.log(`📊 総レコード数: ${stat.total_records.toLocaleString()}件`);
    console.log(`📅 期間: ${stat.earliest_date} ～ ${stat.latest_date}`);

    // 復元スクリプト生成
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

    console.log('\n🎉 バックアップ確認完了！');
    console.log('✅ セグメント変更作業の準備完了！');
    console.log('これで安全にセグメントロジックを変更できます。');

    return {
      success: true,
      backupTable: backupTableName,
      recordCount: stat.total_records
    };

  } catch (error) {
    console.error('❌ バックアップ確認エラー:', error);
    throw error;
  }
}

if (require.main === module) {
  checkBackup()
    .catch(error => {
      console.error('💥 バックアップ確認失敗:', error);
      process.exit(1);
    });
}

module.exports = { checkBackup };


const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    console.log(`🛡️ BigQueryバックアップ開始: ${timestamp}`);

    // 1. メインテーブルのバックアップ
    console.log('\n📊 Step 1: unified_email_messages バックアップ');
    
    const backupTableName = `unified_email_messages_backup_${timestamp}`;
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

    // 2. バックアップ統計
    const statsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN seg_lose = true THEN 1 END) as lose_count,
        COUNT(CASE WHEN seg_rival = true THEN 1 END) as rival_count,
        COUNT(CASE WHEN seg_addreq = true THEN 1 END) as addreq_count,
        COUNT(CASE WHEN seg_renewal = true THEN 1 END) as renewal_count,
        MIN(datetime) as earliest_date,
        MAX(datetime) as latest_date
      FROM \`viewpers.salesguard_alerts.${backupTableName}\`
    `;

    const [stats] = await bigquery.query({
      query: statsQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log('\n📊 バックアップ統計:');
    const stat = stats[0];
    console.log(`  - 総レコード数: ${stat.total_records.toLocaleString()}件`);
    console.log(`  - 失注・解約: ${stat.lose_count.toLocaleString()}件`);
    console.log(`  - 競合比較: ${stat.rival_count.toLocaleString()}件`);
    console.log(`  - 追加要望: ${stat.addreq_count.toLocaleString()}件`);
    console.log(`  - 更新・継続: ${stat.renewal_count.toLocaleString()}件`);
    console.log(`  - 期間: ${stat.earliest_date} ～ ${stat.latest_date}`);

    // 3. バックアップ情報をメタデータテーブルに記録
    const metadataQuery = `
      CREATE TABLE IF NOT EXISTS \`viewpers.salesguard_alerts.backup_metadata\` (
        backup_name STRING,
        original_table STRING,
        backup_date TIMESTAMP,
        record_count INT64,
        backup_size_bytes INT64,
        backup_reason STRING,
        created_by STRING
      )
    `;

    await bigquery.query({
      query: metadataQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    const insertMetadataQuery = `
      INSERT INTO \`viewpers.salesguard_alerts.backup_metadata\`
      (backup_name, original_table, backup_date, record_count, backup_reason, created_by)
      VALUES (
        '${backupTableName}',
        'unified_email_messages',
        CURRENT_TIMESTAMP(),
        ${stat.total_records},
        'Pre-segment-logic-change backup',
        'system'
      )
    `;

    await bigquery.query({
      query: insertMetadataQuery,
      useLegacySql: false,
      location: 'asia-northeast1'
    });

    console.log('\n✅ バックアップ完了！');
    console.log(`📁 バックアップテーブル: viewpers.salesguard_alerts.${backupTableName}`);
    console.log(`📋 メタデータ: viewpers.salesguard_alerts.backup_metadata`);

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

// 復元用スクリプトも生成
async function generateRestoreScript(backupTableName) {
  const restoreScript = `
-- 🔄 復元スクリプト
-- 作成日: ${new Date().toISOString()}
-- バックアップ: ${backupTableName}

-- 1. 現在のテーブルを一時的にリネーム
CREATE TABLE \`viewpers.salesguard_alerts.unified_email_messages_temp\` AS
SELECT * FROM \`viewpers.salesguard_alerts.unified_email_messages\`;

-- 2. 元のテーブルを削除
DROP TABLE \`viewpers.salesguard_alerts.unified_email_messages\`;

-- 3. バックアップから復元
CREATE TABLE \`viewpers.salesguard_alerts.unified_email_messages\` AS
SELECT * FROM \`viewpers.salesguard_alerts.${backupTableName}\`;

-- 4. 一時テーブルを削除
DROP TABLE \`viewpers.salesguard_alerts.unified_email_messages_temp\`;

-- 確認クエリ
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN seg_lose = true THEN 1 END) as lose_count,
  COUNT(CASE WHEN seg_rival = true THEN 1 END) as rival_count,
  COUNT(CASE WHEN seg_addreq = true THEN 1 END) as addreq_count,
  COUNT(CASE WHEN seg_renewal = true THEN 1 END) as renewal_count
FROM \`viewpers.salesguard_alerts.unified_email_messages\`;
`;

  require('fs').writeFileSync(`restore_${backupTableName}.sql`, restoreScript);
  console.log(`📄 復元スクリプト生成: restore_${backupTableName}.sql`);
}

if (require.main === module) {
  createBackup()
    .then(result => {
      generateRestoreScript(result.backupTable);
      console.log('\n🎉 バックアップ処理完了！');
    })
    .catch(error => {
      console.error('💥 バックアップ失敗:', error);
      process.exit(1);
    });
}

module.exports = { createBackup, generateRestoreScript };


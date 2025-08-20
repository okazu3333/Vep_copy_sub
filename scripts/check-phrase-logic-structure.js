const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function checkPhraseLogicStructure() {
  try {
    console.log('🔍 フレーズロジックテーブルの構造を確認します...\n');

    // 1. テーブル構造の確認
    console.log('📊 ステップ1: テーブル構造の確認');
    const tableStructure = await bigquery.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM \`viewpers.salesguard_data.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'phrase_logic'
      ORDER BY ordinal_position
    `);

    console.log('  - フレーズロジックテーブルの構造:');
    tableStructure[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
    });

    // 2. サンプルデータの確認
    console.log('\n📊 ステップ2: サンプルデータの確認');
    const sampleData = await bigquery.query(`
      SELECT *
      FROM \`viewpers.salesguard_data.phrase_logic\`
      LIMIT 10
    `);

    console.log('  - サンプルデータ:');
    if (sampleData[0].length > 0) {
      const columns = Object.keys(sampleData[0][0]);
      console.log(`    カラム: ${columns.join(', ')}`);
      sampleData[0].forEach((row, index) => {
        console.log(`    ${index + 1}. ${JSON.stringify(row)}`);
      });
    } else {
      console.log('    データが存在しません');
    }

    // 3. 基本統計
    console.log('\n📊 ステップ3: 基本統計');
    const basicStats = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT rule_id) as unique_rules,
        COUNT(DISTINCT keyword) as unique_keywords
      FROM \`viewpers.salesguard_data.phrase_logic\`
    `);

    const stats = basicStats[0][0];
    console.log(`  - 総レコード数: ${stats.total_records.toLocaleString()}件`);
    console.log(`  - ユニークルール数: ${stats.unique_rules.toLocaleString()}件`);
    console.log(`  - ユニークキーワード数: ${stats.unique_keywords.toLocaleString()}件`);

    // 4. ルール別統計
    console.log('\n📊 ステップ4: ルール別統計');
    const ruleStats = await bigquery.query(`
      SELECT 
        rule_id,
        COUNT(*) as phrase_count,
        COUNT(DISTINCT keyword) as unique_keywords
      FROM \`viewpers.salesguard_data.phrase_logic\`
      GROUP BY rule_id
      ORDER BY phrase_count DESC
      LIMIT 10
    `);

    console.log('  - ルール別統計（上位10件）:');
    ruleStats[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ルールID: ${row.rule_id}`);
      console.log(`       フレーズ数: ${row.phrase_count.toLocaleString()}件`);
      console.log(`       ユニークキーワード数: ${row.unique_keywords.toLocaleString()}件`);
      console.log('');
    });

    // 5. キーワード別統計
    console.log('📊 ステップ5: キーワード別統計');
    const keywordStats = await bigquery.query(`
      SELECT 
        keyword,
        COUNT(*) as usage_count,
        COUNT(DISTINCT rule_id) as rule_count
      FROM \`viewpers.salesguard_data.phrase_logic\`
      GROUP BY keyword
      ORDER BY usage_count DESC
      LIMIT 10
    `);

    console.log('  - キーワード別統計（上位10件）:');
    keywordStats[0].forEach((row, index) => {
      console.log(`    ${index + 1}. キーワード: ${row.keyword}`);
      console.log(`       使用回数: ${row.usage_count.toLocaleString()}回`);
      console.log(`       使用ルール数: ${row.rule_count.toLocaleString()}件`);
      console.log('');
    });

    return {
      success: true,
      totalRecords: stats.total_records,
      uniqueRules: stats.unique_rules,
      uniqueKeywords: stats.unique_keywords
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  checkPhraseLogicStructure()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 フレーズロジックテーブル構造確認完了！');
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 ユニークルール数: ${result.uniqueRules.toLocaleString()}件`);
        console.log(`📊 ユニークキーワード数: ${result.uniqueKeywords.toLocaleString()}件`);
      } else {
        console.log('\n❌ 確認が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { checkPhraseLogicStructure }; 
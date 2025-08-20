const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function checkTableStructure() {
  try {
    console.log('🔍 BigQueryテーブル構造を確認中...');
    
    // テーブル一覧を取得
    const [tables] = await bigquery.dataset('salesguard_data').getTables();
    console.log('\n📊 利用可能なテーブル:');
    tables.forEach(table => {
      console.log(`  - ${table.id}`);
    });
    
    // japanese_decoded_emailsテーブルの構造を確認
    const query1 = `
      SELECT column_name, data_type, is_nullable
      FROM \`viewpers.salesguard_data.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'japanese_decoded_emails'
      ORDER BY ordinal_position
    `;
    
    const [columns1] = await bigquery.query({ query: query1 });
    
    console.log('\n📋 japanese_decoded_emailsテーブルの構造:');
    columns1.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
    // safe_decoded_emailsテーブルの構造を確認
    const query2 = `
      SELECT column_name, data_type, is_nullable
      FROM \`viewpers.salesguard_data.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'safe_decoded_emails'
      ORDER BY ordinal_position
    `;
    
    const [columns2] = await bigquery.query({ query: query2 });
    
    console.log('\n📋 safe_decoded_emailsテーブルの構造:');
    columns2.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
    // サンプルデータを確認
    const sampleQuery = `
      SELECT *
      FROM \`viewpers.salesguard_data.safe_decoded_emails\`
      LIMIT 1
    `;
    
    const [sampleData] = await bigquery.query({ query: sampleQuery });
    
    console.log('\n📄 safe_decoded_emailsサンプルデータ:');
    if (sampleData.length > 0) {
      Object.keys(sampleData[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof sampleData[0][key]}`);
      });
    } else {
      console.log('  データが見つかりません');
    }
    
  } catch (error) {
    console.error('❌ テーブル構造確認エラー:', error);
  }
}

checkTableStructure(); 
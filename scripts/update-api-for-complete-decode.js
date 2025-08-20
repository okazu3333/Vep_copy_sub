const fs = require('fs');
const path = require('path');

// API修正スクリプト
async function updateAPIForCompleteDecode() {
  try {
    console.log('🔧 API修正を開始します...');

    // 1. メインAPIの修正
    const apiRoutePath = 'app/api/alerts/route.ts';
    console.log(`📝 ${apiRoutePath} を修正中...`);

    let apiContent = fs.readFileSync(apiRoutePath, 'utf8');
    
    // テーブル名を完全デコード版に変更
    apiContent = apiContent.replace(
      /FROM `viewpers\.salesguard_data\.safe_decoded_emails`/g,
      'FROM `viewpers.salesguard_data.completely_decoded_emails`'
    );
    
    // カウントクエリも修正
    apiContent = apiContent.replace(
      /FROM `viewpers\.salesguard_data\.safe_decoded_emails`/g,
      'FROM `viewpers.salesguard_data.completely_decoded_emails`'
    );

    fs.writeFileSync(apiRoutePath, apiContent);
    console.log('✅ メインAPI修正完了');

    // 2. 詳細APIの修正
    const detailApiPath = 'app/api/alerts/[id]/route.ts';
    console.log(`📝 ${detailApiPath} を修正中...`);

    let detailContent = fs.readFileSync(detailApiPath, 'utf8');
    
    // テーブル名を完全デコード版に変更
    detailContent = detailContent.replace(
      /FROM `viewpers\.salesguard_data\.japanese_decoded_emails`/g,
      'FROM `viewpers.salesguard_data.completely_decoded_emails`'
    );

    fs.writeFileSync(detailApiPath, detailContent);
    console.log('✅ 詳細API修正完了');

    // 3. スクリプトAPIの修正
    const scriptApiPath = 'scripts/create-alerts-api.js';
    console.log(`📝 ${scriptApiPath} を修正中...`);

    let scriptContent = fs.readFileSync(scriptApiPath, 'utf8');
    
    // テーブル名を完全デコード版に変更
    scriptContent = scriptContent.replace(
      /FROM `viewpers\.salesguard_data\.japanese_decoded_emails`/g,
      'FROM `viewpers.salesguard_data.completely_decoded_emails`'
    );

    fs.writeFileSync(scriptApiPath, scriptContent);
    console.log('✅ スクリプトAPI修正完了');

    // 4. 設定ファイルの作成
    const configContent = `// 完全デコード設定
export const DECODE_CONFIG = {
  // 使用するテーブル
  tableName: 'completely_decoded_emails',
  
  // デコード品質設定
  minQualityScore: 50,
  
  // バッチ処理設定
  batchSize: 1000,
  maxBatches: 10,
  
  // エンコーディング設定
  supportedEncodings: ['UTF-8', 'ISO-2022-JP'],
  
  // メッセージオブジェクト処理
  handleMessageObjects: true,
  
  // 統計情報
  stats: {
    totalRecords: 0,
    decodedSenders: 0,
    decodedSubjects: 0,
    decodedBodies: 0,
    avgQualityScore: 0
  }
};

// デコード状況の確認
export async function checkDecodeStatus() {
  // BigQueryから統計を取得
  return {
    tableName: DECODE_CONFIG.tableName,
    lastUpdated: new Date().toISOString(),
    status: 'active'
  };
}
`;

    fs.writeFileSync('lib/decode-config.ts', configContent);
    console.log('✅ 設定ファイル作成完了');

    // 5. 修正内容の確認
    console.log('\n📋 修正内容:');
    console.log('  - メインAPI: テーブル名を completely_decoded_emails に変更');
    console.log('  - 詳細API: テーブル名を completely_decoded_emails に変更');
    console.log('  - スクリプトAPI: テーブル名を completely_decoded_emails に変更');
    console.log('  - 設定ファイル: decode-config.ts を作成');

    console.log('\n✅ API修正が完了しました');
    console.log('\n📝 次のステップ:');
    console.log('  1. 完全デコードテーブルの作成: node scripts/create-completely-decoded-table.sql');
    console.log('  2. バッチ処理の実行: node scripts/batch-decode-processor.js');
    console.log('  3. APIの再起動: npm run dev');

  } catch (error) {
    console.error('❌ API修正エラー:', error);
  }
}

updateAPIForCompleteDecode(); 
const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function deepEncodeAnalysis() {
  try {
    console.log('🔍 エンコードパターンの詳細分析を開始します...\n');

    // 1. 詳細エンコードパターン分析
    console.log('📊 ステップ1: 詳細エンコードパターン分析');
    const detailedPatterns = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN message_subject LIKE '%=?%' THEN 1 END) as encoded_subjects,
        COUNT(CASE WHEN message_subject LIKE '%=?UTF-8?B?%' THEN 1 END) as utf8_base64,
        COUNT(CASE WHEN message_subject LIKE '%=?ISO-2022-JP?B?%' THEN 1 END) as iso2022jp_base64,
        COUNT(CASE WHEN message_subject LIKE '%=?UTF-8?Q?%' THEN 1 END) as utf8_quoted,
        COUNT(CASE WHEN message_subject LIKE '%=?ISO-2022-JP?Q?%' THEN 1 END) as iso2022jp_quoted,
        COUNT(CASE WHEN message_subject LIKE '%=?%' AND message_subject NOT LIKE '%=?UTF-8?%' AND message_subject NOT LIKE '%=?ISO-2022-JP?%' THEN 1 END) as other_encoded,
        COUNT(CASE WHEN message_subject NOT LIKE '%=?%' AND message_subject IS NOT NULL THEN 1 END) as plain_subjects
      FROM \`viewpers.salesguard_data.mbox_emails\`
      WHERE message_body IS NOT NULL
    `);

    const patterns = detailedPatterns[0][0];
    console.log(`  - 総レコード数: ${patterns.total_records.toLocaleString()}件`);
    console.log(`  - エンコード済み件名: ${patterns.encoded_subjects.toLocaleString()}件 (${(patterns.encoded_subjects/patterns.total_records*100).toFixed(1)}%)`);
    console.log(`  - UTF-8 Base64: ${patterns.utf8_base64.toLocaleString()}件`);
    console.log(`  - ISO-2022-JP Base64: ${patterns.iso2022jp_base64.toLocaleString()}件`);
    console.log(`  - UTF-8 Quoted-Printable: ${patterns.utf8_quoted.toLocaleString()}件`);
    console.log(`  - ISO-2022-JP Quoted-Printable: ${patterns.iso2022jp_quoted.toLocaleString()}件`);
    console.log(`  - その他エンコード: ${patterns.other_encoded.toLocaleString()}件`);
    console.log(`  - プレーンテキスト: ${patterns.plain_subjects.toLocaleString()}件 (${(patterns.plain_subjects/patterns.total_records*100).toFixed(1)}%)`);

    // 2. サンプルエンコードデータの詳細分析
    console.log('\n📊 ステップ2: サンプルエンコードデータの詳細分析');
    const sampleEncoded = await bigquery.query(`
      SELECT 
        message_subject,
        LENGTH(message_subject) as subject_length
      FROM \`viewpers.salesguard_data.mbox_emails\`
      WHERE message_subject LIKE '%=?%'
      LIMIT 10
    `);

    console.log('  - エンコード済み件名のサンプル:');
    sampleEncoded[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ${row.message_subject} (長さ: ${row.subject_length}文字)`);
    });

    // 3. 80%達成のための戦略分析
    console.log('\n🎯 ステップ3: 80%達成のための戦略分析');
    
    const totalEncoded = patterns.encoded_subjects;
    const totalRecords = patterns.total_records;
    const currentPlain = patterns.plain_subjects;
    
    // 80%達成に必要なデコード数
    const targetDecoded = totalRecords * 0.8;
    const currentDecoded = currentPlain;
    const additionalNeeded = targetDecoded - currentDecoded;
    
    console.log(`  - 現在のプレーンテキスト: ${currentDecoded.toLocaleString()}件`);
    console.log(`  - 80%達成に必要なデコード: ${targetDecoded.toLocaleString()}件`);
    console.log(`  - 追加で必要なデコード: ${additionalNeeded.toLocaleString()}件`);
    console.log(`  - エンコード済みデータ: ${totalEncoded.toLocaleString()}件`);
    
    if (additionalNeeded <= totalEncoded) {
      console.log(`  - ✅ 理論上80%達成可能`);
    } else {
      console.log(`  - ❌ 理論上80%達成不可能`);
    }

    // 4. 根本的な解決策の提案
    console.log('\n🔧 ステップ4: 根本的な解決策の提案');
    
    console.log('  - 問題の根本原因:');
    console.log('    1. BigQueryのJavaScript UDFの制限');
    console.log('    2. 複雑なエンコードパターンへの対応不足');
    console.log('    3. 文字セット変換の制限');
    
    console.log('\n  - 解決策:');
    console.log('    1. 段階的デコードアプローチ');
    console.log('    2. 外部デコードサービスの利用');
    console.log('    3. 手動デコードスクリプトの作成');
    console.log('    4. 部分デコード + 後処理');

    // 5. 実用的な80%達成戦略
    console.log('\n📋 ステップ5: 実用的な80%達成戦略');
    
    // プレーンテキスト + 主要エンコード形式のデコードで80%達成を試行
    const majorEncodings = patterns.utf8_base64 + patterns.iso2022jp_base64 + patterns.utf8_quoted + patterns.iso2022jp_quoted;
    const potentialDecodeRate = ((currentPlain + majorEncodings) / totalRecords) * 100;
    
    console.log(`  - プレーンテキスト: ${currentPlain.toLocaleString()}件`);
    console.log(`  - 主要エンコード形式: ${majorEncodings.toLocaleString()}件`);
    console.log(`  - 潜在的なデコード率: ${potentialDecodeRate.toFixed(1)}%`);
    
    if (potentialDecodeRate >= 80) {
      console.log(`  - ✅ 主要エンコード形式の完全対応で80%達成可能`);
    } else {
      console.log(`  - ⚠️  さらなる対策が必要`);
    }

    return {
      success: true,
      totalRecords,
      encodedSubjects: patterns.encoded_subjects,
      plainSubjects: patterns.plain_subjects,
      potentialDecodeRate,
      majorEncodings
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  deepEncodeAnalysis()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 詳細分析完了！');
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 エンコード済み件名: ${result.encodedSubjects.toLocaleString()}件`);
        console.log(`📊 プレーンテキスト: ${result.plainSubjects.toLocaleString()}件`);
        console.log(`📊 潜在的なデコード率: ${result.potentialDecodeRate.toFixed(1)}%`);
        console.log(`📊 主要エンコード形式: ${result.majorEncodings.toLocaleString()}件`);
      } else {
        console.log('\n❌ 分析が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { deepEncodeAnalysis }; 
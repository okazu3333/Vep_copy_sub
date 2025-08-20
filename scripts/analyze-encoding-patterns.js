const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'viewpers'
});

async function analyzeEncodingPatterns() {
  try {
    console.log('🔍 エンコードパターン分析を開始します...\n');

    // 1. 件名のエンコードパターン分析
    console.log('📊 ステップ1: 件名のエンコードパターン分析');
    const subjectPatterns = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN message_subject LIKE '%=?%' THEN 1 END) as encoded_subjects,
        COUNT(CASE WHEN message_subject LIKE '%=?UTF-8?B?%' THEN 1 END) as utf8_base64,
        COUNT(CASE WHEN message_subject LIKE '%=?ISO-2022-JP?B?%' THEN 1 END) as iso2022jp_base64,
        COUNT(CASE WHEN message_subject LIKE '%=?UTF-8?Q?%' THEN 1 END) as utf8_quoted,
        COUNT(CASE WHEN message_subject LIKE '%=?ISO-2022-JP?Q?%' THEN 1 END) as iso2022jp_quoted,
        COUNT(CASE WHEN message_subject LIKE '%=?SHIFT_JIS?B?%' THEN 1 END) as shiftjis_base64,
        COUNT(CASE WHEN message_subject LIKE '%=?SHIFT_JIS?Q?%' THEN 1 END) as shiftjis_quoted,
        COUNT(CASE WHEN message_subject LIKE '%=?EUC-JP?B?%' THEN 1 END) as eucjp_base64,
        COUNT(CASE WHEN message_subject LIKE '%=?EUC-JP?Q?%' THEN 1 END) as eucjp_quoted,
        COUNT(CASE WHEN message_subject LIKE '%=?GB2312?B?%' THEN 1 END) as gb2312_base64,
        COUNT(CASE WHEN message_subject LIKE '%=?GBK?B?%' THEN 1 END) as gbk_base64,
        COUNT(CASE WHEN message_subject LIKE '%=?BIG5?B?%' THEN 1 END) as big5_base64,
        COUNT(CASE WHEN message_subject NOT LIKE '%=?%' AND message_subject IS NOT NULL THEN 1 END) as plain_subjects
      FROM \`viewpers.salesguard_data.mbox_emails\`
      WHERE message_body IS NOT NULL
    `);

    const subjectStats = subjectPatterns[0][0];
    console.log(`  - 総レコード数: ${subjectStats.total_records.toLocaleString()}件`);
    console.log(`  - エンコード済み件名: ${subjectStats.encoded_subjects.toLocaleString()}件 (${(subjectStats.encoded_subjects/subjectStats.total_records*100).toFixed(1)}%)`);
    console.log(`  - UTF-8 Base64: ${subjectStats.utf8_base64.toLocaleString()}件`);
    console.log(`  - ISO-2022-JP Base64: ${subjectStats.iso2022jp_base64.toLocaleString()}件`);
    console.log(`  - UTF-8 Quoted-Printable: ${subjectStats.utf8_quoted.toLocaleString()}件`);
    console.log(`  - ISO-2022-JP Quoted-Printable: ${subjectStats.iso2022jp_quoted.toLocaleString()}件`);
    console.log(`  - SHIFT_JIS Base64: ${subjectStats.shiftjis_base64.toLocaleString()}件`);
    console.log(`  - SHIFT_JIS Quoted-Printable: ${subjectStats.shiftjis_quoted.toLocaleString()}件`);
    console.log(`  - EUC-JP Base64: ${subjectStats.eucjp_base64.toLocaleString()}件`);
    console.log(`  - EUC-JP Quoted-Printable: ${subjectStats.eucjp_quoted.toLocaleString()}件`);
    console.log(`  - GB2312 Base64: ${subjectStats.gb2312_base64.toLocaleString()}件`);
    console.log(`  - GBK Base64: ${subjectStats.gbk_base64.toLocaleString()}件`);
    console.log(`  - BIG5 Base64: ${subjectStats.big5_base64.toLocaleString()}件`);
    console.log(`  - プレーンテキスト: ${subjectStats.plain_subjects.toLocaleString()}件 (${(subjectStats.plain_subjects/subjectStats.total_records*100).toFixed(1)}%)`);

    // 2. 送信者のエンコードパターン分析
    console.log('\n📊 ステップ2: 送信者のエンコードパターン分析');
    const senderPatterns = await bigquery.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN message_sender LIKE '%=?%' THEN 1 END) as encoded_senders,
        COUNT(CASE WHEN message_sender LIKE '%=?UTF-8?B?%' THEN 1 END) as utf8_base64,
        COUNT(CASE WHEN message_sender LIKE '%=?ISO-2022-JP?B?%' THEN 1 END) as iso2022jp_base64,
        COUNT(CASE WHEN message_sender LIKE '%=?UTF-8?Q?%' THEN 1 END) as utf8_quoted,
        COUNT(CASE WHEN message_sender LIKE '%=?ISO-2022-JP?Q?%' THEN 1 END) as iso2022jp_quoted,
        COUNT(CASE WHEN message_sender LIKE '%=?SHIFT_JIS?B?%' THEN 1 END) as shiftjis_base64,
        COUNT(CASE WHEN message_sender LIKE '%=?SHIFT_JIS?Q?%' THEN 1 END) as shiftjis_quoted,
        COUNT(CASE WHEN message_sender LIKE '%=?EUC-JP?B?%' THEN 1 END) as eucjp_base64,
        COUNT(CASE WHEN message_sender LIKE '%=?EUC-JP?Q?%' THEN 1 END) as eucjp_quoted,
        COUNT(CASE WHEN message_sender NOT LIKE '%=?%' AND message_sender IS NOT NULL THEN 1 END) as plain_senders
      FROM \`viewpers.salesguard_data.mbox_emails\`
      WHERE message_body IS NOT NULL
    `);

    const senderStats = senderPatterns[0][0];
    console.log(`  - エンコード済み送信者: ${senderStats.encoded_senders.toLocaleString()}件 (${(senderStats.encoded_senders/senderStats.total_records*100).toFixed(1)}%)`);
    console.log(`  - UTF-8 Base64: ${senderStats.utf8_base64.toLocaleString()}件`);
    console.log(`  - ISO-2022-JP Base64: ${senderStats.iso2022jp_base64.toLocaleString()}件`);
    console.log(`  - UTF-8 Quoted-Printable: ${senderStats.utf8_quoted.toLocaleString()}件`);
    console.log(`  - ISO-2022-JP Quoted-Printable: ${senderStats.iso2022jp_quoted.toLocaleString()}件`);
    console.log(`  - SHIFT_JIS Base64: ${senderStats.shiftjis_base64.toLocaleString()}件`);
    console.log(`  - SHIFT_JIS Quoted-Printable: ${senderStats.shiftjis_quoted.toLocaleString()}件`);
    console.log(`  - EUC-JP Base64: ${senderStats.eucjp_base64.toLocaleString()}件`);
    console.log(`  - EUC-JP Quoted-Printable: ${senderStats.eucjp_quoted.toLocaleString()}件`);
    console.log(`  - プレーンテキスト: ${senderStats.plain_senders.toLocaleString()}件 (${(senderStats.plain_senders/senderStats.total_records*100).toFixed(1)}%)`);

    // 3. サンプルデータの確認
    console.log('\n📊 ステップ3: サンプルデータの確認');
    const sampleData = await bigquery.query(`
      SELECT 
        message_id,
        message_subject,
        message_sender,
        message_body
      FROM \`viewpers.salesguard_data.mbox_emails\`
      WHERE message_subject LIKE '%=?%'
      LIMIT 10
    `);

    console.log('  - エンコード済み件名のサンプル:');
    sampleData[0].forEach((row, index) => {
      console.log(`    ${index + 1}. ${row.message_subject}`);
    });

    // 4. 最適解の提案
    console.log('\n🎯 ステップ4: 最適解の提案');
    
    const totalEncoded = subjectStats.encoded_subjects + senderStats.encoded_senders;
    const totalRecords = subjectStats.total_records;
    const currentDecodeRate = ((subjectStats.plain_subjects + senderStats.plain_senders) / (totalRecords * 2)) * 100;
    
    console.log(`  - 現在のデコード率: ${currentDecodeRate.toFixed(1)}%`);
    console.log(`  - エンコード済みデータ: ${totalEncoded.toLocaleString()}件`);
    
    // 主要エンコード形式の特定
    const majorEncodings = [
      { name: 'UTF-8 Base64', count: subjectStats.utf8_base64 + senderStats.utf8_base64 },
      { name: 'ISO-2022-JP Base64', count: subjectStats.iso2022jp_base64 + senderStats.iso2022jp_base64 },
      { name: 'UTF-8 Quoted-Printable', count: subjectStats.utf8_quoted + senderStats.utf8_quoted },
      { name: 'ISO-2022-JP Quoted-Printable', count: subjectStats.iso2022jp_quoted + senderStats.iso2022jp_quoted },
      { name: 'SHIFT_JIS Base64', count: subjectStats.shiftjis_base64 + senderStats.shiftjis_base64 },
      { name: 'SHIFT_JIS Quoted-Printable', count: subjectStats.shiftjis_quoted + senderStats.shiftjis_quoted },
      { name: 'EUC-JP Base64', count: subjectStats.eucjp_base64 + senderStats.eucjp_base64 },
      { name: 'EUC-JP Quoted-Printable', count: subjectStats.eucjp_quoted + senderStats.eucjp_quoted }
    ].sort((a, b) => b.count - a.count);

    console.log('\n  - 主要エンコード形式（上位5件）:');
    majorEncodings.slice(0, 5).forEach((encoding, index) => {
      console.log(`    ${index + 1}. ${encoding.name}: ${encoding.count.toLocaleString()}件`);
    });

    // 80%デコード達成のための戦略
    const targetDecodeRate = 80;
    const currentDecoded = subjectStats.plain_subjects + senderStats.plain_senders;
    const targetDecoded = totalRecords * 2 * (targetDecodeRate / 100);
    const additionalNeeded = targetDecoded - currentDecoded;

    console.log(`\n  - 80%デコード達成に必要な追加デコード: ${additionalNeeded.toLocaleString()}件`);
    console.log(`  - 主要エンコード形式をカバーすれば達成可能: ${majorEncodings.slice(0, 3).reduce((sum, enc) => sum + enc.count, 0).toLocaleString()}件`);

    return {
      success: true,
      totalRecords,
      encodedSubjects: subjectStats.encoded_subjects,
      encodedSenders: senderStats.encoded_senders,
      majorEncodings,
      currentDecodeRate,
      targetDecodeRate
    };

  } catch (error) {
    console.error('❌ エラー:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行
if (require.main === module) {
  analyzeEncodingPatterns()
    .then(result => {
      if (result.success) {
        console.log('\n✅ エンコードパターン分析完了！');
        console.log(`📊 総レコード数: ${result.totalRecords.toLocaleString()}件`);
        console.log(`📊 エンコード済み件名: ${result.encodedSubjects.toLocaleString()}件`);
        console.log(`📊 エンコード済み送信者: ${result.encodedSenders.toLocaleString()}件`);
        console.log(`📊 現在のデコード率: ${result.currentDecodeRate.toFixed(1)}%`);
        console.log(`📊 目標デコード率: ${result.targetDecodeRate}%`);
      } else {
        console.log('\n❌ 分析が失敗しました:', result.error);
      }
    })
    .catch(console.error);
}

module.exports = { analyzeEncodingPatterns }; 
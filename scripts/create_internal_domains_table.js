const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const bq = new BigQuery({ projectId: 'viewpers' });
    
    console.log('=== 自社ドメインテーブル作成 ===');
    
    // 自社グループドメインリスト
    const internalDomains = [
      { domain: 'fittio.co.jp', company_name: 'Fittio', email_pattern: 'fitall@fittio.co.jp' },
      { domain: 'gra-m.com', company_name: 'Gra-M', email_pattern: 'gramall@gra-m.com' },
      { domain: 'withwork.co.jp', company_name: 'WithWork', email_pattern: 'wwall@withwork.co.jp' },
      { domain: 'cross-c.co.jp', company_name: 'Cross-C', email_pattern: 'ccall@cross-c.co.jp' },
      { domain: 'propworks.co.jp', company_name: 'Propworks', email_pattern: 'cpwall@propworks.co.jp' },
      { domain: 'cross-m.co.jp', company_name: 'Cross Marketing', email_pattern: 'cmall@cross-m.co.jp' },
      { domain: 'cm-group.co.jp', company_name: 'CM Group', email_pattern: 'cmgall@cm-group.co.jp' },
      { domain: 'shoppers-eye.co.jp', company_name: 'Shoppers Eye', email_pattern: 'seall@shoppers-eye.co.jp' },
      { domain: 'd-and-m.co.jp', company_name: 'D&M', email_pattern: 'dmall@d-and-m.co.jp' },
      { domain: 'medi-l.com', company_name: 'Medi-L', email_pattern: 'mdlall@medi-l.com' },
      { domain: 'metasite.co.jp', company_name: 'Metasite', email_pattern: 'msall@metasite.co.jp' },
      { domain: 'infidex.co.jp', company_name: 'Infidex', email_pattern: 'info@infidex.co.jp' },
      { domain: 'excrie.co.jp', company_name: 'Excrie', email_pattern: 'excall@excrie.co.jp' },
      { domain: 'alternaex.co.jp', company_name: 'Alternaex', email_pattern: 'alxall@alternaex.co.jp' },
      { domain: 'cmg.traffics.jp', company_name: 'CMG Traffics', email_pattern: 'tfcall@cmg.traffics.jp' },
      { domain: 'tokyogets.com', company_name: 'Tokyo Gets', email_pattern: 'all_member@tokyogets.com' },
      { domain: 'pathcrie.co.jp', company_name: 'Pathcrie', email_pattern: 'ptcall@pathcrie.co.jp' },
      { domain: 'reech.co.jp', company_name: 'Reech', email_pattern: 'rhall@reech.co.jp' }
    ];
    
    // Step 1: 自社ドメインテーブル作成
    console.log('📊 Step 1: 自社ドメインテーブル作成');
    
    const dropTableQuery = `DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.internal_domains\``;
    await bq.query({ query: dropTableQuery, useLegacySql: false, location: 'asia-northeast1' });
    
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.internal_domains\` (
        domain STRING NOT NULL,
        company_name STRING,
        email_pattern STRING,
        is_active BOOL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      OPTIONS (
        description = "自社グループドメイン管理テーブル"
      )
    `;
    
    await bq.query({ query: createTableQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✅ 自社ドメインテーブル作成完了');
    
    // Step 2: データ挿入
    console.log('📊 Step 2: 自社ドメインデータ挿入');
    
    const insertQuery = `
      INSERT INTO \`viewpers.salesguard_alerts.internal_domains\`
      (domain, company_name, email_pattern, is_active)
      VALUES
      ${internalDomains.map(d => 
        `('${d.domain}', '${d.company_name}', '${d.email_pattern}', TRUE)`
      ).join(',\n      ')}
    `;
    
    await bq.query({ query: insertQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log(`✅ ${internalDomains.length}件の自社ドメインを挿入完了`);
    
    // Step 3: 確認クエリ
    console.log('📊 Step 3: 挿入データ確認');
    
    const verifyQuery = `
      SELECT 
        domain,
        company_name,
        email_pattern,
        is_active
      FROM \`viewpers.salesguard_alerts.internal_domains\`
      ORDER BY domain
    `;
    
    const [verifyResult] = await bq.query({ query: verifyQuery, useLegacySql: false, location: 'asia-northeast1' });
    
    console.log('📋 挿入された自社ドメイン:');
    verifyResult.forEach((row, i) => {
      console.log(`  ${i+1}. ${row.domain} (${row.company_name}) - ${row.email_pattern}`);
    });
    
    // Step 4: 使用状況確認
    console.log('\n📊 Step 4: メッセージ使用状況確認');
    
    const usageQuery = `
      SELECT 
        i.domain,
        i.company_name,
        COUNT(u.message_id) as message_count,
        COUNT(DISTINCT u.\`from\`) as unique_senders
      FROM \`viewpers.salesguard_alerts.internal_domains\` i
      LEFT JOIN \`viewpers.salesguard_alerts.unified_email_messages\` u
        ON u.company_domain = i.domain
      GROUP BY i.domain, i.company_name
      ORDER BY message_count DESC
    `;
    
    const [usageResult] = await bq.query({ query: usageQuery, useLegacySql: false, location: 'asia-northeast1' });
    
    console.log('📧 自社ドメイン別メッセージ数:');
    let totalInternalMessages = 0;
    usageResult.forEach(row => {
      const count = row.message_count || 0;
      totalInternalMessages += count;
      console.log(`  ${row.domain}: ${count.toLocaleString()}件 (${row.unique_senders || 0}人) - ${row.company_name}`);
    });
    
    console.log(`\n📈 自社グループ総メッセージ数: ${totalInternalMessages.toLocaleString()}件`);
    
    // Step 5: 外部顧客数確認
    console.log('\n📊 Step 5: 外部顧客数確認');
    
    const externalQuery = `
      SELECT 
        COUNT(DISTINCT company_domain) as external_companies,
        COUNT(DISTINCT \`from\`) as external_contacts,
        COUNT(*) as external_messages
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE company_domain NOT IN (
        SELECT domain FROM \`viewpers.salesguard_alerts.internal_domains\`
      )
      AND company_domain IS NOT NULL
      AND company_domain != ''
    `;
    
    const [externalResult] = await bq.query({ query: externalQuery, useLegacySql: false, location: 'asia-northeast1' });
    const external = externalResult[0];
    
    console.log('🏢 外部顧客統計:');
    console.log(`  外部企業数: ${external.external_companies?.toLocaleString()}社`);
    console.log(`  外部連絡先: ${external.external_contacts?.toLocaleString()}人`);
    console.log(`  外部メッセージ: ${external.external_messages?.toLocaleString()}件`);
    
    console.log('\n🎉 自社ドメインテーブル作成完了！');
    console.log('\n✅ 次のステップ:');
    console.log('1. 顧客管理APIを更新して自社ドメインを除外');
    console.log('2. アラート分析で内部/外部を適切に分類');
    console.log('3. セグメント検知で自社メッセージを除外');
    
  } catch (e) {
    console.error('自社ドメインテーブル作成エラー:', e?.message || e);
    process.exit(1);
  }
})(); 
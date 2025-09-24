const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const bq = new BigQuery({ projectId: 'viewpers' });
    
    console.log('=== 顧客企業テーブル作成 ===');
    
    const INTERNAL_DOMAINS = [
      'fittio.co.jp', 'gra-m.com', 'withwork.co.jp', 'cross-c.co.jp',
      'propworks.co.jp', 'cross-m.co.jp', 'cm-group.co.jp', 'shoppers-eye.co.jp',
      'd-and-m.co.jp', 'medi-l.com', 'metasite.co.jp', 'infidex.co.jp',
      'excrie.co.jp', 'alternaex.co.jp', 'cmg.traffics.jp', 'tokyogets.com',
      'pathcrie.co.jp', 'reech.co.jp'
    ];
    
    // Step 1: Create customer_companies table
    const dropQuery = `DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.customer_companies\``;
    await bq.query({ query: dropQuery, useLegacySql: false, location: 'asia-northeast1' });
    
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.customer_companies\` (
        company_domain STRING NOT NULL,
        company_name STRING,
        industry STRING,
        size_segment STRING,
        risk_level STRING,
        status STRING,
        account_manager_id STRING,
        total_messages INT64,
        total_users INT64,
        risk_score FLOAT64,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
      PARTITION BY DATE(created_at)
      CLUSTER BY company_domain, status, risk_level
      OPTIONS (
        description = "Customer companies excluding internal domains"
      )
    `;
    
    await bq.query({ query: createTableQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ customer_companies テーブル作成完了');
    
    // Step 2: Insert data from unified_email_messages (excluding internal domains)
    const insertQuery = `
      INSERT INTO \`viewpers.salesguard_alerts.customer_companies\`
      WITH CompanyStats AS (
        SELECT
          company_domain,
          COUNT(DISTINCT message_id) AS total_messages,
          COUNT(DISTINCT \`from\`) AS total_users,
          SUM(CASE WHEN primary_risk_type != 'low' THEN 1 ELSE 0 END) AS total_risky_messages,
          AVG(CASE WHEN score > 0 THEN score ELSE NULL END) AS avg_risk_score,
          MAX(datetime) AS last_activity_at
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE direction = 'external'
          AND company_domain IS NOT NULL
          AND company_domain != ''
          AND company_domain NOT IN UNNEST(@internal_domains)
        GROUP BY company_domain
        HAVING total_messages >= 1
      )
      SELECT
        cs.company_domain,
        INITCAP(REPLACE(REPLACE(cs.company_domain, '.co.jp', ''), '.com', '')) AS company_name,
        CASE 
          WHEN REGEXP_CONTAINS(LOWER(cs.company_domain), r'(tech|it|system|soft)') THEN 'technology'
          WHEN REGEXP_CONTAINS(LOWER(cs.company_domain), r'(bank|finance|invest)') THEN 'finance'
          WHEN REGEXP_CONTAINS(LOWER(cs.company_domain), r'(retail|shop|store)') THEN 'retail'
          WHEN REGEXP_CONTAINS(LOWER(cs.company_domain), r'(medical|health|pharma)') THEN 'healthcare'
          ELSE 'other'
        END AS industry,
        CASE
          WHEN cs.total_messages > 1000 THEN 'enterprise'
          WHEN cs.total_messages > 100 THEN 'large'
          WHEN cs.total_messages > 10 THEN 'medium'
          ELSE 'small'
        END AS size_segment,
        CASE
          WHEN SAFE_DIVIDE(cs.total_risky_messages, cs.total_messages) > 0.3 THEN 'critical'
          WHEN SAFE_DIVIDE(cs.total_risky_messages, cs.total_messages) > 0.1 THEN 'high'
          WHEN SAFE_DIVIDE(cs.total_risky_messages, cs.total_messages) > 0.05 THEN 'medium'
          ELSE 'low'
        END AS risk_level,
        'active' AS status,
        CAST(NULL AS STRING) AS account_manager_id,
        cs.total_messages,
        cs.total_users,
        COALESCE(cs.avg_risk_score, 0.0) AS risk_score,
        CURRENT_TIMESTAMP() AS created_at,
        CURRENT_TIMESTAMP() AS updated_at
      FROM CompanyStats cs
      ORDER BY cs.total_messages DESC
    `;
    
    await bq.query({ 
      query: insertQuery, 
      params: { internal_domains: INTERNAL_DOMAINS },
      useLegacySql: false, 
      location: 'asia-northeast1',
      maximumBytesBilled: '10000000000'
    });
    console.log('✓ 顧客データ挿入完了');
    
    // Step 3: Verify data
    const verifyQuery = `
      SELECT 
        COUNT(*) as total_companies,
        COUNT(DISTINCT industry) as unique_industries,
        SUM(total_messages) as total_messages,
        SUM(total_users) as total_users,
        AVG(risk_score) as avg_risk_score
      FROM \`viewpers.salesguard_alerts.customer_companies\`
    `;
    
    const [verifyResult] = await bq.query({ query: verifyQuery, useLegacySql: false, location: 'asia-northeast1' });
    const stats = verifyResult[0];
    
    console.log('');
    console.log('📊 作成結果:');
    console.log(`  総顧客企業数: ${stats.total_companies}社`);
    console.log(`  業界数: ${stats.unique_industries}業界`);
    console.log(`  総メッセージ数: ${stats.total_messages?.toLocaleString()}件`);
    console.log(`  総ユーザー数: ${stats.total_users?.toLocaleString()}人`);
    console.log(`  平均リスクスコア: ${stats.avg_risk_score?.toFixed(2)}`);
    
    // Show sample data
    const sampleQuery = `
      SELECT 
        company_name,
        company_domain,
        industry,
        size_segment,
        risk_level,
        total_messages,
        total_users,
        risk_score
      FROM \`viewpers.salesguard_alerts.customer_companies\`
      ORDER BY total_messages DESC
      LIMIT 10
    `;
    
    const [sampleResult] = await bq.query({ query: sampleQuery, useLegacySql: false, location: 'asia-northeast1' });
    
    console.log('');
    console.log('🏢 主要顧客企業:');
    sampleResult.forEach(company => {
      console.log(`  ${company.company_name} (${company.company_domain})`);
      console.log(`    業界: ${company.industry}, 規模: ${company.size_segment}, リスク: ${company.risk_level}`);
      console.log(`    メッセージ: ${company.total_messages}件, ユーザー: ${company.total_users}人, スコア: ${company.risk_score?.toFixed(2)}`);
      console.log('');
    });
    
    console.log('🎉 顧客企業テーブル作成完了！');
    
  } catch (e) {
    console.error('テーブル作成エラー:', e?.message || e);
    process.exit(1);
  }
})(); 
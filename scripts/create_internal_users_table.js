const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const bq = new BigQuery({ projectId: 'viewpers' });
    
    console.log('=== 内部ユーザーテーブル作成 ===');
    
    // Step 1: Create internal_users table
    const dropQuery = `DROP TABLE IF EXISTS \`viewpers.salesguard_alerts.internal_users\``;
    await bq.query({ query: dropQuery, useLegacySql: false, location: 'asia-northeast1' });
    
    const createTableQuery = `
      CREATE TABLE \`viewpers.salesguard_alerts.internal_users\` (
        user_email STRING NOT NULL,
        user_name STRING,
        company_domain STRING,
        department STRING,
        role STRING,
        permissions STRING,
        status STRING,
        last_activity_at TIMESTAMP,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
      PARTITION BY DATE(created_at)
      CLUSTER BY company_domain, status, role
      OPTIONS (
        description = "Internal users from company domains"
      )
    `;
    
    await bq.query({ query: createTableQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ internal_users テーブル作成完了');
    
    // Step 2: Insert sample data
    const insertQuery = `
      INSERT INTO \`viewpers.salesguard_alerts.internal_users\`
      WITH SampleUsers AS (
        SELECT * FROM UNNEST([
          STRUCT('admin@cross-m.co.jp' as user_email, '管理者' as user_name, 'cross-m.co.jp' as company_domain, '管理部' as department, 'admin' as role, 'full' as permissions, 'active' as status),
          STRUCT('manager@cross-m.co.jp' as user_email, '営業マネージャー' as user_name, 'cross-m.co.jp' as company_domain, '営業部' as department, 'manager' as role, 'manage' as permissions, 'active' as status),
          STRUCT('sales1@cross-m.co.jp' as user_email, '営業担当A' as user_name, 'cross-m.co.jp' as company_domain, '営業部' as department, 'user' as role, 'read' as permissions, 'active' as status),
          STRUCT('sales2@cross-m.co.jp' as user_email, '営業担当B' as user_name, 'cross-m.co.jp' as company_domain, '営業部' as department, 'user' as role, 'read' as permissions, 'active' as status),
          STRUCT('support@cm-group.co.jp' as user_email, 'サポート担当' as user_name, 'cm-group.co.jp' as company_domain, 'サポート部' as department, 'user' as role, 'read' as permissions, 'active' as status),
          STRUCT('dev@fittio.co.jp' as user_email, '開発者' as user_name, 'fittio.co.jp' as company_domain, '開発部' as department, 'user' as role, 'read' as permissions, 'active' as status),
          STRUCT('marketing@gra-m.com' as user_email, 'マーケティング' as user_name, 'gra-m.com' as company_domain, 'マーケティング部' as department, 'user' as role, 'read' as permissions, 'active' as status),
          STRUCT('hr@withwork.co.jp' as user_email, '人事担当' as user_name, 'withwork.co.jp' as company_domain, '人事部' as department, 'manager' as role, 'manage' as permissions, 'active' as status)
        ])
      )
      SELECT 
        user_email,
        user_name,
        company_domain,
        department,
        role,
        permissions,
        status,
        CURRENT_TIMESTAMP() as last_activity_at,
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
      FROM SampleUsers
    `;
    
    await bq.query({ query: insertQuery, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ サンプルデータ挿入完了');
    
    // Step 3: Verify data
    const verifyQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(DISTINCT company_domain) as unique_domains,
        COUNT(DISTINCT department) as unique_departments
      FROM \`viewpers.salesguard_alerts.internal_users\`
    `;
    
    const [verifyResult] = await bq.query({ query: verifyQuery, useLegacySql: false, location: 'asia-northeast1' });
    const stats = verifyResult[0];
    
    console.log('');
    console.log('📊 作成結果:');
    console.log(`  総ユーザー数: ${stats.total_users}人`);
    console.log(`  会社ドメイン数: ${stats.unique_domains}社`);
    console.log(`  部署数: ${stats.unique_departments}部署`);
    
    // Show sample data
    const sampleQuery = `
      SELECT user_email, user_name, company_domain, department, role, status
      FROM \`viewpers.salesguard_alerts.internal_users\`
      ORDER BY company_domain, department
      LIMIT 10
    `;
    
    const [sampleResult] = await bq.query({ query: sampleQuery, useLegacySql: false, location: 'asia-northeast1' });
    
    console.log('');
    console.log('👥 サンプルユーザー:');
    sampleResult.forEach(user => {
      console.log(`  ${user.user_name} (${user.user_email}) - ${user.company_domain} ${user.department} [${user.role}]`);
    });
    
    console.log('');
    console.log('🎉 内部ユーザーテーブル作成完了！');
    
  } catch (e) {
    console.error('テーブル作成エラー:', e?.message || e);
    process.exit(1);
  }
})(); 
const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = 'viewpers';
    const dataset = 'salesguard_alerts';
    const bq = new BigQuery({ projectId });

    console.log('=== 顧客情報・ユーザー管理テーブル作成 ===');
    console.log('');

    // Step 1: 顧客情報テーブル作成
    console.log('📊 Step 1: 顧客情報テーブル作成');
    
    const dropCustomersQuery = `DROP TABLE IF EXISTS \`${projectId}.${dataset}.customer_companies\``;
    await bq.query({ query: dropCustomersQuery, useLegacySql: false, location: 'asia-northeast1' });

    const createCustomersTableDDL = `
      CREATE TABLE \`${projectId}.${dataset}.customer_companies\` (
        company_domain STRING NOT NULL,
        company_name STRING,
        company_type STRING, -- 'customer', 'partner', 'vendor', 'other'
        industry STRING,
        company_size STRING, -- 'small', 'medium', 'large', 'enterprise'
        risk_level STRING, -- 'low', 'medium', 'high', 'critical'
        total_messages INT64,
        unique_contacts INT64,
        risk_messages INT64,
        risk_rate FLOAT64,
        first_contact TIMESTAMP,
        last_contact TIMESTAMP,
        primary_contact_email STRING,
        account_manager STRING,
        status STRING, -- 'active', 'inactive', 'prospect', 'lost'
        notes STRING,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY DATE(created_at)
      CLUSTER BY company_domain, risk_level, status
      OPTIONS (
        description = "Customer company information derived from email communications"
      )
    `;

    await bq.query({ query: createCustomersTableDDL, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ customer_companies テーブル作成完了');

    // Step 2: 顧客データ挿入
    console.log('');
    console.log('📊 Step 2: 顧客データ挿入');
    
    const insertCustomersQuery = `
      INSERT INTO \`${projectId}.${dataset}.customer_companies\`
      (
        company_domain, company_name, company_type, industry, company_size, 
        risk_level, total_messages, unique_contacts, risk_messages, risk_rate,
        first_contact, last_contact, primary_contact_email, status
      )
      WITH customer_stats AS (
        SELECT 
          company_domain,
          COUNT(*) as total_messages,
          COUNT(DISTINCT \`from\`) as unique_contacts,
          COUNTIF(primary_risk_type != 'low') as risk_messages,
          SAFE_DIVIDE(COUNTIF(primary_risk_type != 'low'), COUNT(*)) * 100 as risk_rate,
          MIN(datetime) as first_contact,
          MAX(datetime) as last_contact
        FROM \`${projectId}.${dataset}.unified_email_messages\`
        WHERE direction = 'external' 
          AND company_domain IS NOT NULL 
          AND company_domain != ''
          AND company_domain NOT IN (
            'cross-m.co.jp', 'ml.cross-m.co.jp', 'cm-group.co.jp', 
            'ml.cm-group.co.jp', 'cross-m.co.jp.invalid', 'ss1-msg.cm-group.co.jp',
            'coum.cm-group.co.jp', 'notify.cross-m.co.jp'
          )
        GROUP BY company_domain
        HAVING total_messages >= 5 -- 最低5件のメッセージがある会社のみ
      ),
      primary_contacts AS (
        SELECT 
          company_domain,
          \`from\` as primary_contact_email,
          ROW_NUMBER() OVER (PARTITION BY company_domain ORDER BY COUNT(*) DESC) as rn
        FROM \`${projectId}.${dataset}.unified_email_messages\`
        WHERE direction = 'external' 
          AND company_domain IS NOT NULL 
          AND company_domain != ''
          AND company_domain NOT IN (
            'cross-m.co.jp', 'ml.cross-m.co.jp', 'cm-group.co.jp', 
            'ml.cm-group.co.jp', 'cross-m.co.jp.invalid', 'ss1-msg.cm-group.co.jp',
            'coum.cm-group.co.jp', 'notify.cross-m.co.jp'
          )
        GROUP BY company_domain, \`from\`
      )
      SELECT
        cs.company_domain,
        -- ドメインから会社名を推測
        CASE 
          WHEN cs.company_domain LIKE '%.co.jp' THEN REGEXP_REPLACE(cs.company_domain, r'\\.co\\.jp$', '')
          WHEN cs.company_domain LIKE '%.com' THEN REGEXP_REPLACE(cs.company_domain, r'\\.com$', '')
          WHEN cs.company_domain LIKE '%.jp' THEN REGEXP_REPLACE(cs.company_domain, r'\\.jp$', '')
          ELSE cs.company_domain
        END as company_name,
        -- メッセージ量とリスク率から会社タイプを推測
        CASE 
          WHEN cs.total_messages >= 500 THEN 'customer'
          WHEN cs.total_messages >= 100 THEN 'partner'
          WHEN cs.total_messages >= 20 THEN 'vendor'
          ELSE 'other'
        END as company_type,
        -- ドメインから業界を推測
        CASE 
          WHEN cs.company_domain LIKE '%bank%' OR cs.company_domain LIKE '%finance%' THEN 'finance'
          WHEN cs.company_domain LIKE '%tech%' OR cs.company_domain LIKE '%soft%' THEN 'technology'
          WHEN cs.company_domain LIKE '%media%' OR cs.company_domain LIKE '%news%' THEN 'media'
          WHEN cs.company_domain LIKE '%recruit%' OR cs.company_domain LIKE '%hr%' THEN 'hr'
          WHEN cs.company_domain LIKE '%marketing%' OR cs.company_domain LIKE '%ad%' THEN 'marketing'
          ELSE 'other'
        END as industry,
        -- メッセージ量から会社規模を推測
        CASE 
          WHEN cs.total_messages >= 1000 THEN 'enterprise'
          WHEN cs.total_messages >= 300 THEN 'large'
          WHEN cs.total_messages >= 50 THEN 'medium'
          ELSE 'small'
        END as company_size,
        -- リスク率からリスクレベルを設定
        CASE 
          WHEN cs.risk_rate >= 50 THEN 'critical'
          WHEN cs.risk_rate >= 25 THEN 'high'
          WHEN cs.risk_rate >= 10 THEN 'medium'
          ELSE 'low'
        END as risk_level,
        cs.total_messages,
        cs.unique_contacts,
        cs.risk_messages,
        cs.risk_rate,
        cs.first_contact,
        cs.last_contact,
        pc.primary_contact_email,
        -- 最近の活動から状態を推測
        CASE 
          WHEN DATE_DIFF(CURRENT_DATE(), DATE(cs.last_contact), DAY) <= 30 THEN 'active'
          WHEN DATE_DIFF(CURRENT_DATE(), DATE(cs.last_contact), DAY) <= 90 THEN 'inactive'
          ELSE 'prospect'
        END as status
      FROM customer_stats cs
      LEFT JOIN primary_contacts pc ON cs.company_domain = pc.company_domain AND pc.rn = 1
      ORDER BY cs.total_messages DESC
    `;

    const [insertCustomersJob] = await bq.createQueryJob({
      query: insertCustomersQuery,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '5000000000' // 5GB limit
    });

    await insertCustomersJob.getQueryResults();
    console.log('✓ 顧客データ挿入完了');

    // Step 3: ユーザー管理テーブル作成
    console.log('');
    console.log('📊 Step 3: ユーザー管理テーブル作成');
    
    const dropUsersQuery = `DROP TABLE IF EXISTS \`${projectId}.${dataset}.internal_users\``;
    await bq.query({ query: dropUsersQuery, useLegacySql: false, location: 'asia-northeast1' });

    const createUsersTableDDL = `
      CREATE TABLE \`${projectId}.${dataset}.internal_users\` (
        user_id STRING NOT NULL,
        email STRING NOT NULL,
        display_name STRING,
        first_name STRING,
        last_name STRING,
        department STRING,
        role STRING, -- 'admin', 'manager', 'analyst', 'user'
        company_domain STRING,
        is_active BOOL DEFAULT TRUE,
        total_sent_messages INT64,
        total_threads_participated INT64,
        avg_response_time_hours FLOAT64,
        risk_messages_handled INT64,
        first_activity TIMESTAMP,
        last_activity TIMESTAMP,
        permissions ARRAY<STRING>, -- ['alerts_view', 'alerts_manage', 'users_manage', etc.]
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        last_login TIMESTAMP
      )
      PARTITION BY DATE(created_at)
      CLUSTER BY company_domain, department, role
      OPTIONS (
        description = "Internal user management for sales guard system"
      )
    `;

    await bq.query({ query: createUsersTableDDL, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ internal_users テーブル作成完了');

    // Step 4: ユーザーデータ挿入
    console.log('');
    console.log('📊 Step 4: ユーザーデータ挿入');
    
    const insertUsersQuery = `
      INSERT INTO \`${projectId}.${dataset}.internal_users\`
      (
        user_id, email, display_name, first_name, last_name, department, 
        role, company_domain, is_active, total_sent_messages, total_threads_participated,
        risk_messages_handled, first_activity, last_activity, permissions
      )
      WITH user_stats AS (
        SELECT 
          \`from\` as email,
          company_domain,
          COUNT(*) as total_sent_messages,
          COUNT(DISTINCT thread_id) as total_threads_participated,
          COUNTIF(primary_risk_type != 'low') as risk_messages_handled,
          MIN(datetime) as first_activity,
          MAX(datetime) as last_activity
        FROM \`${projectId}.${dataset}.unified_email_messages\`
        WHERE direction = 'internal'
          AND \`from\` IS NOT NULL
          AND \`from\` != ''
          AND \`from\` NOT LIKE '%noreply%'
          AND \`from\` NOT LIKE '%no-reply%'
          AND \`from\` NOT LIKE '%mailer-daemon%'
          AND \`from\` NOT LIKE '%system%'
        GROUP BY \`from\`, company_domain
        HAVING total_sent_messages >= 10 -- 最低10件のメッセージを送信したユーザーのみ
      )
      SELECT
        -- user_idはemailのローカル部分を使用
        REGEXP_EXTRACT(email, r'^([^@]+)') as user_id,
        email,
        -- display_nameはemailのローカル部分から推測
        REGEXP_REPLACE(REGEXP_EXTRACT(email, r'^([^@]+)'), r'[_.]', ' ') as display_name,
        -- first_nameとlast_nameはローカル部分を分割
        SPLIT(REGEXP_REPLACE(REGEXP_EXTRACT(email, r'^([^@]+)'), r'[_.]', ' '), ' ')[SAFE_OFFSET(0)] as first_name,
        SPLIT(REGEXP_REPLACE(REGEXP_EXTRACT(email, r'^([^@]+)'), r'[_.]', ' '), ' ')[SAFE_OFFSET(1)] as last_name,
        -- emailパターンから部署を推測
        CASE 
          WHEN email LIKE '%admin%' OR email LIKE '%sys%' THEN 'IT'
          WHEN email LIKE '%sales%' OR email LIKE '%eigyo%' THEN 'Sales'
          WHEN email LIKE '%marketing%' OR email LIKE '%pr%' THEN 'Marketing'
          WHEN email LIKE '%hr%' OR email LIKE '%jinji%' THEN 'HR'
          WHEN email LIKE '%finance%' OR email LIKE '%keiri%' THEN 'Finance'
          WHEN email LIKE '%research%' OR email LIKE '%ri_%' THEN 'Research'
          WHEN email LIKE '%cs%' OR email LIKE '%support%' THEN 'Customer Support'
          ELSE 'General'
        END as department,
        -- メッセージ量とパターンから役割を推測
        CASE 
          WHEN email LIKE '%admin%' OR email LIKE '%manager%' THEN 'admin'
          WHEN total_sent_messages >= 500 THEN 'manager'
          WHEN total_sent_messages >= 100 THEN 'analyst'
          ELSE 'user'
        END as role,
        company_domain,
        -- 最近の活動から活動状態を判定
        DATE_DIFF(CURRENT_DATE(), DATE(last_activity), DAY) <= 30 as is_active,
        total_sent_messages,
        total_threads_participated,
        risk_messages_handled,
        first_activity,
        last_activity,
        -- 役割に基づく権限設定
        CASE 
          WHEN email LIKE '%admin%' THEN ['alerts_view', 'alerts_manage', 'users_manage', 'system_admin']
          WHEN total_sent_messages >= 500 THEN ['alerts_view', 'alerts_manage', 'reports_view']
          WHEN total_sent_messages >= 100 THEN ['alerts_view', 'reports_view']
          ELSE ['alerts_view']
        END as permissions
      FROM user_stats
      ORDER BY total_sent_messages DESC
    `;

    const [insertUsersJob] = await bq.createQueryJob({
      query: insertUsersQuery,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '5000000000' // 5GB limit
    });

    await insertUsersJob.getQueryResults();
    console.log('✓ ユーザーデータ挿入完了');

    // Step 5: 外部コンタクトテーブル作成
    console.log('');
    console.log('📊 Step 5: 外部コンタクトテーブル作成');
    
    const dropContactsQuery = `DROP TABLE IF EXISTS \`${projectId}.${dataset}.external_contacts\``;
    await bq.query({ query: dropContactsQuery, useLegacySql: false, location: 'asia-northeast1' });

    const createContactsTableDDL = `
      CREATE TABLE \`${projectId}.${dataset}.external_contacts\` (
        contact_id STRING NOT NULL,
        email STRING NOT NULL,
        display_name STRING,
        company_domain STRING,
        contact_type STRING, -- 'customer', 'partner', 'vendor', 'system'
        total_messages INT64,
        risk_messages INT64,
        risk_rate FLOAT64,
        first_contact TIMESTAMP,
        last_contact TIMESTAMP,
        is_active BOOL,
        assigned_account_manager STRING,
        notes STRING,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY DATE(created_at)
      CLUSTER BY company_domain, contact_type, is_active
      OPTIONS (
        description = "External contact information for customer relationship management"
      )
    `;

    await bq.query({ query: createContactsTableDDL, useLegacySql: false, location: 'asia-northeast1' });
    console.log('✓ external_contacts テーブル作成完了');

    // Step 6: 外部コンタクトデータ挿入
    console.log('');
    console.log('📊 Step 6: 外部コンタクトデータ挿入');
    
    const insertContactsQuery = `
      INSERT INTO \`${projectId}.${dataset}.external_contacts\`
      (
        contact_id, email, display_name, company_domain, contact_type,
        total_messages, risk_messages, risk_rate, first_contact, last_contact, is_active
      )
      WITH contact_stats AS (
        SELECT 
          \`from\` as email,
          company_domain,
          COUNT(*) as total_messages,
          COUNTIF(primary_risk_type != 'low') as risk_messages,
          SAFE_DIVIDE(COUNTIF(primary_risk_type != 'low'), COUNT(*)) * 100 as risk_rate,
          MIN(datetime) as first_contact,
          MAX(datetime) as last_contact
        FROM \`${projectId}.${dataset}.unified_email_messages\`
        WHERE direction = 'external'
          AND \`from\` IS NOT NULL
          AND \`from\` != ''
          AND company_domain IS NOT NULL
          AND company_domain != ''
        GROUP BY \`from\`, company_domain
        HAVING total_messages >= 3 -- 最低3件のメッセージがあるコンタクトのみ
      )
      SELECT
        -- contact_idはemailのハッシュを使用
        TO_HEX(MD5(email)) as contact_id,
        email,
        -- display_nameはemailのローカル部分から推測
        REGEXP_REPLACE(REGEXP_EXTRACT(email, r'^([^@]+)'), r'[_.-]', ' ') as display_name,
        company_domain,
        -- emailパターンから連絡先タイプを推測
        CASE 
          WHEN email LIKE '%noreply%' OR email LIKE '%no-reply%' OR email LIKE '%mailer%' THEN 'system'
          WHEN total_messages >= 100 THEN 'customer'
          WHEN total_messages >= 20 THEN 'partner'
          ELSE 'vendor'
        END as contact_type,
        total_messages,
        risk_messages,
        risk_rate,
        first_contact,
        last_contact,
        -- 最近の活動から活動状態を判定
        DATE_DIFF(CURRENT_DATE(), DATE(last_contact), DAY) <= 60 as is_active
      FROM contact_stats
      ORDER BY total_messages DESC
    `;

    const [insertContactsJob] = await bq.createQueryJob({
      query: insertContactsQuery,
      useLegacySql: false,
      location: 'asia-northeast1',
      maximumBytesBilled: '5000000000' // 5GB limit
    });

    await insertContactsJob.getQueryResults();
    console.log('✓ 外部コンタクトデータ挿入完了');

    // Step 7: 統計情報表示
    console.log('');
    console.log('📊 Step 7: 作成結果確認');

    const statsQueries = [
      {
        name: '顧客企業',
        table: 'customer_companies',
        query: `
          SELECT 
            COUNT(*) as total_companies,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_companies,
            COUNT(CASE WHEN risk_level = 'high' OR risk_level = 'critical' THEN 1 END) as high_risk_companies,
            ROUND(AVG(total_messages), 0) as avg_messages_per_company,
            ROUND(AVG(risk_rate), 1) as avg_risk_rate
          FROM \`${projectId}.${dataset}.customer_companies\`
        `
      },
      {
        name: '内部ユーザー',
        table: 'internal_users',
        query: `
          SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN is_active THEN 1 END) as active_users,
            COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
            COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_users,
            ROUND(AVG(total_sent_messages), 0) as avg_messages_per_user
          FROM \`${projectId}.${dataset}.internal_users\`
        `
      },
      {
        name: '外部コンタクト',
        table: 'external_contacts',
        query: `
          SELECT 
            COUNT(*) as total_contacts,
            COUNT(CASE WHEN is_active THEN 1 END) as active_contacts,
            COUNT(CASE WHEN contact_type = 'customer' THEN 1 END) as customer_contacts,
            COUNT(CASE WHEN risk_rate >= 25 THEN 1 END) as high_risk_contacts,
            ROUND(AVG(total_messages), 0) as avg_messages_per_contact
          FROM \`${projectId}.${dataset}.external_contacts\`
        `
      }
    ];

    for (const stat of statsQueries) {
      const [result] = await bq.query({ query: stat.query, useLegacySql: false });
      const data = result[0];
      console.log(`\n📈 ${stat.name}統計:`);
      Object.entries(data).forEach(([key, value]) => {
        console.log(`  ${key}: ${value?.toLocaleString() || 'N/A'}`);
      });
    }

    console.log('');
    console.log('🎉 顧客情報・ユーザー管理テーブル作成完了！');
    console.log('');
    console.log('✅ 作成されたテーブル:');
    console.log('  • customer_companies: 顧客企業情報');
    console.log('  • internal_users: 内部ユーザー管理');
    console.log('  • external_contacts: 外部コンタクト管理');
    console.log('');
    console.log('🔧 機能:');
    console.log('  • 自動的な会社分類とリスクレベル設定');
    console.log('  • ユーザー権限管理');
    console.log('  • 活動状態の自動判定');
    console.log('  • パーティション・クラスタ最適化');

  } catch (e) {
    console.error('テーブル作成エラー:', e?.message || e);
    process.exit(1);
  }
})(); 
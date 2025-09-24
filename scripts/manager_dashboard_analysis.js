const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const bq = new BigQuery({ projectId: 'viewpers' });
    
    console.log('=== 管理者向けダッシュボード設計のためのデータ分析 ===');
    
    // 1. 部署別アラート分析
    console.log('📊 部署別アラート状況:');
    const deptQuery = `
      SELECT 
        CASE 
          WHEN company_domain = 'cross-m.co.jp' THEN
            CASE 
              WHEN \`from\` LIKE '%sales%' OR \`from\` LIKE '%eigyo%' THEN 'Sales'
              WHEN \`from\` LIKE '%marketing%' OR \`from\` LIKE '%pr%' THEN 'Marketing'
              WHEN \`from\` LIKE '%cs%' OR \`from\` LIKE '%support%' THEN 'Customer Support'
              WHEN \`from\` LIKE '%research%' OR \`from\` LIKE '%ri_%' THEN 'Research'
              WHEN \`from\` LIKE '%admin%' OR \`from\` LIKE '%sys%' THEN 'IT'
              ELSE 'General'
            END
          ELSE 'External'
        END as department,
        COUNT(*) as total_alerts,
        COUNTIF(primary_risk_type != 'low') as risk_alerts,
        COUNT(DISTINCT \`from\`) as unique_members,
        ROUND(AVG(score), 1) as avg_risk_score,
        MAX(datetime) as latest_alert
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY department
      ORDER BY risk_alerts DESC
      LIMIT 10
    `;
    
    const [deptResult] = await bq.query({ query: deptQuery, useLegacySql: false });
    deptResult.forEach(row => {
      const riskRate = row.total_alerts > 0 ? ((row.risk_alerts / row.total_alerts) * 100).toFixed(1) : '0.0';
      console.log(`  ${row.department}: ${row.risk_alerts}/${row.total_alerts}件 (リスク率${riskRate}%), メンバー${row.unique_members}人, 平均スコア${row.avg_risk_score}`);
    });
    
    // 2. 個人別パフォーマンス分析（修正版）
    console.log('');
    console.log('👤 個人別アラート状況 (内部ユーザー):');
    const memberQuery = `
      SELECT 
        \`from\` as member_email,
        REGEXP_EXTRACT(\`from\`, r'^([^@]+)') as member_name,
        COUNT(*) as total_messages,
        COUNTIF(primary_risk_type != 'low') as risk_messages,
        COUNT(DISTINCT thread_id) as threads_involved,
        ROUND(AVG(score), 1) as avg_risk_score,
        MAX(datetime) as last_activity
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE direction = 'internal'
        AND DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND \`from\` NOT LIKE '%noreply%'
        AND \`from\` NOT LIKE '%system%'
      GROUP BY \`from\`
      HAVING total_messages >= 10
      ORDER BY risk_messages DESC
      LIMIT 15
    `;
    
    const [memberResult] = await bq.query({ query: memberQuery, useLegacySql: false });
    memberResult.forEach(row => {
      const riskRate = row.total_messages > 0 ? ((row.risk_messages / row.total_messages) * 100).toFixed(1) : '0.0';
      console.log(`  ${row.member_name}: ${row.risk_messages}/${row.total_messages}件 (リスク率${riskRate}%), スレッド${row.threads_involved}件, 平均スコア${row.avg_risk_score}`);
    });
    
    // 3. 緊急対応が必要なケース
    console.log('');
    console.log('🚨 緊急対応が必要なアラート:');
    const urgentQuery = `
      SELECT 
        message_id,
        \`from\` as sender,
        \`to\` as recipient,
        subject,
        primary_risk_type,
        score,
        datetime,
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), datetime, HOUR) as hours_since_last
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE primary_risk_type IN ('high', 'critical')
        AND DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND direction = 'external'
      ORDER BY score DESC, datetime DESC
      LIMIT 10
    `;
    
    const [urgentResult] = await bq.query({ query: urgentQuery, useLegacySql: false });
    urgentResult.forEach(row => {
      const sender = row.sender ? row.sender.split('@')[0] : 'unknown';
      const hoursAgo = row.hours_since_last ? `${Math.floor(row.hours_since_last)}時間前` : 'N/A';
      console.log(`  ${sender}: スコア${row.score}, ${row.primary_risk_type}, ${hoursAgo} - ${row.subject?.substring(0, 50)}...`);
    });
    
    // 4. 対応状況分析
    console.log('');
    console.log('📈 対応状況分析:');
    const responseQuery = `
      WITH thread_analysis AS (
        SELECT 
          thread_id,
          COUNT(*) as message_count,
          COUNT(DISTINCT CASE WHEN direction = 'internal' THEN \`from\` END) as internal_responders,
          COUNT(DISTINCT CASE WHEN direction = 'external' THEN \`from\` END) as external_senders,
          MAX(CASE WHEN direction = 'internal' THEN datetime END) as last_internal_response,
          MAX(CASE WHEN direction = 'external' THEN datetime END) as last_external_message,
          MAX(score) as max_risk_score
        FROM \`viewpers.salesguard_alerts.unified_email_messages\`
        WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        GROUP BY thread_id
        HAVING COUNT(*) > 1
      )
      SELECT 
        COUNT(*) as total_threads,
        COUNT(CASE WHEN last_internal_response > last_external_message THEN 1 END) as responded_threads,
        COUNT(CASE WHEN last_internal_response IS NULL THEN 1 END) as no_response_threads,
        COUNT(CASE WHEN max_risk_score >= 50 THEN 1 END) as high_risk_threads,
        ROUND(AVG(message_count), 1) as avg_messages_per_thread,
        ROUND(AVG(internal_responders), 1) as avg_responders_per_thread
      FROM thread_analysis
    `;
    
    const [responseResult] = await bq.query({ query: responseQuery, useLegacySql: false });
    const stats = responseResult[0];
    console.log(`  総スレッド数: ${stats.total_threads}`);
    console.log(`  対応済み: ${stats.responded_threads}件 (${((stats.responded_threads/stats.total_threads)*100).toFixed(1)}%)`);
    console.log(`  未対応: ${stats.no_response_threads}件 (${((stats.no_response_threads/stats.total_threads)*100).toFixed(1)}%)`);
    console.log(`  高リスク: ${stats.high_risk_threads}件`);
    console.log(`  平均メッセージ数/スレッド: ${stats.avg_messages_per_thread}`);
    console.log(`  平均対応者数/スレッド: ${stats.avg_responders_per_thread}`);
    
    // 5. 時間帯別アラート分析
    console.log('');
    console.log('⏰ 時間帯別アラート発生状況:');
    const timeQuery = `
      SELECT 
        EXTRACT(HOUR FROM datetime) as hour,
        COUNT(*) as alert_count,
        COUNTIF(primary_risk_type != 'low') as risk_count,
        ROUND(AVG(score), 1) as avg_score
      FROM \`viewpers.salesguard_alerts.unified_email_messages\`
      WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        AND direction = 'external'
      GROUP BY hour
      ORDER BY hour
    `;
    
    const [timeResult] = await bq.query({ query: timeQuery, useLegacySql: false });
    console.log('  時間帯別アラート数:');
    timeResult.forEach(row => {
      const riskRate = row.alert_count > 0 ? ((row.risk_count / row.alert_count) * 100).toFixed(1) : '0.0';
      console.log(`    ${row.hour}時: ${row.alert_count}件 (リスク${row.risk_count}件, ${riskRate}%), 平均スコア${row.avg_score}`);
    });
    
  } catch (e) {
    console.error('分析エラー:', e?.message || e);
    process.exit(1);
  }
})(); 
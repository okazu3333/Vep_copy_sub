const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const dataset = 'salesguard_alerts';
    const bq = new BigQuery({ projectId });

    console.log('=== BigQuery Cost Estimation ===\n');

    // Pricing (as of 2024)
    const PRICE_PER_TB = 6.25; // USD per TB processed
    const bytesToTB = (bytes) => bytes / (1024 ** 4);
    const formatBytes = (bytes) => {
      if (bytes >= 1024 ** 4) return `${(bytes / (1024 ** 4)).toFixed(2)} TB`;
      if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
      if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
      return `${bytes} bytes`;
    };

    // Option 1: Time Travel Restore Cost Estimation
    console.log('📊 Option 1: Time Travel Restore');
    console.log('─'.repeat(50));

    const queries = [
      {
        name: 'Check current table size (alerts_v2_scored)',
        query: `SELECT 
          COUNT(*) as total_rows,
          APPROX_TOP_COUNT(DATE(datetime), 5) as date_distribution
        FROM \`${projectId}.${dataset}.alerts_v2_scored\``,
        dryRun: true
      },
      {
        name: 'Estimate snapshot creation (90 days)',
        query: `SELECT *
        FROM \`${projectId}.${dataset}.alerts_v2_scored\` FOR SYSTEM_TIME AS OF TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
        WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)`,
        dryRun: true
      },
      {
        name: 'Estimate DELETE operation (90 days)',
        query: `SELECT COUNT(*) FROM \`${projectId}.${dataset}.alerts_v2_scored\`
        WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)`,
        dryRun: true
      },
      {
        name: 'Estimate INSERT operation (90 days)',
        query: `SELECT * FROM \`${projectId}.${dataset}.alerts_v2_scored\`
        WHERE DATE(datetime) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)`,
        dryRun: true
      }
    ];

    let totalBytesOption1 = 0;

    for (const q of queries) {
      try {
        const [job] = await bq.createQueryJob({
          query: q.query,
          useLegacySql: false,
          location: 'asia-northeast1',
          dryRun: q.dryRun
        });
        
        const [metadata] = await job.getMetadata();
        const bytesProcessed = parseInt(metadata.statistics.query.totalBytesProcessed || '0');
        totalBytesOption1 += bytesProcessed;
        
        console.log(`  ${q.name}:`);
        console.log(`    Bytes: ${formatBytes(bytesProcessed)}`);
        console.log(`    Cost: $${(bytesToTB(bytesProcessed) * PRICE_PER_TB).toFixed(4)}`);
      } catch (e) {
        console.log(`  ${q.name}: ERROR - ${e.message}`);
      }
    }

    console.log(`\n  💰 Total Option 1 Cost: $${(bytesToTB(totalBytesOption1) * PRICE_PER_TB).toFixed(2)}`);
    console.log(`     Total Bytes: ${formatBytes(totalBytesOption1)}\n`);

    // Option 2: Alternative Table Check Cost Estimation
    console.log('📊 Option 2: Alternative Table Check');
    console.log('─'.repeat(50));

    const checkQueries = [
      {
        name: 'Check email_messages_threaded_v1 (30 days)',
        query: `SELECT COUNT(*) as count, MAX(DATE(date)) as latest_date 
        FROM \`${projectId}.${dataset}.email_messages_threaded_v1\` 
        WHERE DATE(date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`,
        dryRun: true
      },
      {
        name: 'Check email_messages_normalized (30 days)',
        query: `SELECT COUNT(*) as count
        FROM \`${projectId}.${dataset}.email_messages_normalized\``,
        dryRun: true
      },
      {
        name: 'Sample data structure check',
        query: `SELECT * FROM \`${projectId}.${dataset}.email_messages_threaded_v1\` LIMIT 10`,
        dryRun: true
      }
    ];

    let totalBytesOption2 = 0;

    for (const q of checkQueries) {
      try {
        const [job] = await bq.createQueryJob({
          query: q.query,
          useLegacySql: false,
          location: 'asia-northeast1',
          dryRun: q.dryRun
        });
        
        const [metadata] = await job.getMetadata();
        const bytesProcessed = parseInt(metadata.statistics.query.totalBytesProcessed || '0');
        totalBytesOption2 += bytesProcessed;
        
        console.log(`  ${q.name}:`);
        console.log(`    Bytes: ${formatBytes(bytesProcessed)}`);
        console.log(`    Cost: $${(bytesToTB(bytesProcessed) * PRICE_PER_TB).toFixed(4)}`);
      } catch (e) {
        console.log(`  ${q.name}: ERROR - ${e.message}`);
      }
    }

    console.log(`\n  💰 Total Option 2 Cost: $${(bytesToTB(totalBytesOption2) * PRICE_PER_TB).toFixed(2)}`);
    console.log(`     Total Bytes: ${formatBytes(totalBytesOption2)}\n`);

    // Summary
    console.log('📋 COST COMPARISON SUMMARY');
    console.log('═'.repeat(50));
    console.log(`Option 1 (Time Travel): $${(bytesToTB(totalBytesOption1) * PRICE_PER_TB).toFixed(2)} (${formatBytes(totalBytesOption1)})`);
    console.log(`Option 2 (Table Check):  $${(bytesToTB(totalBytesOption2) * PRICE_PER_TB).toFixed(2)} (${formatBytes(totalBytesOption2)})`);
    console.log(`Cost Difference: $${Math.abs(bytesToTB(totalBytesOption1 - totalBytesOption2) * PRICE_PER_TB).toFixed(2)}`);
    
    if (totalBytesOption1 > totalBytesOption2) {
      console.log(`🏆 Option 2 is ${((totalBytesOption1 / totalBytesOption2) - 1) * 100}% cheaper`);
    } else {
      console.log(`🏆 Option 1 is ${((totalBytesOption2 / totalBytesOption1) - 1) * 100}% cheaper`);
    }

    // Additional considerations
    console.log('\n📝 ADDITIONAL CONSIDERATIONS:');
    console.log('─'.repeat(50));
    console.log('Option 1 (Time Travel):');
    console.log('  ✅ Guaranteed solution (restores working state)');
    console.log('  ✅ Known procedure with rollback capability');
    console.log('  ❌ Higher immediate cost');
    console.log('  ⏱️  Time: 10-30 minutes');
    
    console.log('\nOption 2 (Table Check):');
    console.log('  ✅ Lower immediate cost');
    console.log('  ❌ May require additional work if data structure differs');
    console.log('  ❌ Might need Option 1 eventually (double cost)');
    console.log('  ⏱️  Time: 5-10 minutes + potential rework');

  } catch (e) {
    console.error('Cost estimation failed:', e?.message || e);
    process.exit(1);
  }
})(); 
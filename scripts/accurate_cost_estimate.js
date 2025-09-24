const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'viewpers';
    const dataset = 'salesguard_alerts';
    const bq = new BigQuery({ projectId });

    console.log('=== ACCURATE BigQuery Cost Estimation ===\n');

    // Pricing (as of 2024)
    const PRICE_PER_TB = 6.25; // USD per TB processed
    const bytesToTB = (bytes) => bytes / (1024 ** 4);
    const formatBytes = (bytes) => {
      if (bytes >= 1024 ** 4) return `${(bytes / (1024 ** 4)).toFixed(2)} TB`;
      if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
      if (bytes >= 1024 ** 2) return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
      return `${(bytes / 1024).toFixed(2)} KB`;
    };

    // Get table sizes from INFORMATION_SCHEMA
    console.log('📊 Getting Table Sizes from INFORMATION_SCHEMA');
    console.log('─'.repeat(60));

    const tableSizeQuery = `
      SELECT 
        table_id,
        ROUND(size_bytes / (1024*1024*1024), 2) as size_gb,
        size_bytes,
        row_count,
        ROUND(size_bytes / NULLIF(row_count, 0), 0) as bytes_per_row
      FROM \`${projectId}.${dataset}.__TABLES__\`
      WHERE table_id IN ('alerts_v2_scored', 'email_messages_threaded_v1', 'email_messages_normalized')
      ORDER BY size_bytes DESC
    `;

    const [tableSizes] = await bq.query({ 
      query: tableSizeQuery, 
      useLegacySql: false, 
      location: 'asia-northeast1' 
    });

    let alertsTableSize = 0;
    let emailThreadedSize = 0;
    let emailNormalizedSize = 0;

    console.log('Table Sizes:');
    tableSizes.forEach(row => {
      console.log(`  ${row.table_id}:`);
      console.log(`    Size: ${formatBytes(row.size_bytes)} (${row.size_gb} GB)`);
      console.log(`    Rows: ${row.row_count?.toLocaleString() || 'N/A'}`);
      console.log(`    Bytes/Row: ${row.bytes_per_row || 'N/A'}`);
      console.log('');

      if (row.table_id === 'alerts_v2_scored') alertsTableSize = row.size_bytes;
      if (row.table_id === 'email_messages_threaded_v1') emailThreadedSize = row.size_bytes;
      if (row.table_id === 'email_messages_normalized') emailNormalizedSize = row.size_bytes;
    });

    // Option 1: Time Travel Restore Cost Calculation
    console.log('💰 Option 1: Time Travel Restore Cost');
    console.log('─'.repeat(60));

    // Estimate 90 days = roughly 25% of total data (assuming 1 year retention)
    const estimatedDataRatio = 0.25; // 90 days out of ~360 days
    const snapshotBytes = alertsTableSize * estimatedDataRatio;
    const deleteBytes = alertsTableSize * 0.1; // DELETE scans less data
    const insertBytes = snapshotBytes;
    const dropBytes = 0; // DROP is free

    const option1TotalBytes = snapshotBytes + deleteBytes + insertBytes;
    const option1Cost = bytesToTB(option1TotalBytes) * PRICE_PER_TB;

    console.log(`  Snapshot Creation (90 days): ${formatBytes(snapshotBytes)}`);
    console.log(`  DELETE Operation: ${formatBytes(deleteBytes)}`);
    console.log(`  INSERT Operation: ${formatBytes(insertBytes)}`);
    console.log(`  DROP Operation: Free`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Total Bytes: ${formatBytes(option1TotalBytes)}`);
    console.log(`  💰 Total Cost: $${option1Cost.toFixed(2)}`);
    console.log('');

    // Option 2: Alternative Table Check Cost
    console.log('💰 Option 2: Alternative Table Check Cost');
    console.log('─'.repeat(60));

    // Light queries to check data availability
    const checkEmailThreadedBytes = emailThreadedSize * 0.01; // 1% scan for COUNT with date filter
    const checkEmailNormalizedBytes = emailNormalizedSize * 0.01; // 1% scan for COUNT
    const sampleDataBytes = emailThreadedSize * 0.001; // 0.1% for LIMIT 10

    const option2TotalBytes = checkEmailThreadedBytes + checkEmailNormalizedBytes + sampleDataBytes;
    const option2Cost = bytesToTB(option2TotalBytes) * PRICE_PER_TB;

    console.log(`  Check email_messages_threaded_v1: ${formatBytes(checkEmailThreadedBytes)}`);
    console.log(`  Check email_messages_normalized: ${formatBytes(checkEmailNormalizedBytes)}`);
    console.log(`  Sample data structure: ${formatBytes(sampleDataBytes)}`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Total Bytes: ${formatBytes(option2TotalBytes)}`);
    console.log(`  💰 Total Cost: $${option2Cost.toFixed(2)}`);
    console.log('');

    // Summary and Recommendation
    console.log('📋 COST COMPARISON SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Option 1 (Time Travel): $${option1Cost.toFixed(2)} (${formatBytes(option1TotalBytes)})`);
    console.log(`Option 2 (Table Check):  $${option2Cost.toFixed(2)} (${formatBytes(option2TotalBytes)})`);
    
    const costDifference = Math.abs(option1Cost - option2Cost);
    const cheaperOption = option1Cost < option2Cost ? 'Option 1' : 'Option 2';
    const expensiveOption = option1Cost > option2Cost ? 'Option 1' : 'Option 2';
    const costRatio = option1Cost > option2Cost ? (option1Cost / option2Cost) : (option2Cost / option1Cost);
    
    console.log(`Cost Difference: $${costDifference.toFixed(2)}`);
    console.log(`🏆 ${cheaperOption} is ${((costRatio - 1) * 100).toFixed(1)}% cheaper than ${expensiveOption}`);
    console.log('');

    // Risk Analysis
    console.log('⚠️  RISK ANALYSIS');
    console.log('─'.repeat(60));
    console.log('Option 2 Risks:');
    console.log('  • May discover data structure incompatibilities');
    console.log('  • Might need Option 1 eventually (double cost)');
    console.log('  • Additional development time for VIEW adjustments');
    console.log(`  • Potential total cost: $${(option2Cost + option1Cost).toFixed(2)} if both needed`);
    console.log('');

    // Final Recommendation
    console.log('🎯 RECOMMENDATION');
    console.log('═'.repeat(60));
    
    if (costDifference < 1.0) {
      console.log('💡 Cost difference is minimal (<$1.00)');
      console.log('🏆 RECOMMENDED: Option 1 (Time Travel)');
      console.log('   Reasons: Guaranteed solution, known procedure, minimal cost difference');
    } else if (option2Cost * 2 < option1Cost) {
      console.log('💡 Option 2 is significantly cheaper');
      console.log('🏆 RECOMMENDED: Option 2 (Table Check first)');
      console.log('   Reasons: Major cost savings, worth the investigation risk');
    } else {
      console.log('💡 Moderate cost difference with high risk of rework');
      console.log('🏆 RECOMMENDED: Option 1 (Time Travel)');
      console.log('   Reasons: Avoid potential double cost, guaranteed resolution');
    }

  } catch (e) {
    console.error('Cost estimation failed:', e?.message || e);
    process.exit(1);
  }
})(); 
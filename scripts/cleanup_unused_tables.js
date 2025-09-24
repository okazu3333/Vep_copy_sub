const { BigQuery } = require('@google-cloud/bigquery');

(async () => {
  try {
    const bq = new BigQuery({ projectId: 'viewpers' });
    const dataset = bq.dataset('salesguard_alerts');
    
    console.log('=== BigQuery テーブル/VIEW クリーンアップ ===');
    
    // Get all tables and views in the dataset
    const [tables] = await dataset.getTables();
    
    console.log('📊 現在のリソース一覧:');
    const resourceList = [];
    
    for (const table of tables) {
      const [metadata] = await table.getMetadata();
      const tableId = metadata.tableReference.tableId;
      const type = metadata.type;
      const creationTime = new Date(parseInt(metadata.creationTime));
      const lastModified = new Date(parseInt(metadata.lastModifiedTime || metadata.creationTime));
      
      // Get table size
      let numRows = 0;
      let numBytes = 0;
      
      if (type === 'TABLE') {
        numRows = parseInt(metadata.numRows || 0);
        numBytes = parseInt(metadata.numBytes || 0);
      }
      
      resourceList.push({
        id: tableId,
        type: type,
        rows: numRows,
        bytes: numBytes,
        created: creationTime,
        modified: lastModified
      });
      
      const sizeStr = numBytes > 0 ? `(${(numBytes / (1024**3)).toFixed(2)} GB)` : '';
      const typeIcon = type === 'VIEW' ? '📋' : '📊';
      console.log(`  ${typeIcon} ${tableId}: ${numRows.toLocaleString()}行 ${sizeStr}`);
    }
    
    console.log('');
    console.log('🔍 使用中リソース定義:');
    const activeResources = [
      'unified_email_messages',           // メイン統合テーブル
      'alerts_v2_compat_unified',         // 互換VIEW (alerts API用)
      'messages_compat_unified',          // 互換VIEW (messages API用)
      'email_messages_normalized',        // 元データ (バックアップ用)
      'alerts_v2_scored',                // 元データ (バックアップ用)
      'email_messages_threaded_v1',      // 元データ (バックアップ用)
      'users',                           // ユーザー管理
      'companies'                        // 会社情報
    ];
    
    activeResources.forEach(name => {
      const found = resourceList.find(t => t.id === name);
      if (found) {
        console.log(`  ✅ ${name}: 使用中 (${found.type})`);
      } else {
        console.log(`  ❌ ${name}: 見つからない`);
      }
    });
    
    console.log('');
    console.log('🗑️ 削除候補テーブル:');
    const tablesToDelete = resourceList.filter(resource => 
      !activeResources.includes(resource.id) && 
      resource.type === 'TABLE' &&
      !resource.id.includes('backup') && // バックアップは手動確認
      !resource.id.includes('_bak') &&   // バックアップは手動確認
      resource.id !== 'temp_reply_levels' && // 一時テーブル（存在しないはず）
      resource.id !== 'temp_message_levels'  // 一時テーブル（存在しないはず）
    );
    
    tablesToDelete.forEach(table => {
      const age = Math.floor((Date.now() - table.created.getTime()) / (1000 * 60 * 60 * 24));
      const sizeStr = table.bytes > 0 ? `(${(table.bytes / (1024**3)).toFixed(2)} GB)` : '';
      console.log(`  🗑️ ${table.id}: ${table.rows.toLocaleString()}行 ${sizeStr} - ${age}日前作成`);
    });
    
    if (tablesToDelete.length === 0) {
      console.log('  削除候補テーブルなし');
    }
    
    console.log('');
    console.log('📋 削除候補VIEW:');
    const viewsToDelete = resourceList.filter(resource => 
      !activeResources.includes(resource.id) && 
      resource.type === 'VIEW'
    );
    
    viewsToDelete.forEach(view => {
      const age = Math.floor((Date.now() - view.created.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  📋 ${view.id}: ${age}日前作成`);
    });
    
    if (viewsToDelete.length === 0) {
      console.log('  削除候補VIEWなし');
    }
    
    // Calculate total storage savings
    const totalBytesToDelete = tablesToDelete.reduce((sum, table) => sum + table.bytes, 0);
    const totalGBToDelete = totalBytesToDelete / (1024**3);
    
    console.log('');
    console.log('💾 削除による節約効果:');
    console.log(`  削除対象テーブル: ${tablesToDelete.length}個`);
    console.log(`  削除対象VIEW: ${viewsToDelete.length}個`);
    console.log(`  ストレージ節約: ${totalGBToDelete.toFixed(2)} GB`);
    
    // Execute deletion if there are candidates
    if (tablesToDelete.length > 0 || viewsToDelete.length > 0) {
      console.log('');
      console.log('🗑️ 削除実行中...');
      
      // Delete tables
      for (const table of tablesToDelete) {
        try {
          const dropQuery = `DROP TABLE \`viewpers.salesguard_alerts.${table.id}\``;
          await bq.query({ query: dropQuery, useLegacySql: false, location: 'asia-northeast1' });
          console.log(`  ✅ テーブル削除: ${table.id}`);
        } catch (e) {
          console.log(`  ❌ テーブル削除失敗: ${table.id} - ${e.message}`);
        }
      }
      
      // Delete views
      for (const view of viewsToDelete) {
        try {
          const dropQuery = `DROP VIEW \`viewpers.salesguard_alerts.${view.id}\``;
          await bq.query({ query: dropQuery, useLegacySql: false, location: 'asia-northeast1' });
          console.log(`  ✅ VIEW削除: ${view.id}`);
        } catch (e) {
          console.log(`  ❌ VIEW削除失敗: ${view.id} - ${e.message}`);
        }
      }
      
      console.log('');
      console.log('🎉 クリーンアップ完了！');
      console.log(`  削除したテーブル: ${tablesToDelete.length}個`);
      console.log(`  削除したVIEW: ${viewsToDelete.length}個`);
      console.log(`  節約したストレージ: ${totalGBToDelete.toFixed(2)} GB`);
    } else {
      console.log('');
      console.log('✨ データベースは既にクリーンです！');
    }
    
    console.log('');
    console.log('📊 残存リソース:');
    const remainingResources = resourceList.filter(r => 
      activeResources.includes(r.id) || 
      r.id.includes('backup') || 
      r.id.includes('_bak')
    );
    
    remainingResources.forEach(resource => {
      const typeIcon = resource.type === 'VIEW' ? '📋' : '📊';
      const sizeStr = resource.bytes > 0 ? `(${(resource.bytes / (1024**3)).toFixed(2)} GB)` : '';
      console.log(`  ${typeIcon} ${resource.id}: ${resource.rows.toLocaleString()}行 ${sizeStr}`);
    });

  } catch (e) {
    console.error('クリーンアップエラー:', e.message);
    process.exit(1);
  }
})(); 
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 アラート表示システム起動スクリプト');
console.log('📊 デコード処理完了を待機中...');

// デコード処理の完了を監視
function waitForDecodeCompletion() {
  return new Promise((resolve) => {
    const checkProcess = () => {
      const { exec } = require('child_process');
      exec('ps aux | grep "simple-japanese-decode" | grep -v grep', (error, stdout) => {
        if (stdout.trim() === '') {
          console.log('✅ デコード処理が完了しました');
          resolve();
        } else {
          console.log('⏳ デコード処理実行中... 30秒後に再チェック');
          setTimeout(checkProcess, 30000);
        }
      });
    };
    checkProcess();
  });
}

// APIサーバーを起動
function startAPIServer() {
  console.log('🚨 アラートAPIサーバーを起動中...');
  
  const apiServer = spawn('node', ['scripts/create-alerts-api.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  apiServer.on('error', (error) => {
    console.error('❌ APIサーバー起動エラー:', error);
  });

  return apiServer;
}

// 静的ファイルサーバーを起動
function startStaticServer() {
  console.log('🌐 静的ファイルサーバーを起動中...');
  
  const staticServer = spawn('npx', ['http-server', 'public', '-p', '3003', '-c-1'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  staticServer.on('error', (error) => {
    console.error('❌ 静的ファイルサーバー起動エラー:', error);
  });

  return staticServer;
}

// メイン処理
async function main() {
  try {
    // デコード処理完了を待機
    await waitForDecodeCompletion();
    
    // 少し待機してテーブル作成完了を確認
    console.log('⏳ テーブル作成完了を待機中...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // APIサーバーを起動
    const apiServer = startAPIServer();
    
    // 5秒待機してから静的ファイルサーバーを起動
    setTimeout(() => {
      const staticServer = startStaticServer();
      
      console.log('\n🎉 アラート表示システムが起動しました！');
      console.log('📊 アクセスURL:');
      console.log('   - アラート一覧: http://localhost:3003/alerts.html');
      console.log('   - API エンドポイント: http://localhost:3002/api/alerts');
      console.log('\n📋 機能:');
      console.log('   - 日本語表記でのメール本文全文表示');
      console.log('   - 検索機能（件名、送信者、受信者、本文）');
      console.log('   - 品質スコア表示');
      console.log('   - ページネーション');
      console.log('   - 統計情報表示');
      
      // プロセス終了時の処理
      process.on('SIGINT', () => {
        console.log('\n🛑 システムを停止中...');
        apiServer.kill();
        staticServer.kill();
        process.exit(0);
      });
      
    }, 5000);
    
  } catch (error) {
    console.error('❌ システム起動エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行
main(); 
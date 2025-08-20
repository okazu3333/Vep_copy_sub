# ファイル整理計画

## 現在の状況
- 大量の古いスクリプトファイルが残っている
- 複数のAPIシステムが混在している
- 不要なドキュメントファイルが多い

## 整理対象

### 1. 削除対象のスクリプト
**古いデコードスクリプト（失敗したもの）:**
- `scripts/comprehensive-japanese-decode.js`
- `scripts/final-japanese-decode.js`
- `scripts/update-decoded-data.js`
- `scripts/comprehensive-bigquery-udf.js`
- `scripts/targeted-bigquery-decode.js`
- `scripts/analyze-bigquery-encoding.js`
- `scripts/decode-with-bigquery-native.js`
- `scripts/create-simple-udf.js`
- `scripts/create-bigquery-udf.js`
- `scripts/check-character-encoding.js`
- `scripts/update-decoded-data-basic.js`
- `scripts/update-decoded-data-simple.js`
- `scripts/decode-encoded-strings.js`

**古いマイグレーションスクリプト:**
- `scripts/analyze-from-to-relationships.js`
- `scripts/analyze-email-details.js`
- `scripts/analyze-salesguard-data.js`
- `scripts/check-mbox-structure.js`
- `scripts/check-all-tables.js`
- `scripts/check-real-data.js`
- `scripts/analyze-data.js`
- `scripts/bigquery-monitoring.js`
- `scripts/update-keywords-batch.js`
- `scripts/monitoring-scheduler.js`
- `scripts/performance-monitoring.js`
- `scripts/cost-monitoring.js`

**古いVM/Cloud Functionsスクリプト:**
- `scripts/vm-startup-optimized.sh`
- `scripts/vm-startup-script.sh`
- `scripts/working-mime-decode.js`
- `scripts/simple-migrate.js`
- `scripts/simple-mime-decode.js`
- `scripts/storage-function-trigger.sql`
- `scripts/test-advanced-decoder.js`
- `scripts/test-japanese-decoder.js`
- `scripts/test-migration-fixed.js`
- `scripts/test-migration.js`
- `scripts/ultra-light-japanese-processor.js`
- `scripts/run-pandas-migration.sh`
- `scripts/schedule-migration.js`
- `scripts/setup-vm-environment.sh`
- `scripts/setup-vm-high-performance.sh`
- `scripts/simple-efficient-migration.js`
- `scripts/simple-email-decoder.js`
- `scripts/quick-pandas-test.py`
- `scripts/retry-missing-migration-fixed.js`
- `scripts/retry-missing-migration.js`
- `scripts/robust-mbox-processor.js`
- `scripts/run-cloud-functions.js`
- `scripts/memory-efficient-mbox.js`
- `scripts/migrate-data.js`
- `scripts/migrate-via-api.js`
- `scripts/optimized-mbox-processor.js`
- `scripts/optimized-migration.sql`
- `scripts/pandas-migrate.py`
- `scripts/fix-unicode-escapes.js`
- `scripts/fixed-mbox-processor.js`
- `scripts/improve-data-quality.js`
- `scripts/investigate-body-data.js`
- `scripts/investigate-encoding.js`
- `scripts/japanese-mbox-processor.js`
- `scripts/local-mbox-processor.js`
- `scripts/fix-decoded-content.js`
- `scripts/fix-mime-decode-v2.js`
- `scripts/fix-mime-headers.sql`
- `scripts/fix-remaining-garbled-patterns.js`
- `scripts/fix-subject-encoding.js`
- `scripts/final-mime-decode.js`
- `scripts/final-targeted-fix.js`
- `scripts/final-working-mime-decode.js`
- `scripts/fix-all-encoding-issues.js`
- `scripts/enhance-cloudsql-structure.sql`
- `scripts/execute-mime-decode.js`
- `scripts/extract-email-addresses.js`
- `scripts/extract-to-gcs.sh`
- `scripts/final-fix-remaining.js`
- `scripts/comprehensive-text-cleanup.js`
- `scripts/create-default-rules.js`
- `scripts/debug-mime-pattern.js`
- `scripts/debug-real-data.js`
- `scripts/decode-functions.sql`
- `scripts/deploy-cloud-function.sh`
- `scripts/efficient-bigquery-migration.js`
- `scripts/bq-elt-transform.sql`
- `scripts/bq-load-mbox-data.sh`
- `scripts/bulk-fix-all-data.js`
- `scripts/check-results.js`
- `scripts/check-schema.js`
- `scripts/complete-mbox-pipeline.sh`
- `scripts/analyze-bigquery-schema.js`
- `scripts/analyze-existing-data.js`
- `scripts/analyze-missing-data.js`
- `scripts/auto-setup-vm.sh`

### 2. 保持対象のスクリプト
**現在使用中のスクリプト:**
- `scripts/simple-japanese-decode.js` - 現在のデコード処理
- `scripts/fix-message-body.js` - 本文修正処理
- `scripts/check-fixed-table.js` - テーブル確認
- `scripts/check-decoded-data.js` - デコード状況確認
- `scripts/display-bigquery-data.js` - データ表示
- `scripts/check-table-structure.js` - テーブル構造確認

**API関連:**
- `scripts/create-alerts-api.js` - カスタムAPI（ポート3002）
- `scripts/start-alerts-system.js` - システム起動

### 3. 削除対象のドキュメント
**古い分析レポート:**
- `BIGQUERY_MIGRATION_STEPS.md`
- `SALESGUARD_DATABASE_API_REPORT.md`
- `PHRASE_LOGIC_IMPLEMENTATION_COMPLETE.md`
- `MONITORING_SYSTEM_COMPLETE.md`
- `BIGQUERY_MIGRATION_COMPLETE.md`
- `BIGQUERY_DECODE_PROCESSING.md`
- `BIGQUERY_ONLY_ARCHITECTURE.md`
- `SALESGUARD_COST_REPORT_TODAY.md`
- `SYSTEM_ERROR_ANALYSIS_REPORT.md`
- `ARCHITECTURE_CHANGE_ANALYSIS.md`
- `SALESGUARD_COST_ANALYSIS.md`
- `COST_ANALYSIS_DETAILED.md`
- `COST_OPTIMIZATION_REPORT.md`
- `REAL_BUSINESS_DATA_ANALYSIS.md`
- `SYSTEM_OPTIMIZATION_PLAN.md`
- `CLOUDSQL_DATA_DIAGNOSIS.md`
- `COMPREHENSIVE_DATA_ARCHITECTURE_DIAGNOSIS.md`
- `DATA_QUALITY_SCORE_ANALYSIS.md`
- `BIGQUERY_DATA_DIAGNOSIS.md`

### 4. 保持対象のドキュメント
- `README.md`
- `CLEANUP_PLAN.md`（このファイル）

### 5. 削除対象のディレクトリ
- `archive/` - 古いアーカイブ
- `cloud-functions/` - 使用していないCloud Functions
- `cloud-run/` - 使用していないCloud Run

### 6. 保持対象のディレクトリ
- `app/` - Next.jsアプリケーション
- `components/` - Reactコンポーネント
- `lib/` - ユーティリティ
- `types/` - TypeScript型定義
- `hooks/` - React Hooks
- `styles/` - スタイルファイル
- `public/` - 静的ファイル（alerts.htmlは削除予定）

## 実行計画

### Phase 1: 古いスクリプトの削除
1. 削除対象のスクリプトファイルを削除
2. 不要なドキュメントファイルを削除

### Phase 2: ディレクトリの整理
1. 不要なディレクトリを削除
2. ファイル構造を整理

### Phase 3: APIシステムの整理
1. 現在使用中のAPIシステムを確認
2. 不要なAPIファイルを削除

### Phase 4: 最終確認
1. 必要なファイルが残っているか確認
2. システムが正常に動作するかテスト

## 現在のシステム構成

### メインシステム（ポート3000）
- Next.jsアプリケーション
- BigQueryからデータを取得
- セグメント分類機能
- ページネーション機能

### カスタムAPI（ポート3002）
- Express.js APIサーバー
- BigQueryからデータを取得
- リプライ機能
- スレッド機能

### 静的ファイル（ポート3003）
- http-server
- alerts.html（カスタムアラート表示）

## 推奨アクション
1. 古いスクリプトファイルを削除
2. 不要なドキュメントを削除
3. ディレクトリ構造を整理
4. 現在のシステム構成を維持 
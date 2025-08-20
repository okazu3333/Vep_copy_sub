# libディレクトリクリーンアップ計画

## 📋 現在の問題
- 重複ファイルが多数存在
- 類似機能のファイルが分散
- ファイル名にスペースが含まれている
- TypeScriptとJavaScriptの混在

## 🧹 削除対象ファイル

### 1. 重複ファイル（即座に削除）
- `keyword-detector 2.ts` (keyword-detector.tsの重複)
- `keyword-extractor 2.js` (keyword-extractor.jsの重複)
- `keyword-extractor 2.ts` (keyword-extractor.tsの重複)

### 2. 古いバージョン（削除候補）
- `keyword-extractor.js` (TypeScript版があるため)
- `query-cache.js` (使用されていない可能性)

### 3. 統合対象ファイル
- `japanese-decoder.ts` + `email-decoder.ts` + `advanced-email-decoder.ts` → `unified-email-decoder.ts`
- `db-decoder.ts` + `database-pool.ts` → `database-manager.ts`

## 📊 整理後の構造

### 保持するファイル
- `database-pool.ts` - データベース接続管理
- `bigquery-optimizer.ts` - BigQuery最適化
- `alert-details.ts` - アラート詳細処理
- `alert-id-generator.ts` - ID生成
- `csv-handler.ts` - CSV処理
- `utils.ts` - ユーティリティ
- `dummy-data.ts` - テストデータ
- `google-directory.ts` - Google Directory API
- `data-ingestion/` - データインジェクション関連

### 新規作成ファイル
- `unified-email-decoder.ts` - 統合メールデコーダー
- `database-manager.ts` - 統合データベース管理

## 🚀 実装手順

### ステップ1: 重複ファイル削除
```bash
rm "lib/keyword-detector 2.ts"
rm "lib/keyword-extractor 2.js"
rm "lib/keyword-extractor 2.ts"
```

### ステップ2: 古いファイル削除
```bash
rm lib/keyword-extractor.js
rm lib/query-cache.js
```

### ステップ3: 統合ファイル作成
- デコーダー関連ファイルを統合
- データベース関連ファイルを統合

## 📈 期待される効果
- ファイル数削減: 25個 → 15個
- 重複コードの排除
- メンテナンス性向上
- コードの一貫性確保 
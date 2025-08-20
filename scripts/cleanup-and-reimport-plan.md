# データクリーンアップと再インポート計画

## 📋 現在の問題
- 30個以上のスクリプトが存在
- 重複機能のスクリプトが多数
- デコード品質が低い（送信者14.5%、件名1.3%）
- APIエラーが発生中

## 🧹 クリーンアップ計画

### ステップ1: 不要スクリプトの削除
以下のスクリプトを削除（重複または古いバージョン）:
- `complete-decode-implementation.js`
- `nodejs-decode-implementation.js`
- `implement-fixed-decode.js`
- `debug-decode-issue.js`
- `implement-basic-decode.js`
- `test-decode-implementation.js`
- `analyze-decode-targets.js`
- `test-final-logic.js`
- `safe-decode-subjects.js`
- `final-decode-subjects.js`
- `test-new-logic.js`
- `decode-subjects-node.js`
- `complete-subject-decode.js`
- `propose-new-logic.js`
- `check-current-logic.js`
- `check-phrase-logic.js`
- `analyze-phrase-patterns.js`
- `check-fixed-table.js`
- `fix-message-body.js`
- `check-decoded-data.js`
- `simple-japanese-decode.js`

### ステップ2: 保持するスクリプト
以下のスクリプトを保持:
- `check-table-structure.js` - テーブル構造確認用
- `display-bigquery-data.js` - データ表示用
- `create-alerts-api.js` - API用（修正予定）

### ステップ3: 新規作成するスクリプト
1. `complete-data-reimport.js` - 完全データ再インポート
2. `verify-reimport-results.js` - 結果検証
3. `update-api-endpoints.js` - API更新

## 🚀 再インポート戦略

### フェーズ1: 準備
1. 不要スクリプト削除
2. 新しいテーブル作成
3. デコード関数作成

### フェーズ2: 実行
1. 771,705件のデータを完全デコード
2. 品質チェック
3. 結果検証

### フェーズ3: 移行
1. API更新
2. システムテスト
3. 本番切り替え

## 📊 期待される改善
- デコード済み送信者: 14.5% → 80%以上
- デコード済み件名: 1.3% → 65%以上
- 平均品質スコア: 50.6点 → 75点以上

## ⚠️ 注意事項
- 処理時間: 10-30分
- コスト: $5-15
- データ量: 771,705件 
# フェーズA 実行手順（BigQueryビュー構築）

この手順では `viewpers.salesguard_alerts` データセットにフェーズAで必要となるビューをデプロイし、動作確認までを一気通貫で実施します。既に権限付与済みのアカウントで `bq` CLI もしくは BigQuery コンソールから実行してください。

---

## 0. 前提条件チェック
- BigQuery プロジェクト: `viewpers`
- データセット: `salesguard_alerts`
- 付与ロール: `roles/bigquery.dataEditor`, `roles/bigquery.jobUser`
- ローカルに `scripts/sql/bq_setup_detection.sql` が最新化されていること
- 実行端末に `bq` CLI がインストール済みであること

---

## 1. データセット/テーブルの把握
```bash
bq ls viewpers
bq ls viewpers:salesguard_alerts
```

詳細スキーマが必要な場合は以下のコマンドを併用します。
```bash
bq show --format=prettyjson viewpers:salesguard_alerts.unified_email_messages
```

---

## 2. スクリプトの実行
`scripts/sql/bq_setup_detection.sql` にはフェーズA〜Cまでのビュー作成 SQL がまとめられています。フェーズA部分のみを適用する場合は `--discover_schema` を無効化し、スクリプト全体を `bq query` で流し込みます。

```bash
bq query \
  --use_legacy_sql=false \
  --allow_large_results \
  --project_id=viewpers \
  "$(cat scripts/sql/bq_setup_detection.sql)"
```

特定ビューのみを再作成したい場合は、該当セクションを抜き出して個別に `bq query` を実行してください（例: `vw_change_points`）。

---

## 3. 作成結果の確認
ビューが作成されたかを確認します。

```bash
bq ls --view viewpers:salesguard_alerts | grep vw_change_points
bq ls --view viewpers:salesguard_alerts | grep vw_behavior_anomaly
```

データを簡易確認するには LIMIT 5 などでサンプルを取得します。
```bash
bq query --use_legacy_sql=false '
  SELECT * FROM `viewpers.salesguard_alerts.vw_change_points`
  ORDER BY change_score DESC
  LIMIT 10;
'
```

---

## 4. 運用スケジュール設定（任意）
日次リフレッシュを自動化する場合は、BigQuery のスケジュールドクエリで `CREATE OR REPLACE VIEW ...` を含むクエリを登録します。推奨設定は以下です。
- 実行頻度: 毎日 06:00 JST
- 実行クエリ: `scripts/sql/bq_setup_detection.sql` から対象ビューの `CREATE OR REPLACE` セクションのみを抜粋

---

## 5. 評価・検証
フェーズA終了後は `alerts_labels`（手順2で作成されます）に評価用ラベルを投入し、Precision/Recall 集計 SQL を実行して品質を確認します。必要な SQL テンプレートは `docs/alerts_validation.md` を参照してください。

---

## 備考
- スクリプトは `CREATE OR REPLACE` を利用しているため、再実行時も安全に更新されます。
- `vw_change_points` は感情スコアの乖離をベースにしているため、感情指標の欠損が多い場合は閾値調整（例えば `change_score > 0.2` など）を検討してください。
- `vw_behavior_anomaly` は返信頻度と感情差分をz-scoreではなく差分量で合成しています。必要に応じて標準偏差で正規化するロジックへ改修してください。


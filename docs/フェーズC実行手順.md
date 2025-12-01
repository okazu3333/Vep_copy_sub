# フェーズC 実行手順（incident_outcomes）

## 0. 前提
- BigQuery プロジェクト: `viewpers`
- データセット: `salesguard_alerts`
- ロール: `roles/bigquery.dataEditor`, `roles/bigquery.jobUser`
- Python 環境に以下パッケージが導入済み  
  `google-cloud-bigquery`, `pandas`, `scikit-learn`, `lifelines`
- `.env` または環境変数 `GOOGLE_CLOUD_PROJECT_ID=viewpers`

---

## 1. BigQuery アセットの作成/更新
`scripts/sql/bq_phase_c_incident_outcomes.sql` には学習ビューと推論テーブルの DDL がまとまっています。以下で実行します。

```bash
bq query \
  --use_legacy_sql=false \
  --allow_large_results \
  --project_id=viewpers \
  < scripts/sql/bq_phase_c_incident_outcomes.sql
```

### 作成されるリソース
- `vw_incident_features`: フェーズC 学習に必要な特徴量ビュー
- `incident_outcomes`: 推論結果の保存先テーブル（存在しない場合のみ作成）

確認コマンド:
```bash
bq show --format=prettyjson viewpers:salesguard_alerts.vw_incident_features
bq ls viewpers:salesguard_alerts | grep incident_outcomes
```

---

## 2. 学習・推論スクリプトの実行
Python スクリプト `scripts/modeling/train_incident_outcomes.py` は以下の流れで動作します。
1. `vw_incident_features` を BigQuery から取得
2. ロジスティック回帰（24h鎮火確率）と CoxPH サバイバルモデルを学習
3. 予測結果をテーブル `incident_outcomes` へ append（`--write` 指定時）

### 実行例（評価のみ）
```bash
python scripts/modeling/train_incident_outcomes.py \
  --project_id viewpers \
  --model_version 20251030-dev \
  --limit 500 \
  --log_level INFO
```

### 実行例（BigQueryへ書き込み）
```bash
python scripts/modeling/train_incident_outcomes.py \
  --project_id viewpers \
  --model_version 20251030-prod \
  --write \
  --log_level INFO
```

---

## 3. 結果検証
- 直近の推論レコード確認
  ```bash
  bq query --use_legacy_sql=false '
    SELECT incident_id, predicted_at, p_resolved_24h, ttr_pred_min
    FROM `viewpers.salesguard_alerts.incident_outcomes`
    ORDER BY predicted_at DESC
    LIMIT 20;'
  ```
- ROC-AUC などの指標はスクリプト実行ログに出力されます。必要に応じてメトリクスを BigQuery テーブルに書き込むロジックを追加してください。

---

## 4. スケジューリング（推奨）
| タスク | 推奨頻度 | 手段 |
|--------|----------|------|
| `vw_incident_features` 更新 | 日次 06:00 JST | スケジュールドクエリ（`bq_phase_c_incident_outcomes.sql` 内 `CREATE OR REPLACE VIEW` 部分） |
| 学習+推論実行 | 週次 | Cloud Run Job / Composer / GitHub Actions |
| モデル監視 | 週次 | AUC, C-index, 推定TTRと実測TTRの誤差をBigQueryに記録 |

---

## 5. 次のアクション
- BigQueryテーブルのデータ鮮度（`vw_incident_lifecycle`／`alerts_v2_scored`）を確認し、不足があればETL側で補填
- `incident_outcomes` に書き込む際のモデルメタデータ（特徴量のバージョン、評価結果）を追加する
- ダッシュボードや通知機能で `p_resolved_24h` と `ttr_pred_min` を参照するようUI/APIを更新

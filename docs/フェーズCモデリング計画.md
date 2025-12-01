# フェーズC モデリング計画（incident_outcomes）

## 目的
- 検知されたインシデント（`thread_id × rule_id`）に対し、**鎮火確率**と**鎮火までの時間（Time To Resolution; TTR）**を予測する。
- 予測結果は `viewpers.salesguard_alerts.incident_outcomes` に保存し、ダッシュボードおよび再通知ロジックの根拠として活用する。

## 使用データセット
- `vw_incident_lifecycle`（既存）  
  - 列: `incident_id`, `thread_id`, `rule_id`, `detect_at`, `first_follow_at`, `resolved_at`, `ttr_first_min`, `baseline_sentiment`, `at_detection_sentiment`, `post_followup_sentiment`, `sentiment_recovery`
- `vw_person_health`（既存）  
  - 担当者の稼働指標（未対応件数、夜間返信率、中央値TTR等）
- `vw_behavior_anomaly`, `vw_change_points`（既存）  
  - トレンド指標を incident 単位へ紐付けて特徴量化
- `alerts_v2`（ステータス、優先度、担当者など）
- `unified_email_messages`（検知直前/直後の文脈補足）

## 特徴量設計
| カテゴリ | 具体的な指標 |
|----------|--------------|
| 対応速度 | `ttr_first_min`、`detect_at` からの経過時間、`first_follow_at` までのギャップ |
| 感情トレンド | `sentiment_recovery`、`baseline_sentiment`、`at_detection_sentiment`、`post_followup_sentiment` |
| 活動量 | `recent_msgs`, `past_msgs`, `recent_daily_reply_rate`, `freq_drop` |
| 担当者ステータス | `open_incidents`, `overdue_72h`, `night_ratio_7d`, `median_ttr_first_min` |
| ルール種別 | `rule_id` のOne-hot、検知スコア（`vw_alerts_scored_bq.final_score`） |
| 顧客属性 | `alerts_v2.priority`, `alerts_v2.department`, `company_domain` |

## ラベル定義
- **ロジスティック回帰用ラベル**: `resolved_within_24h`（`resolved_at` が `detect_at`＋24時間以内なら1。未解決は0）
- **サバイバル解析用ラベル**:
  - 期間: `TIMESTAMP_DIFF(COALESCE(resolved_at, CURRENT_TIMESTAMP()), detect_at, MINUTE)`
  - 検閲フラグ: `resolved_at IS NULL` または `TIMESTAMP_DIFF(...) > horizon`（例: 7日）

## 学習パイプライン（Pythonバッチ）
1. BigQuery から学習データビュー (`vw_incident_features`) を抽出
2. 前処理
   - 欠損埋め (`COALESCE` で補完、Python側で `SimpleImputer`)
   - One-hot エンコード（カテゴリ列）
   - 標準化（数値列）
3. モデル学習
   - `LogisticRegression`（scikit-learn）: `resolved_within_24h` を目的変数に学習
   - `CoxPHFitter`（lifelines）: サバイバルモデル。必要に応じて `Baseline cumulative hazard` を保存
4. 評価
   - ロジスティック: ROC-AUC、P/R@k、Calibration
   - サバイバル: C-index、Brier score
5. 推論
   - 最新 incident データに対して確率 (`p_resolved_24h`) と推定 `ttr_pred_min` を計算
6. BigQuery へ書き戻し
   ```sql
   CREATE TABLE IF NOT EXISTS `viewpers.salesguard_alerts.incident_outcomes` (
     incident_id STRING,
     thread_id STRING,
     rule_id STRING,
     predicted_at TIMESTAMP,
     p_resolved_24h FLOAT64,
     hazard_score FLOAT64,
     ttr_pred_min FLOAT64,
     model_version STRING,
     features JSON
   )
   PARTITION BY DATE(predicted_at);
   ```

## 運用フロー
| タスク | 頻度 | 実行方法 |
|--------|------|----------|
| 学習 & 推論バッチ | 週次 | Cloud Run Job / Composer / 手動実行 |
| BigQueryビュー再計算 | 日次 | スケジュールドクエリ（`bq_phase_c_incident_outcomes.sql`） |
| モデル評価レポート | 週次 | Python script → GCS / BQ テーブル格納 |
| ダッシュボード連携 | 週次 | `incident_outcomes` を BI ツールへ接続 |

## TODO
1. BigQueryに `vw_incident_features` ビューを作成し、上記特徴量を集約。
2. Python スクリプト `scripts/modeling/train_incident_outcomes.py` を実装し、BQ → 学習 → 推論 → BQ 書き込みのパイプラインを整備。
3. `incident_outcomes` テーブル作成および IAM（書き込み権限）の確認。
4. 再学習スケジュール（週次）のジョブ定義と監視（失敗時通知）を設定。

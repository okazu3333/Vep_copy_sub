# フェーズD 実行手順（返信品質スコア & 類似事例）

## 0. 前提
- BigQuery プロジェクト: `viewpers`
- データセット: `salesguard_alerts`
- `sentence-transformers` / `google-cloud-bigquery` / `pandas` などPython依存がセットアップ済み
- GPT/LLM APIは使用しない方針。OSSモデル（e5） → ローカル実行 or Vertex AI 推奨

---

## 1. BigQuery アセット構築
`scripts/sql/bq_phase_d_reply_quality.sql` を実行してビューとテーブルを用意します。

```bash
bq query \
  --use_legacy_sql=false \
  --allow_large_results \
  --project_id=viewpers \
  < scripts/sql/bq_phase_d_reply_quality.sql
```

作成されるリソース:
- `vw_outbound_replies`: 返信候補抽出（直近90日）
- `reply_quality`: スコア格納テーブル
- `vw_reply_quality_summary`: 担当者別集計
- `vw_similar_candidates`: 埋め込み生成対象

---

## 2. 返信品質スコア バッチ
スクリプト: `scripts/modeling/score_reply_quality.py`

### 使い方
```bash
python scripts/modeling/score_reply_quality.py \
  --project_id viewpers \
  --model_version 20251030-dev \
  --limit 100 \
  --log_level INFO
```

- `--write` を付与すると `reply_quality` に追記します。
- 現状はルールベース + 既存 sentiment を利用したスコア（0-100）。BERT導入時は `_compute_features` 内を差し替えてください。

```bash
python scripts/modeling/score_reply_quality.py \
  --project_id viewpers \
  --model_version 20251030-prod \
  --write \
  --log_level INFO
```

---

## 3. 類似事例用埋め込み生成
スクリプト: `scripts/modeling/build_reply_embeddings.py`

```bash
python scripts/modeling/build_reply_embeddings.py \
  --project_id viewpers \
  --model_name intfloat/multilingual-e5-base \
  --output_dir artifacts/reply_embeddings \
  --limit 1000
```

- `sentence-transformers` が未導入の場合はランダム埋め込みになるため、必ず導入してください。
- 出力: `artifacts/reply_embeddings/reply_embeddings.npy` とメタデータ Parquet。Faiss へのインポート、GCS へのアップロードは別途実装。

---

## 4. API & UI 連携
1. `/api/ai/similar` ルートを実装し、Faiss or ベクトル検索サービスから類似スレッドIDを返却。
2. `app/alerts/page.tsx` や詳細モーダルで `reply_quality` のスコア/レベルを表示。
3. `signals` JSON 内の根拠値を整形し、ツールチップ／詳細内訳とする。

---

## 5. スケジューリング & 運用
| タスク | 推奨頻度 | メモ |
|--------|----------|------|
| `vw_outbound_replies` 更新 | 日次 | `bq_phase_d_reply_quality.sql` の再実行（CREATE OR REPLACEビュー） |
| 品質スコア算出 | 週次 | Cloud Run Job / Composer / GitHub Actions |
| 埋め込み更新 | 週次〜隔週 | 新着メッセージ件数に応じて |
| 類似検索APIの再インデックス | 埋め込み更新時 | Faiss インデックス再作成後にホットスワップ |

---

## 6. 次のステップ
1. `_compute_features` を本番ロジックに置き換え（敬語辞書、FAQマッチなど）
2. BERT推論結果を統合し、`signals` に saliency / attention を記録
3. 類似検索APIのレスポンスフォーマット（類似度、推奨アクション）を設計し、UIへ組み込み

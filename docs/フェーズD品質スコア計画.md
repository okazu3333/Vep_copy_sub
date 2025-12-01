# フェーズD 設計メモ（返信品質スコア & 類似事例検索）

## 目的
- 対応メッセージの品質を定量化し、`reply_quality` テーブルとして保存する。
- インシデントに対し類似事例を検索し、提案アクションや参照事例リンクを提供する。
- UIでは一覧/詳細画面に品質チップおよび類似事例カードを表示し、`/api/ai/similar` でエンドポイント提供。

## スコアリング要素
| カテゴリ | 指標 | 計算方法 |
|----------|------|----------|
| 丁寧さ | 敬語表現密度、丁寧語辞書ヒット数 | 形態素解析 or 辞書ベースカウント |
| 具体性 | 数値/日付/箇条書き出現率、固有表現数 | TokenのPOS/Regex で判定 |
| 網羅性 | 質問に対する回答率、FAQキーワード網羅 | 直前 inbound メールから Q/A マッチング |
| 構成 | 文章長、段落数、挨拶/締めの有無 | ルールベース |
| 感情・トーン | `sentiment_score`, 感情変化 | 既存スコアの再利用 |

最終スコアは `0-100` の加重平均、閾値例: `>=80: High`, `>=60: Medium`, `<60: Low`。

## データフロー
1. BigQuery で候補メッセージビューを作成（例: `vw_outbound_replies`）
2. Python バッチで以下を実施
   - テキスト正規化、敬語辞書ヒット数、構造解析
   - 高速評価用にルールベース+軽量BERT（`cl-tohoku/bert-base-japanese-v2` など）で品質判定
   - スコアと根拠メタデータ(JSON)を `reply_quality` に保存
3. UI/API で `reply_quality` を参照し、`/api/ai/similar` から類似事例IDを返却

## 類似事例検索
- データ: `unified_email_messages` の要約 or 抽出文
- 埋め込み: `intfloat/multilingual-e5-large`（ローカル or Vertex API）。コサイン類似。
- インデックス: Faiss (FlatIP or HNSW) もしくは BigQuery Vector Search (オプション)。
- 結果: 類似スレッドIDと要約、返信品質スコア、リンクURLを返す。

## BigQuery サイドの成果物
- `vw_outbound_replies`: 担当者の返信メッセージ抽出
- `reply_quality`: スコア保存テーブル (partition: date)
- `vw_reply_quality_summary`: 担当者別/期間別集計
- `vw_similar_candidates`: 埋め込み生成対象となるメッセージ一覧

## Python バッチ構成
```
scripts/modeling/
├── score_reply_quality.py
├── build_reply_embeddings.py
└── search_similar_cases.py
```
- `score_reply_quality.py`: 特徴抽出→スコア算出→BQ書込
- `build_reply_embeddings.py`: e5埋め込み生成→Faissインデックス保存(GCS)
- `search_similar_cases.py`: Faissクエリ→類似事例IDsをAPIレスポンス形式にまとめる

## API & UI 連携
- `/api/ai/reply-quality` (任意): `thread_id` → 最新スコア返却
- `/api/ai/similar`: `thread_id` or `message_id` → 類似インシデントIDs,要約
- UIチップ: `reply_quality.score` をカラーバッジ表示。詳細モーダルに根拠JSONを整形表示。

## TODO
1. BigQueryビュー/テーブルDDLを整備 (`scripts/sql/bq_phase_d_reply_quality.sql`)
2. Pythonバッチの雛形を作成し、Jupyter or CLIで検証
3. Faissインデックス格納先（GCSバケット）と更新タイミングを決定
4. API route (`app/api/ai/similar/route.ts`) と UI (`app/alerts/...`) でデータを取得

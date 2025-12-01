# アラート検知モデル（リアルタイム運用設計）

本ドキュメントは、現在ダミーデータで動作しているアラート検知モジュールをリアルタイム検知へ拡張する際のエンジニア向け仕様メモです。段階的な移行を想定し、既存の Next.js / API Route 構成を前提にしています。

---

## 1. 目的
- 主要な顧客メール / Slack / CRM イベントから、予兆〜発生〜フォロー各セグメントに対応したアラートをほぼリアルタイムで生成する。
- 既存 UI（`app/alerts` / `app/dashboard`）へ自然に連携できる JSON 形式を維持。
- 将来的な ML モデル差し替えにも耐える「ルール + ML ハイブリッド」構成を採用。

---

## 2. 全体アーキテクチャ

```
Inbound Streams (メール, Slack, CRM Webhook)
        │
        ▼
Ingestion API (app/api/events/route.ts)
        │ batched queue (Redis / PubSub)
        ▼
Detection Worker (scripts/process_alert_transitions.ts 互換)
        │
        ├─ Rule Engine (lib/segment-rules.ts / segment-detector.ts)
        ├─ ML Scorers  (hooks to HuggingFace sentiment, custom HF endpoint)
        ▼
Alert Store (Supabase/Postgres: alerts, detection_alerts, alert_transitions)
        │
        ├─ REST/GraphQL for UI (既存 app/api/alerts/route.ts を置き換え)
        └─ Streaming Websocket (任意: /api/alerts/stream)
```

- **Ingestion API**: 既存 `app/api/alerts/route.ts` を参考に、新規 `POST /api/events` を追加。メール本文・メタ・スレッドIDを標準化。
- **Queue**: 低レイテンシが不要なら Redis Stream、GCP/BigQuery を使うなら Pub/Sub + Cloud Run。
- **Detection Worker**: Node.js バッチ。`segment-detector.ts` の util を呼び出し、`docs/検知モデル整備計画.md` に記載のルールを逐次適用。
- **Alert Store**: `alerts` テーブルへ INSERT、`alert_transitions` に履歴を書き UI へ反映。リアルタイム性向上のため `updated_at` を Worker 側で更新。

---

## 3. データモデル（提案）

| テーブル | 主なカラム | 説明 |
|---------|-----------|------|
| `raw_events` | `id, source, payload, received_at` | Ingestion API が受け取った生データ |
| `detection_alerts` | `id, segment, rule_key, score, metadata, processed_at` | 検知結果（複数可） |
| `alerts` | 既存 | UI が参照する正規化済みアラート |
| `alert_transitions` | 既存 | セグメント遷移ログ。rule_key / worker_id を追記 |

※ `raw_events` → `detection_alerts` は非同期。`detection_alerts` → `alerts` はセグメントごとに 1:1 または 1:n になる。

---

## 4. 検知フロー詳細

1. **イベント受信**  
   - `POST /api/events` でメールや Slack の Webhook を受理し `raw_events` へ保存。  
   - Idempotency-Key をヘッダに要求（同じメールが重複しないため）。

2. **キュー投入**  
   - `raw_event_id` を Redis Stream (`alerts:ingress`) に push。payload は最小限（ID & priority）。

3. **Worker 処理**  
   ```ts
   const event = fetchRawEvent(id);
   const features = buildFeatures(event); // sentiment, keywords, time diff
   const hits = runRuleEngine(features);  // docs/検知モデル整備計画.md に沿って
   const mlScores = await runMlScorers(features); // 例: hf_sst2, custom zero-shot
   const mergedResults = mergeScores(hits, mlScores);
   persistDetection(mergedResults);
   ```
   - ルールは `segment-rules.ts` で JSON 定義しやすい形へ。
   - ML スコアリングは `hooks/useSentiment` で利用している HuggingFace API をサーバサイドに移植。

4. **アラート生成**  
   - ルール毎に `detection_alerts` INSERT → `alerts` に upsert。  
   - 既存 UI 表示用に `primarySegment`, `urgencyScore`, `ai_summary` を Worker で作成。

5. **通知 / ストリーム（任意）**  
   - `alert_transitions` に書き込んだ後、SSE または Pusher 等で UI へ即時反映。

---

## 5. 環境 / インフラ要件

| 項目 | 推奨 |
|------|------|
| Queue | Redis (local dev) / Cloud Pub/Sub (prod) |
| Storage | Supabase/Postgres or BigQuery (既存環境に合わせる) |
| Secrets | `.env` に `HF_API_KEY`, `QUEUE_URL`, `DATABASE_URL` を追記 |
| デプロイ | Cloud Run (Worker) と Next.js (API) を分離。Worker は Cron と Stream Pull 両対応 |

---

## 6. モニタリング

- `detection_alerts` に `confidence`, `latency_ms` を保存し、Grafana 等で可視化。
- エラー時は `raw_event_id` をキーに再処理できるよう Dead Letter Queue を配置。
- 週次で `rule_key` / `segment` 別の Precision / Recall を算出するバッチを準備。

---

## 7. 移行ステップ

1. `raw_events` / `detection_alerts` テーブルスキーマ作成（マイグレーション）。
2. `POST /api/events` の実装 & ダミーデータ送信スクリプトを用意。
3. Worker の MVP 実装（既存 3 ルールのみ対応）→ UI へ反映。
4. docs/検知モデル整備計画.md に記載の不足 7 ルールを順次追加。
5. 既存 `DUMMY_ALERTS` 参照ロジックを Feature Flag で段階的に無効化。

---

## 8. フォルダ構成（案）

```
components/
lib/
  ├─ detection/
  │    ├─ engine.ts        // ルール評価ロジック
  │    ├─ models.ts        // ルール定義, 型
  │    └─ features.ts      // テキスト解析ヘルパー
scripts/
  └─ workers/
        └─ detection-worker.ts
app/api/
  ├─ events/route.ts       // Ingestion
  └─ detections/route.ts   // (optional) モニタリングAPI
```

### 実装済みモジュール（2025/07 現在）

| 追加箇所 | 概要 |
|----------|------|
| `app/api/events/route.ts` | `POST /api/events` で RawEvent を受信し、その場でルール + ML もどきの判定を実行。結果は `artifacts/runtime-alerts.json` に蓄積し、`GET /api/events` で参照可能。 |
| `lib/detection/*` | ルール定義 (`rules.ts`)、判定エンジン (`engine.ts`)、アラート生成 (`alert-builder.ts`)、JSON ストア (`store.ts`) を追加。 |
| `data/mock/runtimeEvents.json` | 実際の検知シナリオに近い RawEvent サンプルを格納。`scripts/generate_runtime_alerts.ts` でアラートを生成可能。 |
| `scripts/generate_runtime_alerts.ts` | 上記サンプルを一括で `/api/events` 相当の判定に通し、`artifacts/runtime-alerts.json` を更新するユーティリティ。 |

#### 動作確認の流れ
1. `pnpm ts-node scripts/generate_runtime_alerts.ts` を実行し、3件の RawEvent から実働に近いアラートを生成。
2. `pnpm dev` でアプリを起動し、`http://localhost:3000/api/events` にアクセスすると runtime alerts が取得できる。
3. `POST /api/events` に生メールを投げると、新たなアラートが生成されダッシュボードからも参照できる（ダミーデータに加算）。

---

## 9. 今後の拡張

- **自動学習**: `alert_transitions` と営業のアクションログを紐付け、Feedback ループで誤検知を減らす。
- **マルチモデル**: ルールで閾値近いケースを BERT / Llama Guard などの LLM へフォールバック。
- **A/B テスト**: ルールの重み (`urgencyScore` 生成ロジック) を Feature Flag で切り替え、実際の対応 SLA との関連を検証。

---

## 9.1 検知ルール整備計画（エンジニア向け）

| セグメント | 既存ルール | 追加すべき検知ロジック | 実装ステータス |
|------------|------------|------------------------|----------------|
| forecast_tone_down | `tone_frequency_drop` | トーン低下 + 返信頻度減少（既存） | ✅ |
| forecast_inactive | `inactivity_72h` | こちらからの連絡後 48–72h 無返信 | ✅ |
| forecast_response_quality | `night_reply_anomaly` | 夜間対応異常＋回答品質低下 | ⏳ |
| forecast_trust_risk | ― | ROI/懸念キーワード + ネガ感情 | ⏳ |
| occurrence_complaint | ― | クレーム/価格不満のネガ感情 | ⏳ |
| occurrence_silence | ― | 障害報告後の顧客沈黙 72h+ | ⏳ |
| occurrence_proposal_issue | ― | 修正依頼/齟齬キーワード | ⏳ |
| occurrence_reoccurrence | ― | 再発・同じ問題キーワード | ⏳ |
| occurrence_followup | `sentiment_urgency` | 催促/決裁プレッシャー | ✅ |
| follow_recovery | `recovery_monitoring` | 改善確認・フォロー依頼 | ⏳ |

- 7つの未実装ルールは RawEvent → RuleEngine に追加し、`lib/detection/rules.ts` へキー定義を拡張する。  
- ルール閾値（キーワード、sentiment、経過時間）は `DetectionRuleDescriptor` に記述し、Feature Flag で切り替え可能にする。

## 9.2 スコア算出ロジック（経営層/エンジニア向け）

- **検知スコア** = ルール別スコア + 感情/緊急度補正  
  `score = min(100, rule.urgency + sentimentPenalty + timePenalty)`  
  - sentimentPenalty: ネガ感情なら +10〜+20、ポジなら -10。  
  - timePenalty: SLA 超過時間を 24h=+10 として加算。
- **統合スコア (Unified Score)**  
  `unified = w1 * detectionScore + w2 * urgency + w3 * qualityLag`（DEFAULT_WEIGHTS を利用）  
  - 経営監視用に 70以上をエスカレーション対象とする。
- **品質/回復指標**  
  - `phaseC` : 24h 鎮火確率 = 1 - (遅延 / SLA)^2  
  - `phaseD` : 返信品質 = (レスポンス速度 + 文面トーン + 顧客反応) を 0–100 で合算。  
  - これらは Worker 側で計算し DB に保存、UI でリアルタイム表示。

> **実装手順**  
> 1. `lib/detection/rules.ts` に全ルールを定義し、`DetectionRuleKey` を追加。  
> 2. RuleEngine で `sentimentScore` と `hoursSinceLastReply` を使った補正を実装。  
> 3. Worker で `buildAlertFromMatch` に統合スコア/品質計算を埋め込み、DB へ保存。  
> 4. UI（AlertDetail/一覧）で新スコアを参照し、優先順位付けに活用。

## 9.3 プロト検証フロー

- `data/mock/protoScenario.json` に「予兆 → 発生 → フォロー」のダミーメールを定義。  
- `pnpm ts-node scripts/run_detection_proto.ts` を実行すると、各イベントで発火したセグメント/ルールがコンソールに出力され、`artifacts/runtime-alerts.json` に追記される。  
- UI 側では Alerts ページの「フォロー検知サンプルを追加」ボタンでも同シナリオを比較できる。  
- 目的: メール起点でルールが意図通り動くか、予兆→検知→フォローのステータス遷移が UI で確認できるかを素早く実証する。
- `scripts/sync_proto_scenario.ts` を使うと、`protoScenario.json` を Vercel Postgres / Supabase 上の `proto_raw_events` に同期できる（`PROTO_DB_URL` or `DATABASE_URL` が必要）。  
- その後 `PROTO_SCENARIO_SOURCE=db` と `RUNTIME_ALERTS_DRIVER=db` を指定して `scripts/run_detection_proto.ts` を実行すると、DB からイベントを読み込み、検知結果を `proto_runtime_alerts` へ保存する。
- Alerts ページ内の「トラブル対応→フォロー遷移を検証」フォームでは、対象アラートを選択しフォロー文面を入力すると、本文を感情分析 API に送ってスコアを算出し、そのまま `/api/events` に POST して follow セグメントへ遷移するかをリアルタイムで確認できる。
- サンプルテスト: ① `pnpm ts-node scripts/run_detection_proto.ts` で Proto 全件（予兆→発生→フォロー & 発生②→フォロー②）が検知されるか確認。② `pip install -r requirements.txt` → `python3 scripts/local_sentiment_server.py` で OSS 感情サーバーを起動し、`SENTIMENT_PROVIDER=local` のまま `pnpm dev` を実行。③ Alerts UI で `VIP Client Inc.` の障害アラートを選択しフォローメール送信 → Before/After カードで感情スコアとセグメントが発生→follow に遷移したかを確認。

### 実行ログ（2025-11-25 三度目テスト）

| Event ID | 期待セグメント/ルール | 実際に発火したセグメント/ルール | メモ |
|----------|------------------------|-----------------------------------|------|
| proto-forecast-001 | forecast / forecast_trust_risk | ✅ forecast / forecast_trust_risk | ROI 不安シナリオ。 |
| proto-forecast-002 | forecast / forecast_inactive | ✅ forecast / forecast_inactive | 返信途絶リスク。 |
| proto-forecast-003 | forecast / forecast_response_quality | ✅ forecast / forecast_response_quality | 夜間品質低下を検知。 |
| proto-occurrence-001 | occurrence / occurrence_complaint | ✅ occurrence / occurrence_complaint<br>✅ occurrence / occurrence_followup | クレーム + 催促語を検知。 |
| proto-occurrence-002 | occurrence / occurrence_reoccurrence | ✅ occurrence / occurrence_reoccurrence | 再発障害。 |
| proto-occurrence-003 | occurrence / occurrence_proposal_issue | ✅ occurrence / occurrence_proposal_issue | 条件差異・資料不足を検知。 |
| proto-occurrence-004 | occurrence / occurrence_silence | ✅ occurrence / occurrence_silence | 72h沈黙アラート。 |
| proto-follow-001 | follow / follow_recovery | ✅ follow / follow_recovery | Sunrise 向けフォロー。 |
| proto-follow-002 | follow / follow_recovery | ✅ follow / follow_recovery | VIP向け役員レポート。 |
| proto-follow-003 | follow / follow_recovery | ✅ follow / follow_recovery | 条件差異フォロー。 |

- 改修後は 17 件の Runtime Alert が `artifacts/runtime-alerts.json` に追記された（forecast3件 + occurrence4件 + follow3件）。  
- `occurrence_followup` には `direction: inbound` と `maxSentiment: 0.05` を追加済み。フォロー（outbound/ポジティブ）での誤検知が再現しないことを確認。  
- `forecast_response_quality` は `minSentiment=-0.4` の条件を追加し、軽度ネガ傾向のみを予兆として拾うよう調整済み。  
- UI のシミュレーションボタンも同じ proto データを参照するため、ブラウザ上で再生した場合も上記 4 件と一致する。  
- Alerts ページ側は `NEXT_PUBLIC_USE_DB_ALERTS=1` を指定すると `/api/events`（runtime alerts ストア）を参照するため、DB モードで投入した検知結果だけで画面検証が可能。

---

## 10. モック段階での DB / AI コスト試算

| 項目 | 内容 | 概算コスト |
|------|------|------------|
| DB ホスティング | Vercel Postgres / Supabase Free で `raw_events` / `detection_alerts` を作成。1GB・30k req/日程度までは無料枠内。 | ¥0〜¥1,000/月（無料枠で維持可能） |
| メールダミーデータ投入 | `scripts/generate_runtime_alerts.ts` を DB 書き込み用に改修し、一括 INSERT で検証用データを投入。 | ― |
| AI 要約（モック） | オープンソースモデル（例: `facebook/bart-large-cnn`, `ELYZA-japanese-Llama-2`）をローカル／自前推論で動かせば $0。HuggingFace Inference Endpoint を使う場合でも Starter $9/月 程度。 | ¥0（ローカル推論時）〜¥1,500/月 |
| LLM API（外部） | Gemini API（1.5 Flash: ~$0.0025/1K output）や GPT API（GPT-4o mini: $0.006/1K output、GPT-4o: $0.015/1K output）を採用する場合は利用量に応じて増減。初期は $20/月 ほどを目安にすると安全。 | 約 ¥3,000/月〜（利用トークン次第） |
| 感情分析 | OSS モデル（`daigo/bert-base-japanese-sentiment` 等）をサーバ内で動かせば追加コストなし。HuggingFace API を使う場合でも上記 Starter に含まれる。 | ¥0（ローカル推論時） |

> **実施フロー案**  
> 1. Vercel/Supabase に `raw_events`・`detection_alerts`・`alerts` を作成し、`/api/events` を DB 書き込みに変更。  
> 2. `data/mock/runtimeEvents.json` 相当のメールダミーを投入し、ルールエンジンで検知→アラート化できるか確認。  
> 3. AI 要約/API をモック化し、UI に必要な指標（検知理由・緊急度・要約）が欠落しないかチェック。

### 10.1 直近DB・モデル検証タスク

1. **Vercel Postgres/Supabase のスキーマ確定**  
   - `raw_events`（メール原文）、`runtime_alerts`（検知結果）、`alert_threads`（予兆→発生→フォローの時系列）を最低限用意。  
   - `scripts/sql/proto_vercel_schema.sql` で `proto_*` テーブルを作成し、`scripts/sync_proto_scenario.ts` を実行してシード投入。  
   - `PROTO_SCENARIO_SOURCE=db` と `RUNTIME_ALERTS_DRIVER=db` を指定して `run_detection_proto.ts` を実行すると、DB⇔ルールエンジン⇔UI の流れを再現できる。
2. **フォローシナリオ専用のトリガ検証**  
   - occurrence/follow 境界条件（direction, sentiment, positive keywords）を DB シードデータで A/B。  
   - 結果を `docs/alert-detection-realtime.md#9-3` に追記して、エグゼクティブレビューで false positive 許容度を判断する。
3. **UI ↔︎ DB 配線の Feature Flag 化**  
   - Alerts ページで `NEXT_PUBLIC_USE_DB_ALERTS` を読み、オン時は `app/api/events`（runtime alerts）経由で DB の検知結果を取得。  
   - モック維持のため、従来の BigQuery API / ダミーデータも fallback で残しておく。

### 10.2 OSS 感情分析（デフォルト）と Hugging Face 併用手順

- **OSS ローカル推論がデフォルト**  
  1. `pip install -r requirements.txt` を実行（`transformers` / `torch` / `fastapi` 等が追加済み）。  
  2. `python scripts/local_sentiment_server.py` で FastAPI サーバーを起動（デフォルト `daigo/bert-base-japanese-sentiment`）。  
  3. `.env.local` に `SENTIMENT_PROVIDER=local`、`LOCAL_SENTIMENT_ENDPOINT=http://localhost:8000/api/sentiment` を設定。  
  4. Alerts 画面のフォローテスト/投稿フォームはこのエンドポイントを叩き、OSS モデルのみで感情スコアを自動算出する。
- **必要に応じて Hugging Face Inference API を利用**  
  - `.env.local` で `SENTIMENT_PROVIDER=huggingface` と `HUGGINGFACE_API_KEY` を設定し直せば、同じ UI ロジックが Hugging Face 側を利用。  
  - OSS サーバーが落ちているときのフォールバックやクラウド比較検証に役立つ。
- いずれの構成でも、UI からの手動投稿・フォロー送信→感情分析→`/api/events` POST→Runtime Alerts 更新までが一連で動作し、営業メールのみでリアルタイム検知を検証できる。

---

## 参考
- `docs/検知モデル整備計画.md`: セグメント別ルール網羅状況・優先順位
- `scripts/process_alert_transitions.ts`: 既存バッチの再利用元
- `lib/segment-detector.ts`: 既存ユーティリティのリファクタ対象

## リアルタイム監視への移行: 概算費用モデルとGmail APIリアルタイム取得の懸念点

本ドキュメントは、現行システムをリアルタイム監視に切り替えた場合の概算費用モデルと、Gmail APIのリアルタイム取得（Users.watch + Pub/Sub）導入時の技術・運用上の懸念点を整理したものです。

### 対象システム（現状把握）
- バックエンド: Next.js API Routes（Docker 化、Cloud Run/コンテナで運用想定）
- データ: BigQuery（分析・閲覧 API は BigQuery 読み取りが中心）
- 一部 CloudSQL/PostgreSQL 利用のユーティリティあり（`lib/database-pool.ts`）
- デプロイ: Cloud Run（`deploy.sh`, `cloudbuild.yaml` 参照）

---

## 1) リアルタイム方式の全体像

1. Gmail Users.watch で監視対象ラベル（例: INBOX）を購読
2. 通知は Google Cloud Pub/Sub に Push 配信
3. 受信エンドポイント（Cloud Run / Next.js API）で検証・ACK
4. Gmail History API で `historyId` 以降の差分取得 → 新規/更新メッセージの `messageId` を特定
5. メッセージ詳細（必要範囲）を Gmail API で取得し、正規化 → BigQuery へ書き込み
6. 二次処理（NLP/スコアリング/セグメント）はバッチ or ストリーミングで随時反映

---

## 2) 概算費用モデル（式とレンジ）

注意: 実価格はリージョン/世代/割引で変動します。ここでは「式」と「レンジ」を提示します。最終見積もりは公式価格ページで単価を代入してください。

変数:
- N = 1日の新着メール件数（監視対象合計）
- R = 1通あたりの通知数（通常1、稀に再送や重複で>1）
- T = 1通知の処理時間（秒）
- V = 割り当て vCPU 数（例: 0.25〜1 vCPU）
- M = メモリ割り当て（GiB）
- Pv = Cloud Run vCPU 単価（$/vCPU-sec）
- Pm = Cloud Run メモリ単価（$/GiB-sec）
- Ppub = Pub/Sub 配信単価（$/100万メッセージ）
- PbqQ = BigQuery クエリ単価（$/TB スキャン）
- PbqS = BigQuery ストレージ単価（$/GB-月）
- PbqW = BigQuery 書き込み単価（Storage Write API/ストリーミングが有料の場合の該当単価）

式（1日あたり）:
- Cloud Run 計算コスト ≒ N × R × T × (V × Pv + M × Pm)
- Pub/Sub 配信コスト ≒ (N × R) × (Ppub / 1,000,000)
- BigQuery 書き込みコスト ≒ 書き込むデータ量（GB）× PbqW
- BigQuery ストレージコスト ≒ 新規保存データ量（GB）× PbqS（保存日数/30）
- BigQuery クエリコスト ≒ 月間スキャン量（TB）× PbqQ（ダッシュボード/分析の読み取り）

参考レンジ感（小〜中規模、目安）:
- 小規模（N=10,000/日）: 数千円〜数万円/月
- 中規模（N=100,000/日）: 数万円〜十数万円/月
- 大規模（N=1,000,000/日）: 数十万円〜（分析の仕方次第で）百万円超/月

コスト最適化のポイント:
- 重い解析はバッチ化し、ストリーミング経路は軽量 ETL のみに限定
- Cloud Run の同時実行・最大インスタンス・コールドスタート戦略の最適化
- BigQuery はパーティション/クラスタリング・必要列限定・集約テーブル前計算
- Pub/Sub メッセージ設計（重複/再送を想定した冪等化、バッチ ACK）

---

## 3) Gmail API リアルタイム取得の懸念点（設計・運用）

技術的懸念:
- Watch の有効期限: 監視は自動的に失効（一般に数日〜約7日）するため、定期的な再設定（再 watch）が必須
- `historyId` ギャップ: 通知遅延や処理停止で `historyId` が古くなると 404（history not found）→ 再同期（フル or 範囲再取り込み）が必要
- 重複・順序保証なし: 同一イベントの重複/順序入れ替わりを前提に、冪等なアップサート設計（`messageId`/`threadId` キー、再処理安全）
- レート制限/指数バックオフ: Gmail API はユーザー/プロジェクト単位のクォータあり。429/5xx 時の指数バックオフ、キューイングが必須
- フィールドサイズ/添付: 本文/添付のサイズが大きいケースは二段階取得や添付の遅延取得・保管方針を分離
- ラベル戦略: 監視対象を INBOX 等に絞る、社内自動ラベルでノイズを低減

運用・セキュリティ懸念:
- OAuth スコープ最小化・ドメイン全体委任（必要時）・トークン保護・監査ログ
- Pub/Sub Push 検証: JWT 検証、`ce-type`/attributes 検証、リプレイ防止、DLQ（Dead Letter）設計
- アラート/メトリクス: 再 watch 失敗率、history 追従遅延、DLQ 深さ、処理遅延 p95/p99、失敗率を可視化
- 再同期 Runbook: `historyId` 欠落時の自動/手動再同期手順、影響範囲推定、重複排除ポリシー
- マルチアカウント/テナント: 監視対象アカウント増でクォータ逼迫。キュー分離、プロジェクト分割、時間分散

---

## 4) 推奨アーキテクチャ（最小実装）

- Pub/Sub トピック: `gmail-events`
- Cloud Run 受信エンドポイント: `/api/gmail/push`（JWT 検証・ACK・軽量キュー投入）
- ワーカー: Pub/Sub Pull/Cloud Run Job で Gmail History API を呼び出し、差分から `messageId` 群を解決
- 取得/正規化: 必要最小フィールドのみ取得（件名/本文プレビュー/ヘッダ等）→ BigQuery へ書き込み（Storage Write API 推奨）
- 二次処理: NLP/スコアリングはバッチ or 近リアルタイム（まとめ処理）。ダッシュボードは集約済みテーブル参照

---

## 5) 試算テンプレート（単価は公式ページで更新して代入）

```
入力:
  N      = 100,000   # 件/日
  R      = 1.05      # 重複や再送を考慮
  T      = 0.15      # 秒/通知（受信エンドポイント処理）
  V      = 0.5       # vCPU
  M      = 0.5       # GiB
  Pv     = <Cloud Run vCPU $/vCPU-sec>
  Pm     = <Cloud Run $/GiB-sec>
  Ppub   = <Pub/Sub $/100万件>
  PbqW   = <BQ 書き込み $/GB>
  PbqS   = <BQ ストレージ $/GB-月>
  PbqQ   = <BQ クエリ $/TB>

計算例:
  CloudRun = N * R * T * (V * Pv + M * Pm)
  PubSub   = (N * R) * (Ppub / 1_000_000)
  BQ_Write = <1日の書込GB> * PbqW
  BQ_Stor  = <新規GB/日> * PbqS * (保存日数/30)
  BQ_Query = <月間TB> * PbqQ
  合計(月) ≒ (CloudRun + PubSub + BQ_Write + BQ_Stor) * 30 + BQ_Query
```

---

## 6) リスク低減とコスト最適化チェックリスト

- 冪等なアップサート（`messageId` 一意/重複安全）
- `historyId` ウォーターマーク管理とギャップ検知（自動再同期）
- Pub/Sub DLQ・再試行ポリシー設定（指数バックオフ）
- Cloud Run 同時実行と最大インスタンスの上限設計（スパイク対策）
- BigQuery: パーティション/クラスタリング、必要列のみ、集約テーブル前計算
- NLP/重処理は別ジョブへ分離（リアルタイム経路を軽量化）
- 監視ダッシュボード: エラー率、遅延、DLQ、再 watch 成功率を常時可視化

---

## 7) 次アクション（PoC 1〜2週間目安）

1. 単一 Gmail アカウントで Users.watch → Pub/Sub → Cloud Run 受信の PoC
2. `historyId` 差分取得と BigQuery への最小フィールド書き込み
3. 冪等化・再送試験・再同期 Runbook 作成
4. 1日の実測データで費用パラメータを埋め、概算見直し
5. 拡張（複数アカウント/テナント、NLP 分離、集約テーブル設計）

---

### 備考（単価ソース）
最新価格は Google Cloud の各公式ドキュメント（Cloud Run / Pub/Sub / BigQuery）を参照し、上記式に代入して試算してください。リージョン（例: asia-northeast1）や世代（2nd Gen）で単価が異なる場合があります。

---

## 8) 今すぐ作り替え/追加が必要な項目（優先度つき）

Must（初期導入の必須）
- Gmail Watch 設定フローの実装
  - ドメイン内対象アカウント/ラベルへの `users.watch` 設定
  - 失効前に自動再 Watch（Cloud Scheduler → Endpoint）
- Pub/Sub 受信パスの新設
  - Cloud Run/Next.js API: `/api/gmail/push`（JWT 検証、10 秒以内 ACK、冪等なキュー投入）
  - Pub/Sub トピック/サブスクリプション作成、DLQ 設定
- 差分同期ワーカー
  - Pub/Sub から取り出し → Gmail History API で `historyId` 以降の差分解決
  - `messageId` ごとの詳細取得のレート制御・指数バックオフ・再試行
  - 冪等なアップサート（`messageId` 一意制約）で BigQuery へ保存（Storage Write API 推奨）
- `historyId` チェックポイント管理
  - 安全な保存先（例: BigQuery メタテーブル `metadata.gmail_history_checkpoint` など）
  - 取り出し/更新の原子性（同時実行時の競合防止）
- セキュリティ/IAM/認可
  - OAuth クライアント/スコープ最小化、トークン保護
  - Pub/Sub Push 検証（JWT/署名、attributes 検証）、秘密情報の Secret Manager 化
- 監視/運用
  - 失敗率・遅延・DLQ 深さ・再 Watch 成功率のメトリクス化
  - ログ構造化（`messageId`/`historyId`/traceId）

Should（初期ローンチ後すぐ）
- BigQuery スキーマ/テーブル戦略
  - 取り込みテーブルのパーティション/クラスタリング
  - 集約/ビュー（ダッシュボード用）を前計算
  - スキーマ検証とスキーマ進化の手当
- 再同期 Runbook と自動化
  - `historyId` 欠落時の自動範囲再取得/完全再取り込み
  - 影響範囲推定・重複排除ポリシー
- レート/同時実行制御
  - Cloud Run の同時実行・最大インスタンス制御、ワーカーの並列数上限
  - キュー詰まり検知とドレイン戦略

Nice to have（安定運用/拡張）
- 運用ツール/管理 UI
  - 再同期ボタン・メトリクスダッシュボード・DLQ リプレイ
- マルチテナント/アカウント拡張
  - アカウント別キュー分離・クォータ分散・プロジェクト分割
- 添付ファイル戦略
  - 大容量添付は遅延取得し GCS に保存、BQ にはメタのみ
- データ保持/プライバシー
  - 保存期間ポリシー、削除/匿名化、監査ログの保全



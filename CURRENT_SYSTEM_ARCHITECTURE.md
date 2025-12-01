# 現在のシステム構成

## 概要
BigQueryベースのアラートシステムが整理され、以下の構成で動作しています。

## アーキテクチャ図

```
flowchart TD
    subgraph Ingestion[Data Ingestion]
        GCS[GCS mbox Files]
        Scripts[Node Scripts & Batch Jobs]
    end

    subgraph Storage[Storage / Processing]
        BigQuery[(BigQuery Tables:\nemail_messages, alerts_v2, customers, keyword_logic)]
    end

    subgraph Backend[Backend Interfaces]
        NextAPI[Next.js API Routes]
        ExpressAPI[Express API (port 3002)]
    end

    subgraph Frontend[Frontend & Tools]
        NextApp[Next.js App (port 3000)]
        StaticUI[Static UI (port 3003)]
    end

    subgraph Monitoring[Monitoring & Ops]
        ScriptsCLI[CLI Scripts (check/display/...)]
    end

    GCS --> Scripts --> BigQuery
    ScriptsCLI --> BigQuery
    BigQuery --> NextAPI --> NextApp
    BigQuery --> ExpressAPI --> NextApp
    ExpressAPI --> StaticUI
    NextAPI --> StaticUI
```

## ファイル構成

### メインアプリケーション
- **Next.jsアプリケーション** (ポート3000)
  - `app/` - Next.jsアプリケーション
  - `components/` - Reactコンポーネント
  - `lib/` - ユーティリティ
  - `types/` - TypeScript型定義
  - `hooks/` - React Hooks
  - `styles/` - スタイルファイル

### BigQueryデータ処理
- **データソース**: `viewpers.salesguard_data.fixed_message_body_emails`
- **総レコード数**: 771,705件
- **有効な本文**: 345,306件（44.7%）
- **空の本文**: 426,399件（55.3%）

### スクリプトファイル（9個）
1. **`simple-japanese-decode.js`** - 日本語デコード処理
2. **`fix-message-body.js`** - メッセージ本文修正処理
3. **`check-fixed-table.js`** - 修正されたテーブル確認
4. **`check-decoded-data.js`** - デコード状況確認
5. **`display-bigquery-data.js`** - BigQueryデータ表示
6. **`check-table-structure.js`** - テーブル構造確認
7. **`create-alerts-api.js`** - カスタムAPI（ポート3002）
8. **`start-alerts-system.js`** - システム起動
9. **`analyze-phrase-patterns.js`** - フレーズパターン分析

## システム構成

### 1. メインシステム（ポート3000）
- **Next.jsアプリケーション**
- **機能**:
  - BigQueryからデータを取得
  - セグメント分類機能
  - ページネーション機能（20件/ページ）
  - アラート詳細表示
  - 検索機能

### 2. カスタムAPI（ポート3002）
- **Express.js APIサーバー**
- **機能**:
  - BigQueryからデータを取得
  - リプライ機能
  - スレッド機能
  - 統計情報

### 3. 静的ファイル（ポート3003）
- **http-server**
- **機能**:
  - カスタムアラート表示
  - チャット風UI

## データフロー

### 1. データ処理
```
BigQuery (japanese_decoded_emails)
    ↓
fix-message-body.js
    ↓
BigQuery (fixed_message_body_emails)
    ↓
Next.js API (app/api/alerts/route.ts)
    ↓
フロントエンド (app/alerts/page.tsx)
```

### 2. セグメント分類
- **契約・商談**
- **営業プロセス**
- **クレーム**
- **導入後効果**
- **その他**

## 現在の状況

### ✅ 完了済み
- メッセージ本文のオブジェクト形式問題を解決
- 771,705件のデータをBigQueryに保存
- 345,306件の有効なHTMLメール本文を利用可能
- セグメント分類機能を実装
- ページネーション機能を実装

### 🔄 進行中
- メインシステムでのデータ表示確認
- セグメント分類の精度向上

### 📋 次のステップ
1. ブラウザでアラート一覧を確認
2. セグメント分類の改善
3. 有効な本文を持つメールの詳細確認

## 使用方法

### メインシステムの起動
```bash
npm run dev
```
http://localhost:3000/alerts でアクセス

### カスタムAPIの起動
```bash
node scripts/create-alerts-api.js
```
http://localhost:3002/api/alerts でアクセス

### データ確認
```bash
node scripts/check-fixed-table.js
node scripts/display-bigquery-data.js
```

## 技術スタック
- **フロントエンド**: Next.js, React, TypeScript
- **バックエンド**: Node.js, Express.js
- **データベース**: BigQuery
- **スタイリング**: Tailwind CSS
- **デプロイ**: Vercel

## パフォーマンス
- **総レコード数**: 771,705件
- **ページネーション**: 20件/ページ
- **レスポンス時間**: 平均2-3秒
- **データ品質**: 44.7%の有効な本文 
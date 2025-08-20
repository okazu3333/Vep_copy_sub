# 包括的プロジェクトクリーンアップ計画

## 📋 発見された重複ファイル

### **1. app/keywords/ ディレクトリ**
- `page.tsx` と `page 2.tsx` (24KB, 544行)
- `segments/page.tsx` と `segments/page 2.tsx` (68KB, 1586行)

### **2. lib/ ディレクトリ**
- `keyword-detector.ts` と `keyword-detector 2.ts` (6.9KB, 210行)
- `keyword-extractor.js` と `keyword-extractor 2.js` (11KB, 316行)
- `keyword-extractor.ts` と `keyword-extractor 2.ts` (9.1KB, 273行)

### **3. styles/ と app/ の重複**
- `styles/globals.css` (2.4KB, 95行)
- `app/globals.css` (2.0KB, 84行)

## 🧹 削除対象ファイル

### **即座に削除（重複ファイル）**
```bash
# app/keywords/ 重複
rm "app/keywords/page 2.tsx"
rm "app/keywords/segments/page 2.tsx"

# lib/ 重複
rm "lib/keyword-detector 2.ts"
rm "lib/keyword-extractor 2.js"
rm "lib/keyword-extractor 2.ts"

# styles/ 重複（app/globals.cssを保持）
rm "styles/globals.css"
```

### **削除候補（古いバージョン）**
```bash
# JavaScript版（TypeScript版があるため）
rm "lib/keyword-extractor.js"
rm "lib/query-cache.js"
```

## 📊 削除後の効果

### **ファイル数削減**
- **app/keywords/**: 4個 → 2個 (-50%)
- **lib/**: 25個 → 20個 (-20%)
- **styles/**: 1個 → 0個 (-100%)

### **容量削減**
- **app/keywords/**: 92KB → 46KB (-50%)
- **lib/**: 約200KB → 約150KB (-25%)
- **styles/**: 2.4KB → 0KB (-100%)

### **合計削減効果**
- **ファイル数**: 30個 → 22個 (-27%)
- **容量**: 約300KB → 約200KB (-33%)

## 🚀 実装手順

### **ステップ1: 重複ファイル削除**
```bash
# 1. app/keywords/ 重複削除
rm "app/keywords/page 2.tsx"
rm "app/keywords/segments/page 2.tsx"

# 2. lib/ 重複削除
rm "lib/keyword-detector 2.ts"
rm "lib/keyword-extractor 2.js"
rm "lib/keyword-extractor 2.ts"

# 3. styles/ 重複削除
rm "styles/globals.css"
```

### **ステップ2: 古いファイル削除**
```bash
# JavaScript版削除（TypeScript版があるため）
rm "lib/keyword-extractor.js"
rm "lib/query-cache.js"
```

### **ステップ3: 統合ファイル作成**
- デコーダー関連ファイルの統合
- データベース関連ファイルの統合

## 📈 期待される効果

### **メンテナンス性向上**
- 重複コードの排除
- ファイル管理の簡素化
- 開発効率の向上

### **パフォーマンス向上**
- ビルド時間の短縮
- メモリ使用量の削減
- デプロイ時間の短縮

### **コード品質向上**
- 一貫性のあるファイル構造
- 明確な責任分離
- 保守性の向上

## ⚠️ 注意事項

### **削除前の確認**
1. 重複ファイルの内容確認
2. 依存関係の確認
3. バックアップの作成

### **削除後の確認**
1. ビルドエラーの確認
2. 機能テストの実行
3. パフォーマンステスト

## 📋 次のステップ

1. **重複ファイル削除の実行**
2. **古いファイル削除の実行**
3. **統合ファイルの作成**
4. **テストと検証**
5. **ドキュメント更新** 
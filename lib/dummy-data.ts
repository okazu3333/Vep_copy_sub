// アラートデータ（新しいセグメント構造に基づく）
export const alertsData = [
  // クレーム・苦情系セグメント
  {
    id: "ALT-001",
    datetime: "2024-12-15 09:15:00",
    keyword: "クレーム",
    department: "営業",
    person: "田中太郎",
    level: "high",
    status: "pending",
    category: "complaint-urgent",
    description: "顧客からの強い不満や苦情の検出",
    customerName: "佐藤様",
    customerCompany: "テックソリューションズ",
    customerEmail: "sato@techsolutions.co.jp",
  },
  {
    id: "ALT-002",
    datetime: "2024-12-15 10:30:00",
    keyword: "催促",
    department: "営業",
    person: "鈴木美咲",
    level: "medium",
    status: "pending",
    category: "follow-up-dissatisfaction",
    description: "対応の遅れや催促への不満の検出",
    customerName: "山田様",
    customerCompany: "デジタルイノベーション",
    customerEmail: "yamada@digitalinnovation.co.jp",
  },
  {
    id: "ALT-003",
    datetime: "2024-12-15 11:45:00",
    keyword: "不安",
    department: "営業",
    person: "高橋健一",
    level: "low",
    status: "pending",
    category: "anxiety-passive-tendency",
    description: "顧客の不安感や消極的な態度の検出",
    customerName: "伊藤様",
    customerCompany: "クラウドシステムズ",
    customerEmail: "ito@cloudsystems.co.jp",
  },
  {
    id: "ALT-004",
    datetime: "2024-12-15 13:20:00",
    keyword: "興味",
    department: "営業",
    person: "中村優子",
    level: "low",
    status: "pending",
    category: "positive-engagement",
    description: "顧客の積極的な関与や興味の検出",
    customerName: "小林様",
    customerCompany: "AIテクノロジー",
    customerEmail: "kobayashi@aitechnology.co.jp",
  },

  // トーン急変・キャンセル・アップセルセグメント
  {
    id: "ALT-005",
    datetime: "2024-12-16 09:10:00",
    keyword: "トーン急変",
    department: "インサイドセールス",
    person: "大野美咲",
    level: "high",
    status: "pending",
    category: "tone-change-negative",
    description: "会話のトーンが急激にネガティブに変化",
    customerName: "竹内様",
    customerCompany: "ブロックチェーン技術",
    customerEmail: "takeuchi@blockchain.co.jp",
  },
  {
    id: "ALT-006",
    datetime: "2024-12-16 10:25:00",
    keyword: "キャンセル",
    department: "インサイドセールス",
    person: "藤田剛",
    level: "high",
    status: "pending",
    category: "cancellation-termination",
    description: "取引のキャンセルや終了の意向の検出",
    customerName: "佐々木様",
    customerCompany: "機械学習ソリューション",
    customerEmail: "sasaki@mlsolutions.co.jp",
  },
  {
    id: "ALT-007",
    datetime: "2024-12-16 11:40:00",
    keyword: "アップセル",
    department: "インサイドセールス",
    person: "田中太郎",
    level: "low",
    status: "pending",
    category: "upsell-opportunity",
    description: "追加サービスやアップグレードの機会",
    customerName: "井上様",
    customerCompany: "VR・AR開発",
    customerEmail: "inoue@vrar.co.jp",
  },
  {
    id: "ALT-008",
    datetime: "2024-12-16 13:15:00",
    keyword: "拒絶",
    department: "インサイドセールス",
    person: "高橋健一",
    level: "medium",
    status: "pending",
    category: "cold-rejection-polite",
    description: "顧客からの冷たい拒絶や塩対応の検出",
    customerName: "中島様",
    customerCompany: "エッジコンピューティング",
    customerEmail: "nakajima@edgecomputing.co.jp",
  },
  {
    id: "ALT-009",
    datetime: "2024-12-16 14:30:00",
    keyword: "危機",
    department: "インサイドセールス",
    person: "鈴木美咲",
    level: "high",
    status: "pending",
    category: "internal-crisis-report",
    description: "社内での危機的な状況の通報",
    customerName: "岡田様",
    customerCompany: "フィンテックソリューション",
    customerEmail: "okada@fintech.co.jp",
  },
  {
    id: "ALT-010",
    datetime: "2024-12-16 15:45:00",
    keyword: "緊急",
    department: "インサイドセールス",
    person: "松本理恵",
    level: "high",
    status: "pending",
    category: "internal-crisis-report",
    description: "社内での危機的な状況の通報",
    customerName: "西村様",
    customerCompany: "量子コンピューティング",
    customerEmail: "nishimura@quantum.co.jp",
  },
  {
    id: "ALT-011",
    datetime: "2024-12-17 09:20:00",
    keyword: "見送り",
    department: "インサイドセールス",
    person: "石井亮介",
    level: "low",
    status: "pending",
    category: "sales-process",
    description: "予算削減・投資見送り対応（今回の投資は見送りとなりました。）",
    customerName: "北村様",
    customerCompany: "5Gネットワーク",
    customerEmail: "kitamura@5gnetwork.co.jp",
  },

  // 追加検知セグメント
  {
    id: "ALT-012",
    datetime: "2024-12-17 10:35:00",
    keyword: "追加サービス",
    department: "カスタマーサクセス",
    person: "石井亮介",
    level: "low",
    status: "pending",
    category: "upsell-opportunity",
    description: "追加サービスやアップグレードの機会",
    customerName: "西様",
    customerCompany: "ロボティクス",
    customerEmail: "nishi@robotics.co.jp",
  },
  {
    id: "ALT-013",
    datetime: "2024-12-17 13:05:00",
    keyword: "機能追加",
    department: "カスタマーサクセス",
    person: "松本理恵",
    level: "low",
    status: "pending",
    category: "upsell-opportunity",
    description: "追加サービスやアップグレードの機会",
    customerName: "東様",
    customerCompany: "自動運転技術",
    customerEmail: "higashi@autonomous.co.jp",
  },
]

// キーワードカテゴリ（新しい検知パターンセグメント構造に基づく）
export const keywordCategories = [
  {
    id: "complaint-urgent",
    name: "クレーム・苦情系",
    keywords: ["クレーム", "不具合", "トラブル", "おかしい", "問題", "故障", "エラー", "動かない", "困っている", "対応して"]
  },
  {
    id: "follow-up-dissatisfaction",
    name: "催促・未対応の不満",
    keywords: ["まだですか", "いつまで", "対応して", "返事がない", "待っています", "遅い", "早く", "急いで"]
  },
  {
    id: "anxiety-passive-tendency",
    name: "不安・消極的傾向",
    keywords: ["不安", "心配", "大丈夫でしょうか", "どうしよう", "迷っています", "自信がない", "よくわからない"]
  },
  {
    id: "positive-engagement",
    name: "積極的関与",
    keywords: ["興味があります", "詳しく教えて", "検討したい", "良いですね", "やってみたい", "進めましょう"]
  },
  {
    id: "tone-change-negative",
    name: "トーン急変（ネガへ）",
    keywords: ["急に", "突然", "一転", "変わった", "違う", "やっぱり", "思ったのと"]
  },
  {
    id: "cancellation-termination",
    name: "キャンセル・取引終了系",
    keywords: ["キャンセル", "中止", "終了", "やめます", "取り消し", "破棄", "解約", "契約解除"]
  },
  {
    id: "upsell-opportunity",
    name: "アップセルチャンス",
    keywords: ["もっと", "追加で", "他にも", "拡張", "アップグレード", "機能追加", "サービス追加"]
  },
  {
    id: "cold-rejection-polite",
    name: "冷たい拒絶・塩対応",
    keywords: ["結構です", "必要ありません", "興味ない", "検討しません", "やめておきます", "他を探します"]
  },
  {
    id: "internal-crisis-report",
    name: "社内向け危機通報",
    keywords: ["緊急", "危機", "問題発生", "トラブル", "事故", "インシデント", "報告", "連絡"]
  }
]

// キーワードテンプレート（新しいセグメント構造に基づく）
export const keywordTemplates = [
  {
    name: "解約・キャンセル",
    keywords: ["解約", "キャンセル", "終了", "見直し", "他社", "変更"]
  },
  {
    name: "競合対応",
    keywords: ["競合", "他社", "比較", "提案", "優位性", "差別化"]
  },
  {
    name: "クレーム・苦情検出",
    keywords: ["クレーム", "不具合", "トラブル", "おかしい", "問題", "故障", "エラー", "動かない", "困っている", "対応して"]
  },
  {
    name: "催促・未対応不満検出",
    keywords: ["まだですか", "いつまで", "対応して", "返事がない", "待っています", "遅い", "早く", "急いで"]
  },
  {
    name: "不安・消極的傾向検出",
    keywords: ["不安", "心配", "大丈夫でしょうか", "どうしよう", "迷っています", "自信がない", "よくわからない"]
  },
  {
    name: "積極的関与検出",
    keywords: ["興味があります", "詳しく教えて", "検討したい", "良いですね", "やってみたい", "進めましょう"]
  },
  {
    name: "トーン急変検出",
    keywords: ["急に", "突然", "一転", "変わった", "違う", "やっぱり", "思ったのと"]
  },
  {
    name: "キャンセル・取引終了検出",
    keywords: ["キャンセル", "中止", "終了", "やめます", "取り消し", "破棄", "解約", "契約解除"]
  },
  {
    name: "アップセルチャンス検出",
    keywords: ["もっと", "追加で", "他にも", "拡張", "アップグレード", "機能追加", "サービス追加"]
  },
  {
    name: "冷たい拒絶・塩対応検出",
    keywords: ["結構です", "必要ありません", "興味ない", "検討しません", "やめておきます", "他を探します"]
  },
  {
    name: "社内向け危機通報検出",
    keywords: ["緊急", "危機", "問題発生", "トラブル", "事故", "インシデント", "報告", "連絡"]
  }
]

// 営業担当者別アラートデータ
export const salesPersonAlertData = {
  weekly: [
    { name: "田中太郎", department: "営業部", alerts: 3, resolved: 2, pending: 1, previousAlerts: 2, previousResolved: 1, previousPending: 1 },
    { name: "鈴木美咲", department: "営業部", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 1, previousPending: 0 },
    { name: "高橋健一", department: "営業部", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 0, previousPending: 1 },
    { name: "中村優子", department: "営業部", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 1, previousPending: 0 },
    { name: "渡辺大輔", department: "営業部", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 0, previousPending: 1 },
    { name: "山田真一", department: "インサイドセールス", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 0, previousPending: 1 },
    { name: "松本理恵", department: "カスタマーサクセス", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 0, previousPending: 1 },
    { name: "石井亮介", department: "インサイドセールス", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 0, previousPending: 1 },
    { name: "大野美咲", department: "インサイドセールス", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 1, previousPending: 0 },
    { name: "藤田剛", department: "カスタマーサクセス", alerts: 2, resolved: 1, pending: 1, previousAlerts: 1, previousResolved: 0, previousPending: 1 },
  ],
  monthly: [
    { name: "田中太郎", department: "営業部", alerts: 12, resolved: 8, pending: 4, previousAlerts: 10, previousResolved: 6, previousPending: 4 },
    { name: "鈴木美咲", department: "営業部", alerts: 8, resolved: 6, pending: 2, previousAlerts: 7, previousResolved: 5, previousPending: 2 },
    { name: "高橋健一", department: "営業部", alerts: 8, resolved: 5, pending: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
    { name: "中村優子", department: "営業部", alerts: 8, resolved: 5, pending: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
    { name: "渡辺大輔", department: "営業部", alerts: 8, resolved: 5, pending: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
    { name: "山田真一", department: "インサイドセールス", alerts: 8, resolved: 5, pending: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
    { name: "松本理恵", department: "カスタマーサクセス", alerts: 8, resolved: 5, pending: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
    { name: "石井亮介", department: "インサイドセールス", alerts: 8, resolved: 5, pending: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
    { name: "大野美咲", department: "インサイドセールス", alerts: 8, resolved: 5, pending: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
    { name: "藤田剛", department: "カスタマーサクセス", alerts: 8, resolved: 5, pending: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
  ],
  quarterly: [
    { name: "田中太郎", department: "営業部", alerts: 36, resolved: 24, pending: 12, previousAlerts: 30, previousResolved: 18, previousPending: 12 },
    { name: "鈴木美咲", department: "営業部", alerts: 24, resolved: 18, pending: 6, previousAlerts: 21, previousResolved: 15, previousPending: 6 },
    { name: "高橋健一", department: "営業部", alerts: 24, resolved: 15, pending: 9, previousAlerts: 18, previousResolved: 12, previousPending: 6 },
    { name: "中村優子", department: "営業部", alerts: 24, resolved: 15, pending: 9, previousAlerts: 18, previousResolved: 12, previousPending: 6 },
    { name: "渡辺大輔", department: "営業部", alerts: 24, resolved: 15, pending: 9, previousAlerts: 18, previousResolved: 12, previousPending: 6 },
    { name: "山田真一", department: "インサイドセールス", alerts: 24, resolved: 15, pending: 9, previousAlerts: 18, previousResolved: 12, previousPending: 6 },
    { name: "松本理恵", department: "カスタマーサクセス", alerts: 24, resolved: 15, pending: 9, previousAlerts: 18, previousResolved: 12, previousPending: 6 },
    { name: "石井亮介", department: "インサイドセールス", alerts: 24, resolved: 15, pending: 9, previousAlerts: 18, previousResolved: 12, previousPending: 6 },
    { name: "大野美咲", department: "インサイドセールス", alerts: 24, resolved: 15, pending: 9, previousAlerts: 18, previousResolved: 12, previousPending: 6 },
    { name: "藤田剛", department: "カスタマーサクセス", alerts: 24, resolved: 15, pending: 9, previousAlerts: 18, previousResolved: 12, previousPending: 6 },
  ],
  yearly: [
    { name: "田中太郎", department: "営業部", alerts: 144, resolved: 96, pending: 48, previousAlerts: 120, previousResolved: 72, previousPending: 48 },
    { name: "鈴木美咲", department: "営業部", alerts: 96, resolved: 72, pending: 24, previousAlerts: 84, previousResolved: 60, previousPending: 24 },
    { name: "高橋健一", department: "営業部", alerts: 96, resolved: 60, pending: 36, previousAlerts: 72, previousResolved: 48, previousPending: 24 },
    { name: "中村優子", department: "営業部", alerts: 96, resolved: 60, pending: 36, previousAlerts: 72, previousResolved: 48, previousPending: 24 },
    { name: "渡辺大輔", department: "営業部", alerts: 96, resolved: 60, pending: 36, previousAlerts: 72, previousResolved: 48, previousPending: 24 },
    { name: "山田真一", department: "インサイドセールス", alerts: 96, resolved: 60, pending: 36, previousAlerts: 72, previousResolved: 48, previousPending: 24 },
    { name: "松本理恵", department: "カスタマーサクセス", alerts: 96, resolved: 60, pending: 36, previousAlerts: 72, previousResolved: 48, previousPending: 24 },
    { name: "石井亮介", department: "インサイドセールス", alerts: 96, resolved: 60, pending: 36, previousAlerts: 72, previousResolved: 48, previousPending: 24 },
    { name: "大野美咲", department: "インサイドセールス", alerts: 96, resolved: 60, pending: 36, previousAlerts: 72, previousResolved: 48, previousPending: 24 },
    { name: "藤田剛", department: "カスタマーサクセス", alerts: 96, resolved: 60, pending: 36, previousAlerts: 72, previousResolved: 48, previousPending: 24 },
  ],
}

// 部門別アラートデータ
export const departmentAlertData = {
  weekly: [
    { name: "営業部", alerts: 10, resolved: 6, pending: 4, members: 5, previousAlerts: 8, previousResolved: 5, previousPending: 3 },
    { name: "インサイドセールス", alerts: 8, resolved: 5, pending: 3, members: 3, previousAlerts: 6, previousResolved: 4, previousPending: 2 },
    { name: "カスタマーサクセス", alerts: 12, resolved: 7, pending: 5, members: 2, previousAlerts: 10, previousResolved: 6, previousPending: 4 },
  ],
  monthly: [
    { name: "営業部", alerts: 40, resolved: 24, pending: 16, members: 5, previousAlerts: 35, previousResolved: 20, previousPending: 15 },
    { name: "インサイドセールス", alerts: 32, resolved: 20, pending: 12, members: 3, previousAlerts: 28, previousResolved: 16, previousPending: 12 },
    { name: "カスタマーサクセス", alerts: 48, resolved: 28, pending: 20, members: 2, previousAlerts: 40, previousResolved: 24, previousPending: 16 },
  ],
  quarterly: [
    { name: "営業部", alerts: 120, resolved: 72, pending: 48, members: 5, previousAlerts: 105, previousResolved: 60, previousPending: 45 },
    { name: "インサイドセールス", alerts: 96, resolved: 60, pending: 36, members: 3, previousAlerts: 84, previousResolved: 48, previousPending: 36 },
    { name: "カスタマーサクセス", alerts: 144, resolved: 84, pending: 60, members: 2, previousAlerts: 120, previousResolved: 72, previousPending: 48 },
  ],
  yearly: [
    { name: "営業部", alerts: 480, resolved: 288, pending: 192, members: 5, previousAlerts: 420, previousResolved: 240, previousPending: 180 },
    { name: "インサイドセールス", alerts: 384, resolved: 240, pending: 144, members: 3, previousAlerts: 336, previousResolved: 192, previousPending: 144 },
    { name: "カスタマーサクセス", alerts: 576, resolved: 336, pending: 240, members: 2, previousAlerts: 480, previousResolved: 288, previousPending: 192 },
  ],
}

// 時系列データ
export const timeSeriesData = {
  weekly: [
    { period: "月", alerts: 6, resolved: 4, pending: 2, previousAlerts: 5, previousResolved: 3, previousPending: 2 },
    { period: "火", alerts: 5, resolved: 3, pending: 2, previousAlerts: 4, previousResolved: 2, previousPending: 2 },
    { period: "水", alerts: 4, resolved: 2, pending: 2, previousAlerts: 3, previousResolved: 2, previousPending: 1 },
    { period: "木", alerts: 5, resolved: 3, pending: 2, previousAlerts: 4, previousResolved: 2, previousPending: 2 },
    { period: "金", alerts: 6, resolved: 4, pending: 2, previousAlerts: 5, previousResolved: 3, previousPending: 2 },
  ],
  monthly: [
    { period: "第1週", alerts: 20, resolved: 12, pending: 8, previousAlerts: 18, previousResolved: 10, previousPending: 8 },
    { period: "第2週", alerts: 18, resolved: 10, pending: 8, previousAlerts: 16, previousResolved: 9, previousPending: 7 },
    { period: "第3週", alerts: 16, resolved: 9, pending: 7, previousAlerts: 14, previousResolved: 8, previousPending: 6 },
    { period: "第4週", alerts: 14, resolved: 8, pending: 6, previousAlerts: 12, previousResolved: 7, previousPending: 5 },
  ],
  quarterly: [
    { period: "1月", alerts: 68, resolved: 39, pending: 29, previousAlerts: 60, previousResolved: 34, previousPending: 26 },
    { period: "2月", alerts: 64, resolved: 36, pending: 28, previousAlerts: 56, previousResolved: 32, previousPending: 24 },
    { period: "3月", alerts: 60, resolved: 33, pending: 27, previousAlerts: 52, previousResolved: 30, previousPending: 22 },
  ],
  yearly: [
    { period: "Q1", alerts: 192, resolved: 108, pending: 84, previousAlerts: 168, previousResolved: 96, previousPending: 72 },
    { period: "Q2", alerts: 180, resolved: 99, pending: 81, previousAlerts: 156, previousResolved: 87, previousPending: 69 },
    { period: "Q3", alerts: 168, resolved: 90, pending: 78, previousAlerts: 144, previousResolved: 78, previousPending: 66 },
    { period: "Q4", alerts: 156, resolved: 81, pending: 75, previousAlerts: 132, previousResolved: 69, previousPending: 63 },
  ],
}

// アラート詳細データ（alertsDataと整合）
export const alertDetailData = {
  // 契約・商談セグメント
  "ALT-001": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 09:00:00"
      }
    ],
    messages: [
      {
        name: "佐藤様",
        sender: "client",
        content: "お世話になっております。<span style='background:yellow;font-weight:bold'>解約</span>についてご相談があります。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 09:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "田中太郎",
        sender: "self",
        content: "佐藤様、解約について詳しくお聞かせいただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 09:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "佐藤様",
        sender: "client",
        content: "サービスの<span style='background:yellow;font-weight:bold'>解約</span>を検討しています。<span style='background:yellow;font-weight:bold'>他社</span>に<span style='background:yellow;font-weight:bold'>移行</span>する予定です。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 09:30:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "サービスの解約を検討。他社への移行予定。"
  },
  "ALT-002": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 10:15:00"
      }
    ],
    messages: [
      {
        name: "山田様",
        sender: "client",
        content: "お世話になっております。<span style='background:yellow;font-weight:bold'>他社</span>から新しい提案を受けています。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 10:15:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "鈴木美咲",
        sender: "self",
        content: "山田様、他社からの提案について詳しくお聞かせいただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 10:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "山田様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>比較検討</span>中です。御社との<span style='background:yellow;font-weight:bold'>競合</span>他社からの提案書を検討しています。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 10:45:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "他社から新しい提案を受けている。比較検討中。"
  },
  "ALT-003": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 11:30:00"
      }
    ],
    messages: [
      {
        name: "伊藤様",
        sender: "client",
        content: "お世話になっております。<span style='background:yellow;font-weight:bold'>価格</span>について、もう少し<span style='background:yellow;font-weight:bold'>値引き</span>できませんか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 11:30:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "高橋健一",
        sender: "self",
        content: "伊藤様、価格について詳しくお聞かせいただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 11:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "伊藤様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>予算</span>が<span style='background:yellow;font-weight:bold'>厳しい</span>状況です。<span style='background:yellow;font-weight:bold'>コスト</span>の見直しをお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 12:00:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "価格について値引き要求。予算が厳しい状況。"
  },
  "ALT-004": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 13:00:00"
      }
    ],
    messages: [
      {
        name: "小林様",
        sender: "client",
        content: "お世話になっております。<span style='background:yellow;font-weight:bold'>契約書</span>の条項について確認したい点があります。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 13:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "中村優子",
        sender: "self",
        content: "小林様、契約書の条項についてどのような点でご確認されたいでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 13:20:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "小林様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>修正</span>が必要です。いくつかの<span style='background:yellow;font-weight:bold'>条件</span>について変更をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 13:40:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "契約書の条項について確認。修正が必要。"
  },

  // 営業プロセスセグメント
  "ALT-005": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 09:00:00"
      }
    ],
    messages: [
      {
        name: "竹内様",
        sender: "client",
        content: "お世話になっております。先日お願いしたお<span style='background:yellow;font-weight:bold'>見積もり</span>はいつ頃いただけますか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 09:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "大野美咲",
        sender: "self",
        content: "竹内様、見積もり書を準備中です。今週中にお送りいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 09:10:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "竹内様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>急いで</span>います。できれば金曜日までにお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 09:20:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "見積もりの催促。急いでいる。金曜日までに要求。"
  },
  "ALT-006": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 10:15:00"
      }
    ],
    messages: [
      {
        name: "佐々木様",
        sender: "client",
        content: "お世話になっております。新しい<span style='background:yellow;font-weight:bold'>提案書</span>を作成してください。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 10:15:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "藤田剛",
        sender: "self",
        content: "佐々木様、承知いたしました。提案書を準備いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 10:25:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "佐々木様",
        sender: "client",
        content: "来週の<span style='background:yellow;font-weight:bold'>会議</span>で使用します。<span style='background:yellow;font-weight:bold'>デモ</span>も含めてお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 10:35:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "新しい提案書の作成要求。来週の会議で使用。デモも含めて要求。"
  },
  "ALT-007": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 11:30:00"
      }
    ],
    messages: [
      {
        name: "井上様",
        sender: "client",
        content: "お世話になっております。先日のメールにご<span style='background:yellow;font-weight:bold'>返信</span>いただけていないようです。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 11:30:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "田中太郎",
        sender: "self",
        content: "井上様、申し訳ございません。確認をお願いします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 11:40:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "井上様",
        sender: "client",
        content: "3日前に送信したメールについて<span style='background:yellow;font-weight:bold'>連絡がない</span>状況です。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 11:50:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "返信がない。3日前のメールに連絡がない状況。"
  },
  "ALT-008": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 13:00:00"
      }
    ],
    messages: [
      {
        name: "中島様",
        sender: "client",
        content: "お世話になっております。<span style='background:yellow;font-weight:bold'>納期</span>について確認したいのですが、",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 13:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "高橋健一",
        sender: "self",
        content: "中島様、納期についてどのような点でご確認されたいでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 13:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "中島様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>予定</span>通りに<span style='background:yellow;font-weight:bold'>間に合う</span>かどうか確認したいです。<span style='background:yellow;font-weight:bold'>期限</span>が迫っています。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 13:30:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "納期の確認。予定通りに間に合うか確認。期限が迫っている。"
  },
  "ALT-009": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 14:15:00"
      }
    ],
    messages: [
      {
        name: "岡田様",
        sender: "client",
        content: "お世話になっております。社内で<span style='background:yellow;font-weight:bold'>予算削減</span>の指示があり、",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 14:15:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "鈴木美咲",
        sender: "self",
        content: "岡田様、予算削減について詳しくお聞かせいただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 14:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "岡田様",
        sender: "client",
        content: "今回の投資は<span style='background:yellow;font-weight:bold'>見送り</span>となりました。<span style='background:yellow;font-weight:bold'>凍結</span>の指示が出ています。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 14:45:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "社内で予算削減の指示。今回の投資は見送り。凍結の指示。"
  },
  "ALT-010": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 15:30:00"
      }
    ],
    messages: [
      {
        name: "西村様",
        sender: "client",
        content: "お世話になっております。見積もりについて<span style='background:yellow;font-weight:bold'>急いで</span>います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 15:30:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "松本理恵",
        sender: "self",
        content: "西村様、承知いたしました。早めにご対応いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 15:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "西村様",
        sender: "client",
        content: "早めにご対応ください。来週の会議で使用する予定です。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 16:00:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "見積もりについて急いでいる。来週の会議で使用予定。"
  },
  "ALT-011": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 09:00:00"
      }
    ],
    messages: [
      {
        name: "北村様",
        sender: "client",
        content: "お世話になっております。今回の投資は<span style='background:yellow;font-weight:bold'>見送り</span>となりました。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 09:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "石井亮介",
        sender: "self",
        content: "北村様、見送りについて詳しくお聞かせいただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 09:20:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "北村様",
        sender: "client",
        content: "社内の予算削減により、外部サービスの見直しを行うことになりました。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 09:40:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "今回の投資は見送り。社内の予算削減により外部サービスの見直し。"
  },

  // クレームセグメント
  "ALT-012": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 10:20:00"
      }
    ],
    messages: [
      {
        name: "西様",
        sender: "client",
        content: "お世話になっております。大変申し訳ないのですが、<span style='background:yellow;font-weight:bold'>担当変更</span>をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 10:20:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "石井亮介",
        sender: "self",
        content: "西様、担当変更の理由について詳しくお聞かせいただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 10:35:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "西様",
        sender: "client",
        content: "現在の担当者との相性が良くなく、<span style='background:yellow;font-weight:bold'>合わない</span>状況です。<span style='background:yellow;font-weight:bold'>交代</span>をお願いします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 10:50:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "担当変更の要望。現在の担当者との相性が良くない。交代を要求。"
  },
  "ALT-013": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 12:50:00"
      }
    ],
    messages: [
      {
        name: "東様",
        sender: "client",
        content: "お世話になっております。先日納品された製品の品質に<span style='background:yellow;font-weight:bold'>不満</span>があります。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 12:50:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "松本理恵",
        sender: "self",
        content: "東様、品質についてどのような点でご不満をお持ちでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 13:05:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "東様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>説明と違う</span>点について<span style='background:yellow;font-weight:bold'>改善要求</span>します。<span style='background:yellow;font-weight:bold'>クレーム</span>として対応をお願いします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 13:20:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "先日納品された製品の品質に不満。説明と違う点について改善要求。"
  },

  // 導入後効果セグメント
  "ALT-014": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-18 13:00:00"
      }
    ],
    messages: [
      {
        name: "沖縄様",
        sender: "client",
        content: "お世話になっております。導入してから3ヶ月経ちますが、あまり<span style='background:yellow;font-weight:bold'>効果が出ない</span>ように感じます。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 13:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "高橋健一",
        sender: "self",
        content: "沖縄様、効果についてどのような点でご確認されたいでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 13:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "沖縄様",
        sender: "client",
        content: "業務効率の改善が期待していましたが、実際には変化を感じられません。<span style='background:yellow;font-weight:bold'>期待外れ</span>です。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 13:30:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "導入してから3ヶ月経つが効果が出ない。業務効率改善の期待に反して変化を感じられない。"
  },
  "ALT-015": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-18 14:15:00"
      }
    ],
    messages: [
      {
        name: "四国様",
        sender: "client",
        content: "お世話になっております。システムを<span style='background:yellow;font-weight:bold'>活用できていない</span>状況です。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 14:15:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "中村優子",
        sender: "self",
        content: "四国様、どのような点で活用できていないとお感じでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 14:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "四国様",
        sender: "client",
        content: "機能の使い方が分からず、十分に活用できていません。<span style='background:yellow;font-weight:bold'>費用対効果</span>も感じられません。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 14:45:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "システムを活用できていない。機能の使い方が分からない。費用対効果も感じられない。"
  }
}

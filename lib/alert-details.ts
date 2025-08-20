// アラート詳細データ（1-5往復のランダムなチャット履歴）
export const alertDetailData = {
  "ALT-001": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 09:15:00"
      }
    ],
    messages: [
      {
        name: "佐藤様",
        sender: "client",
        content: "お世話になっております。現在の<span style='background:yellow;font-weight:bold'>価格交渉</span>について相談させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 09:15:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "田中太郎",
        sender: "self",
        content: "佐藤様、ご連絡ありがとうございます。価格について柔軟に対応させていただきます。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 09:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "佐藤様",
        sender: "client",
        content: "ありがとうございます。予算の関係で、現在の価格から15%程度の値引きをお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 09:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "田中太郎",
        sender: "self",
        content: "承知いたしました。社内で検討して、最適な価格設定をご提案いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 10:00:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "価格交渉の要求。15%の値引きを求められています。"
  },
  "ALT-002": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 10:30:00"
      }
    ],
    messages: [
      {
        name: "山田様",
        sender: "client",
        content: "先日お願いした<span style='background:yellow;font-weight:bold'>見積もり</span>の件、進捗いかがでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 10:30:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "鈴木美咲",
        sender: "self",
        content: "山田様、申し訳ございません。本日中にお送りいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 10:45:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "見積もり送付の催促。早急な対応が求められています。"
  },
  "ALT-003": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 11:45:00"
      }
    ],
    messages: [
      {
        name: "伊藤様",
        sender: "client",
        content: "御社のサービスについて<span style='background:yellow;font-weight:bold'>競合他社の提案</span>もいただいており、比較検討したいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 11:45:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "高橋健一",
        sender: "self",
        content: "伊藤様、ご連絡ありがとうございます。他社との比較資料を準備いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 12:00:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "伊藤様",
        sender: "client",
        content: "ありがとうございます。できれば来週中にお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 12:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "高橋健一",
        sender: "self",
        content: "承知いたしました。来週水曜日までに詳細な比較資料をお送りいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 12:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "伊藤様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 12:45:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "競合他社との比較検討要求。来週水曜日までに資料提出が必要。"
  },
  "ALT-004": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 13:20:00"
      }
    ],
    messages: [
      {
        name: "小林様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>契約条件の変更</span>について相談させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 13:20:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "中村優子",
        sender: "self",
        content: "小林様、ご連絡ありがとうございます。どのような変更をお考えでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 13:35:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "小林様",
        sender: "client",
        content: "支払い条件を月払いから年払いに変更したいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 13:50:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "契約条件の変更要求。支払い条件の変更を求められています。"
  },
  "ALT-005": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 14:35:00"
      }
    ],
    messages: [
      {
        name: "加藤様",
        sender: "client",
        content: "御社の製品について<span style='background:yellow;font-weight:bold'>デモンストレーション</span>をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 14:35:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "渡辺大輔",
        sender: "self",
        content: "加藤様、ご連絡ありがとうございます。デモンストレーションの日程を調整いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 14:50:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "加藤様",
        sender: "client",
        content: "ありがとうございます。来週の火曜日か水曜日でお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 15:05:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "渡辺大輔",
        sender: "self",
        content: "承知いたしました。火曜日の午後2時からはいかがでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 15:20:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "加藤様",
        sender: "client",
        content: "火曜日の午後2時でお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 15:35:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "デモンストレーション要求。火曜日午後2時にデモを実施予定。"
  },
  "ALT-006": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 15:50:00"
      }
    ],
    messages: [
      {
        name: "斎藤様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>支払い条件の交渉</span>について相談させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 15:50:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "山田真一",
        sender: "self",
        content: "斎藤様、ご連絡ありがとうございます。どのような条件をお考えでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 16:05:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "支払い条件の交渉要求。詳細な条件について確認が必要。"
  },
  "ALT-007": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-15 16:05:00"
      }
    ],
    messages: [
      {
        name: "森様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>導入スケジュールの変更</span>について相談させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 16:05:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "松本理恵",
        sender: "self",
        content: "森様、ご連絡ありがとうございます。どのような変更をお考えでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 16:20:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "森様",
        sender: "client",
        content: "来年2月から3月に延期したいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 16:35:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "松本理恵",
        sender: "self",
        content: "承知いたしました。スケジュールを調整いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-15 16:50:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "導入スケジュールの変更要求。来年2-3月への延期を求められています。"
  },
  "ALT-008": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 09:10:00"
      }
    ],
    messages: [
      {
        name: "福田様",
        sender: "client",
        content: "現在のシステムに<span style='background:yellow;font-weight:bold'>機能追加</span>をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 09:10:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "石井亮介",
        sender: "self",
        content: "福田様、ご連絡ありがとうございます。どのような機能をお考えでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 09:25:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "福田様",
        sender: "client",
        content: "レポート機能の追加をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 09:40:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "石井亮介",
        sender: "self",
        content: "承知いたしました。レポート機能の詳細を確認して、見積もりをお送りいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 09:55:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "福田様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 10:10:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "機能追加要求。レポート機能の追加を求められています。"
  },
  "ALT-009": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 10:25:00"
      }
    ],
    messages: [
      {
        name: "竹内様",
        sender: "client",
        content: "御社のサービスと<span style='background:yellow;font-weight:bold'>競合比較</span>の資料をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 10:25:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "大野美咲",
        sender: "self",
        content: "竹内様、ご連絡ありがとうございます。競合比較資料を準備いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 10:40:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "競合比較資料の要求。詳細な比較資料の提出が必要。"
  },
  "ALT-010": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 11:40:00"
      }
    ],
    messages: [
      {
        name: "佐々木様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>無料トライアル</span>の期間を延長していただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 11:40:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "藤田剛",
        sender: "self",
        content: "佐々木様、ご連絡ありがとうございます。トライアル期間の延長について検討いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 11:55:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "佐々木様",
        sender: "client",
        content: "ありがとうございます。もう1ヶ月程度お願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 12:10:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "藤田剛",
        sender: "self",
        content: "承知いたしました。1ヶ月の延長を承認いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 12:25:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "無料トライアル延長要求。1ヶ月の延長を承認済み。"
  },
  "ALT-011": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 13:15:00"
      }
    ],
    messages: [
      {
        name: "井上様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>価格見直し</span>について相談させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 13:15:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "田中太郎",
        sender: "self",
        content: "井上様、ご連絡ありがとうございます。どのような見直しをお考えでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 13:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "井上様",
        sender: "client",
        content: "現在の価格から20%程度の値引きをお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 13:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "田中太郎",
        sender: "self",
        content: "承知いたしました。社内で検討して、最適な価格設定をご提案いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 14:00:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "井上様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 14:15:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "価格見直し要求。20%の値引きを求められています。"
  },
  "ALT-012": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 14:30:00"
      }
    ],
    messages: [
      {
        name: "岡田様",
        sender: "client",
        content: "御社の<span style='background:yellow;font-weight:bold'>サポート体制</span>について確認させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 14:30:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "鈴木美咲",
        sender: "self",
        content: "岡田様、ご連絡ありがとうございます。サポート体制について詳しくご説明いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 14:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "岡田様",
        sender: "client",
        content: "ありがとうございます。24時間サポートは対応可能でしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 15:00:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "サポート体制の確認。24時間サポートについて問い合わせ。"
  },
  "ALT-013": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-16 15:45:00"
      }
    ],
    messages: [
      {
        name: "中島様",
        sender: "client",
        content: "現在のサービスについて<span style='background:yellow;font-weight:bold'>解約の検討</span>をしています。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 15:45:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "高橋健一",
        sender: "self",
        content: "中島様、ご連絡ありがとうございます。解約の理由についてお聞かせいただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 16:00:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "中島様",
        sender: "client",
        content: "予算の見直しにより、コスト削減が必要になりました。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 16:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "高橋健一",
        sender: "self",
        content: "承知いたしました。コスト削減のための代替案をご提案させていただきます。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 16:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "中島様",
        sender: "client",
        content: "ありがとうございます。代替案をお待ちしております。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-16 16:45:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "解約検討の連絡。コスト削減のため代替案を提案予定。"
  },
  "ALT-014": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 09:20:00"
      }
    ],
    messages: [
      {
        name: "西村様",
        sender: "client",
        content: "現在のシステムの<span style='background:yellow;font-weight:bold'>カスタマイズ</span>をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 09:20:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "中村優子",
        sender: "self",
        content: "西村様、ご連絡ありがとうございます。どのようなカスタマイズをお考えでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 09:35:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "西村様",
        sender: "client",
        content: "ダッシュボードのレイアウト変更をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 09:50:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "カスタマイズ要求。ダッシュボードのレイアウト変更を求められています。"
  },
  "ALT-015": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 10:35:00"
      }
    ],
    messages: [
      {
        name: "北村様",
        sender: "client",
        content: "他社から<span style='background:yellow;font-weight:bold'>他社からの提案</span>をいただいており、御社のサービスと比較検討したいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 10:35:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "渡辺大輔",
        sender: "self",
        content: "北村様、ご連絡ありがとうございます。他社との比較資料を準備いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 10:50:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "北村様",
        sender: "client",
        content: "ありがとうございます。できれば今週中にお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 11:05:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "渡辺大輔",
        sender: "self",
        content: "承知いたしました。金曜日までに詳細な比較資料をお送りいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 11:20:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "他社からの提案について。金曜日までに比較資料を提出予定。"
  },
  "ALT-016": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 11:50:00"
      }
    ],
    messages: [
      {
        name: "南様",
        sender: "client",
        content: "ユーザー向けの<span style='background:yellow;font-weight:bold'>教育・研修</span>をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 11:50:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "山田真一",
        sender: "self",
        content: "南様、ご連絡ありがとうございます。教育・研修の詳細について確認させていただきます。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 12:05:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "南様",
        sender: "client",
        content: "新機能の使い方について研修をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 12:20:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "山田真一",
        sender: "self",
        content: "承知いたしました。新機能の研修を実施いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 12:35:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "南様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 12:50:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "教育・研修要求。新機能の使い方について研修を実施予定。"
  },
  "ALT-017": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 13:05:00"
      }
    ],
    messages: [
      {
        name: "東様",
        sender: "client",
        content: "現在の契約について<span style='background:yellow;font-weight:bold'>契約更新の条件</span>を確認させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 13:05:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "松本理恵",
        sender: "self",
        content: "東様、ご連絡ありがとうございます。契約更新の条件について詳しくご説明いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 13:20:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "東様",
        sender: "client",
        content: "ありがとうございます。価格の変更はありますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 13:35:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "契約更新条件の確認。価格変更について問い合わせ。"
  },
  "ALT-018": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 14:20:00"
      }
    ],
    messages: [
      {
        name: "西様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>技術サポート</span>をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 14:20:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "石井亮介",
        sender: "self",
        content: "西様、ご連絡ありがとうございます。どのような技術的な問題がございますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 14:35:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "西様",
        sender: "client",
        content: "システムの動作が遅くなっており、原因を調査していただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 14:50:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "石井亮介",
        sender: "self",
        content: "承知いたしました。システムの動作確認を実施いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 15:05:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "技術サポート要求。システムの動作遅延について調査を実施予定。"
  },
  "ALT-019": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-17 15:35:00"
      }
    ],
    messages: [
      {
        name: "東北様",
        sender: "client",
        content: "御社の<span style='background:yellow;font-weight:bold'>価格競争力</span>について確認させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 15:35:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "大野美咲",
        sender: "self",
        content: "東北様、ご連絡ありがとうございます。価格競争力について詳しくご説明いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 15:50:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "東北様",
        sender: "client",
        content: "他社との価格比較資料をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 16:05:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "大野美咲",
        sender: "self",
        content: "承知いたしました。価格比較資料を準備いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 16:20:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "東北様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-17 16:35:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "価格競争力の確認。他社との価格比較資料を準備予定。"
  },
  "ALT-020": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-18 09:30:00"
      }
    ],
    messages: [
      {
        name: "関西様",
        sender: "client",
        content: "御社の<span style='background:yellow;font-weight:bold'>導入事例</span>について紹介していただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 09:30:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "藤田剛",
        sender: "self",
        content: "関西様、ご連絡ありがとうございます。導入事例について詳しくご紹介いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 09:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "関西様",
        sender: "client",
        content: "ありがとうございます。同業他社の事例を特に知りたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 10:00:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "導入事例の紹介要求。同業他社の事例について問い合わせ。"
  },
  "ALT-021": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-18 10:45:00"
      }
    ],
    messages: [
      {
        name: "九州様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>支払い遅延</span>について相談させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 10:45:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "田中太郎",
        sender: "self",
        content: "九州様、ご連絡ありがとうございます。支払い遅延について詳しくお聞かせください。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 11:00:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "九州様",
        sender: "client",
        content: "来月の支払いを1ヶ月延期していただけますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 11:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "田中太郎",
        sender: "self",
        content: "承知いたしました。支払い延期について社内で検討いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 11:30:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "支払い遅延の相談。1ヶ月の支払い延期を求められています。"
  },
  "ALT-022": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-18 12:00:00"
      }
    ],
    messages: [
      {
        name: "北海道様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>機能制限</span>の解除をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 12:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "鈴木美咲",
        sender: "self",
        content: "北海道様、ご連絡ありがとうございます。どのような機能制限でしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 12:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "北海道様",
        sender: "client",
        content: "エクスポート機能の制限を解除していただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 12:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "鈴木美咲",
        sender: "self",
        content: "承知いたしました。エクスポート機能の制限解除を実施いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 12:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "北海道様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 13:00:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "機能制限解除要求。エクスポート機能の制限解除を実施予定。"
  },
  "ALT-023": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-18 13:15:00"
      }
    ],
    messages: [
      {
        name: "沖縄様",
        sender: "client",
        content: "御社のサービスと<span style='background:yellow;font-weight:bold'>他社との比較検討</span>をしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 13:15:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "高橋健一",
        sender: "self",
        content: "沖縄様、ご連絡ありがとうございます。他社との比較資料を準備いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 13:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "沖縄様",
        sender: "client",
        content: "ありがとうございます。来週中にお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 13:45:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "他社との比較検討。来週中に比較資料を提出予定。"
  },
  "ALT-024": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-18 14:30:00"
      }
    ],
    messages: [
      {
        name: "四国様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>ユーザー数の増加</span>に伴い、対応をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 14:30:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "中村優子",
        sender: "self",
        content: "四国様、ご連絡ありがとうございます。ユーザー数増加について詳しくお聞かせください。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 14:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "四国様",
        sender: "client",
        content: "現在100名から200名に増加予定です。ライセンスの追加をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 15:00:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "中村優子",
        sender: "self",
        content: "承知いたしました。ライセンス追加の手続きを進めさせていただきます。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 15:15:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "ユーザー数増加対応。100名から200名への増加に伴うライセンス追加。"
  },
  "ALT-025": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-18 15:45:00"
      }
    ],
    messages: [
      {
        name: "中部様",
        sender: "client",
        content: "御社のサービスの<span style='background:yellow;font-weight:bold'>セキュリティ要件</span>について確認させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 15:45:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "渡辺大輔",
        sender: "self",
        content: "中部様、ご連絡ありがとうございます。セキュリティ要件について詳しくご説明いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 16:00:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "中部様",
        sender: "client",
        content: "ありがとうございます。ISO27001認証は取得されていますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 16:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "渡辺大輔",
        sender: "self",
        content: "はい、ISO27001認証を取得しております。詳細資料をお送りいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 16:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "中部様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-18 16:45:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "セキュリティ要件の確認。ISO27001認証について問い合わせ。"
  },
  "ALT-026": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-19 09:00:00"
      }
    ],
    messages: [
      {
        name: "中国様",
        sender: "client",
        content: "<span style='background:yellow;font-weight:bold'>データ移行</span>の支援をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 09:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "山田真一",
        sender: "self",
        content: "中国様、ご連絡ありがとうございます。データ移行について詳しくお聞かせください。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 09:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "中国様",
        sender: "client",
        content: "他社のシステムから御社のシステムへのデータ移行をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 09:30:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "データ移行支援要求。他社システムからのデータ移行を求められています。"
  },
  "ALT-027": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-19 10:15:00"
      }
    ],
    messages: [
      {
        name: "近畿様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>契約期間の延長</span>について相談させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 10:15:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "松本理恵",
        sender: "self",
        content: "近畿様、ご連絡ありがとうございます。契約期間の延長について詳しくお聞かせください。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 10:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "近畿様",
        sender: "client",
        content: "現在1年契約ですが、3年契約への延長をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 10:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "松本理恵",
        sender: "self",
        content: "承知いたしました。3年契約への延長について検討いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 11:00:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "近畿様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 11:15:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "契約期間延長要求。1年契約から3年契約への延長を求められています。"
  },
  "ALT-028": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-19 11:30:00"
      }
    ],
    messages: [
      {
        name: "関東様",
        sender: "client",
        content: "現在のシステムの<span style='background:yellow;font-weight:bold'>パフォーマンス改善</span>をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 11:30:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "石井亮介",
        sender: "self",
        content: "関東様、ご連絡ありがとうございます。どのようなパフォーマンスの問題がございますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 11:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "関東様",
        sender: "client",
        content: "データ処理の速度が遅くなっており、改善をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 12:00:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "パフォーマンス改善要求。データ処理速度の改善を求められています。"
  },
  "ALT-029": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-19 13:45:00"
      }
    ],
    messages: [
      {
        name: "東海様",
        sender: "client",
        content: "現在の<span style='background:yellow;font-weight:bold'>価格体系の変更</span>について相談させていただきたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 13:45:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "大野美咲",
        sender: "self",
        content: "東海様、ご連絡ありがとうございます。どのような価格体系の変更をお考えでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 14:00:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "東海様",
        sender: "client",
        content: "従量課金から固定料金への変更をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 14:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "大野美咲",
        sender: "self",
        content: "承知いたしました。価格体系の変更について検討いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 14:30:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "価格体系変更要求。従量課金から固定料金への変更を求められています。"
  },
  "ALT-030": {
    detections: [
      {
        tool: "gmail",
        toolName: "Gmail",
        location: "受信トレイ",
        timestamp: "2024-12-19 15:00:00"
      }
    ],
    messages: [
      {
        name: "北陸様",
        sender: "client",
        content: "御社の<span style='background:yellow;font-weight:bold'>サポート体制の強化</span>をお願いできますでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 15:00:00",
        tool: "gmail",
        isAlert: true
      },
      {
        name: "藤田剛",
        sender: "self",
        content: "北陸様、ご連絡ありがとうございます。どのようなサポート体制の強化をお考えでしょうか？",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 15:15:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "北陸様",
        sender: "client",
        content: "専任のサポート担当者の配置をお願いしたいと思います。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 15:30:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "藤田剛",
        sender: "self",
        content: "承知いたしました。専任サポート担当者の配置について検討いたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 15:45:00",
        tool: "gmail",
        isAlert: false
      },
      {
        name: "北陸様",
        sender: "client",
        content: "よろしくお願いいたします。",
        avatar: "/placeholder-user.jpg",
        timestamp: "2024-12-19 16:00:00",
        tool: "gmail",
        isAlert: false
      }
    ],
    summary: "サポート体制強化要求。専任サポート担当者の配置を求められています。"
  }
} 
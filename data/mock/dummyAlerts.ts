import { Alert, EmailThread } from '@/types';
import { SEGMENT_META, SegmentKey } from '@/lib/segments';

// 現在時刻を基準に現実的な日時を生成するヘルパー
const getRecentDate = (hoursAgo: number): string => {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString().replace('Z', '+09:00');
};

const renewalThread: EmailThread[] = [
  {
    id: 'msg-001',
    sender: 'suzuki@clientcorp.co.jp',
    recipient: 'tanaka@cross-m.co.jp', // 田中太郎
    timestamp: '2025-07-10T09:00:00+09:00',
    ai_summary: '決裁会議の前に最終見積と契約期間の条件確認を依頼。',
    subject: '【至急】2025年度契約更新の見積書ご送付のお願い',
    sentiment: 'neutral',
    replyLevel: 0,
    body: `田中様

いつもお世話になっております。ClientCorpの鈴木です。

実は来週月曜（7/17）に経営会議が入っておりまして、
2025年度の契約更新案件を審議することになりました。

現在の契約は月額12万円×50ユーザーで、来年1月から更新予定です。
経営層から「年間一括払いの割引があるか」「ユーザー数を80名に増やした場合の料金」を
確認するよう指示がありました。

つきましては、以下の2点についてご確認させていただけますでしょうか。

1. 年間一括払いの割引率
   → 現在の月額払い（月額12万円）と比較して、年間一括の場合の割引率

2. ユーザー数拡張時の料金
   → 50名から80名に増やした場合の月額料金（追加30名分の単価）

もし可能でしたら、見積書のドラフトを本日中にいただけますと助かります。
お忙しいところ恐縮ですが、よろしくお願いいたします。

鈴木`,
  },
  {
    id: 'msg-002',
    sender: 'tanaka@cross-m.co.jp', // 田中太郎
    recipient: 'suzuki@clientcorp.co.jp',
    timestamp: '2025-07-10T10:10:00+09:00',
    ai_summary: '年間一括払いの割引案と更新時の利用枠拡張プランを提示。',
    subject: 'Re: 【至急】2025年度契約更新の見積書ご送付のお願い',
    sentiment: 'neutral',
    replyLevel: 1,
    body: `鈴木様

お世話になっております。Cross-Mの田中です。

ご確認いただいた件、以下ご回答させていただきます。

【年間一括払いについて】
月額12万円の場合、年間一括払いは132.48万円（月額換算11.04万円）となります。
8%のディスカウントを適用させていただきます。

【ユーザー数拡張について】
50名から80名に増やす場合：
- 追加30名分の月額単価：8万円/名
- 追加分の月額料金：240万円
- 合計月額料金：600万円（既存50名分360万円 + 追加30名分240万円）

契約途中でユーザー数を増やす場合、追加分は日割り計算で同条件を適用します。
初期費用はかかりません。

詳細な見積書を添付しましたので、ご確認ください。
ご不明点があれば、お気軽にお声がけください。

田中`,
  },
  {
    id: 'msg-003',
    sender: 'suzuki@clientcorp.co.jp',
    recipient: 'tanaka@cross-m.co.jp', // 田中太郎
    timestamp: '2025-07-10T21:30:00+09:00',
    ai_summary: '深夜の社内会議で出た質問事項と回答希望期限を共有。',
    subject: 'Re: 【至急】2025年度契約更新の見積書ご送付のお願い',
    sentiment: 'negative',
    replyLevel: 2,
    body: `田中様

夜分遅くに失礼します。鈴木です。

実は本日21時から社内でレビュー会議がありまして、
経営層から追加で2点確認依頼が出ました。

明日（7/11）10時の決裁会議前にご回答いただけますと助かります。

【追加確認事項】
1. 8%ディスカウントは2年契約でも維持可能でしょうか？
   → 経営層から「長期契約のインセンティブはあるのか」という質問がありました

2. ユーザー拡張時の初期費用について
   → 先ほど「初期費用は発生しない」とのことでしたが、念のため確認させてください

要点だけでもメールでいただければ、会議資料に反映します。
お忙しいところ恐縮ですが、よろしくお願いいたします。

鈴木`,
  },
];

const expansionThread: EmailThread[] = [
  {
    id: 'msg-004',
    sender: 'ito@vip-client.co.jp',
    recipient: 'suzuki@cross-m.co.jp', // 鈴木一郎
    timestamp: '2025-07-09T09:15:00+09:00',
    ai_summary: '今年度追加ユーザー300名分の費用試算と導入スケジュールを確認。',
    subject: '【緊急】追加300ユーザー分の見積書と導入スケジュールのご提出について',
    sentiment: 'negative',
    replyLevel: 0,
    body: `鈴木様

お世話になっております。VIP Client Inc.の伊藤です。

先日お話しした大型案件部門への追加導入について、
社内決裁に進めるため、以下の資料を本日中にいただけますでしょうか。

現在、既存で200ユーザーを使用しており、新規部門で300ユーザーを追加導入予定です。
予算は年間3,000万円以内で検討しています。

【ご提出いただきたい資料】
1. 追加300ユーザー分の見積書
   → 初期費用、月額費用、年間総額を明記してください
   → 既存200ユーザーとの統合費用も含めてください

2. 段階的な導入スケジュール
   → 第1フェーズ（100名）：8月開始予定
   → 第2フェーズ（100名）：9月開始予定
   → 第3フェーズ（100名）：10月開始予定

実は、明日朝9時から経営会議がありまして、この案件の承認を取る必要があります。
社内からもかなり急かされており、大変恐縮ですが本日中にご対応いただけますと助かります。

ご不明点があれば、お電話でも構いませんのでお気軽にどうぞ。

伊藤`,
  },
  {
    id: 'msg-006',
    sender: 'ito@vip-client.co.jp',
    recipient: 'suzuki@cross-m.co.jp', // 鈴木一郎
    timestamp: '2025-07-09T14:05:00+09:00',
    ai_summary: '決裁条件として週内の稟議資料提出を要望し、急ぎの対応を依頼。',
    subject: 'Re: 【緊急】追加300ユーザー分の見積書と導入スケジュールのご提出について',
    sentiment: 'negative',
    replyLevel: 1,
    body: `鈴木様

お世話になっております。伊藤です。

先ほど送っていただいた見積書と導入スケジュール、確認しました。
ありがとうございます。

見積書の内容は概ね問題ないのですが、本日14時から社長との事前レビューがありまして、
以下の点について追加でご対応いただけますでしょうか。

【追加でご提出いただきたい資料】
1. ROI試算の詳細
   → 投資回収期間：何ヶ月で回収できるか
   → 3年間のROI率：具体的な数値（例：ROI 250%など）
   → 数値根拠：どのような前提で計算しているか

2. 保守費用の内訳
   → 月額保守費用120万円の内訳
   → サポート費用：○万円
   → アップデート費用：○万円
   → その他：○万円

3. 稟議フォーマットへの反映
   → 弊社の稟議フォーマット（添付）に沿ってまとめていただけますでしょうか
   → 特に「投資対効果」「リスク要因」「代替案」のセクションを充実させてください

実は、週内（7/12まで）の稟議通過が条件となっており、社内でも非常に急いでいます。
本日18時までにご共有いただけると助かります。

お忙しいところ何度も恐縮ですが、よろしくお願いいたします。

伊藤`,
  },
];



export const DUMMY_ALERTS: Alert[] = [
  // 田中太郎（5件）- forecast系（予兆系）に特化：早期発見・予防重視のパターン
  {
    id: 'dummy-alert-001',
    subject: '価格改定への懸念表明',
    severity: 'B',
    level: 'high',
    sentiment_score: -0.18,
    department: 'カスタマー営業',
    customer: 'GreenLeaf Farms',
    updated_at: getRecentDate(52),
    status: 'unhandled',
    ai_summary: '決裁会議前に見積条件の精査を求められており、競合比較の不安が高まっています。',
    emails: renewalThread,
    assignee: 'tanaka@cross-m.co.jp',
    company: 'GreenLeaf Farms',
    detection_score: 62,
    phrases: ['価格改定', '競合比較', 'ROI'],
    threadId: 'thread-001',
    messageId: 'msg-003',
    sentiment_label: 'negative',
    negative_flag: false,
    primarySegment: 'forecast',
    segmentConfidence: 0.84,
    urgencyScore: 62,
    detectionReasons: [
      SEGMENT_META.forecast.detectionLabel,
      '競合比較の不安が高まっている',
    ],
    highlightKeywords: ['価格', '競合', '条件'],
    resolutionPrediction: {
      probability: 0.68,
      ttrHours: 8,
    },
    quality: {
      level: 'High',
      score: 86,
      signals: ['対応速度 0.75', '資料品質 0.72', 'コミュニケーション 0.68'],
    },
    phaseC: {
      p_resolved_24h: 0.66,
      ttr_pred_min: 540,
      hazard_score: 0.32,
    },
    phaseD: {
      quality_score: 86,
      quality_level: 'High',
    },
    detectionRule: {
      rule_type: 'inactivity_72h',
      hours_since_last_activity: 52,
      score: 50,
    },
  },
  {
    id: 'dummy-alert-003',
    subject: '新規提案への反応が薄い',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.18,
    department: 'エンタープライズ営業',
    customer: 'Future Tech',
    updated_at: getRecentDate(50),
    status: 'in_progress',
    ai_summary: '先月提案した新規プランの検討が進んでおらず、意思決定者からの反応が薄くなっています。',
    emails: [
      {
        id: 'msg-010',
        sender: 'tanaka@cross-m.co.jp',
        recipient: 'kimura@betasoft.co.jp',
        timestamp: '2025-07-08T10:00:00+09:00',
        ai_summary: '先月提案した新規プランについて、検討状況を確認したいと連絡。',
        subject: '新規プラン「Enterprise Plus」のご検討状況について',
        sentiment: 'neutral',
        replyLevel: 0,
        body: `木村様

いつもお世話になっております。Cross-Mの田中です。

先月ご提案させていただいた新規プラン「Enterprise Plus」について、
社内でのご検討状況はいかがでしょうか。

もしご質問やご不明点がございましたら、いつでもお気軽にお知らせください。
追加でご説明が必要でしたら、お打ち合わせの機会を設けることも可能です。

引き続きよろしくお願いいたします。

田中`,
      },
      {
        id: 'msg-012',
        sender: 'kimura@betasoft.co.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-10T11:20:00+09:00',
        ai_summary: '検討が進んでいないことを認め、優先度が下がっていることを示唆。',
        subject: 'Re: 新規プラン「Enterprise Plus」のご検討状況について',
        sentiment: 'negative',
        replyLevel: 1,
        body: `田中様

お世話になっております。BetaSoftの木村です。

ご連絡ありがとうございます。

正直なところ、現時点では社内での優先度が下がっており、
検討が進んでいない状況です。

具体的には以下のような状況です：
- 本四半期の予算が既に他の案件に割り当てられている
- 経営層の関心が他のプロジェクトに移っている
- 導入時期の検討が先送りになっている

時期を見て改めてご相談させていただく可能性はありますが、
現時点では具体的なスケジュールは未定です。

ご理解のほど、よろしくお願いいたします。

木村`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    company: 'Future Tech',
    detection_score: 48,
    phrases: ['提案', '反応', '意思決定'],
    threadId: 'thread-003',
    messageId: 'msg-012',
    sentiment_label: 'negative',
    negative_flag: false,
    primarySegment: 'forecast',
    segmentConfidence: 0.75,
    urgencyScore: 48,
    detectionReasons: [
      SEGMENT_META.forecast.detectionLabel,
      '意思決定者からの反応が途絶えている',
    ],
    highlightKeywords: ['提案', '反応', '検討'],
    resolutionPrediction: {
      probability: 0.45,
      ttrHours: 24,
    },
    quality: {
      level: 'Medium',
      score: 65,
      signals: ['提案力 0.65', '関係構築 0.58'],
    },
    detectionRule: {
      rule_type: 'tone_frequency_drop',
      hours_since_last_activity: 50,
      score: 48,
    },
  },
  {
    id: 'dummy-alert-004',
    subject: '競合比較資料の夜間対応',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.29,
    department: 'ソリューション営業',
    customer: 'Nishi Manufacturing',
    updated_at: getRecentDate(45),
    status: 'in_progress',
    ai_summary: '自社営業側の夜間対応が常態化しており、顧客から対応時間の見直しを求められています。',
    emails: [
      {
        id: 'msg-012',
        sender: 'mori@nishi-mfg.co.jp',
        recipient: 'solutions@cross-m.co.jp',
        timestamp: '2025-07-07T22:30:00+09:00',
        ai_summary: '深夜に競合比較資料を依頼しつつも、昼間対応への切り替えを希望。',
        subject: '競合比較資料の準備について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `お世話になっております。Nishi Manufacturingの森です。

夜分恐れ入ります。

明日（7/8）10時からの経営会議で、貴社と競合A社・B社の比較検討を行うことになりました。
そのため、以下の内容で競合比較資料を至急ご用意いただけますでしょうか。

【ご用意いただきたい内容】
1. 価格比較
   → 初期費用、月額費用、年間総額の比較表

2. 機能比較
   → 主要機能（データ連携、レポート、ユーザー管理など）の比較表

3. 導入実績
   → 同業他社の導入事例（業界、企業規模、導入効果など）

直前のお願いとなり恐縮ですが、次回以降は日中に相談できる体制も併せて検討できればと考えています。

よろしくお願いいたします。

森`,
      },
      {
        id: 'msg-013',
        sender: 'tanaka@cross-m.co.jp',
        recipient: 'mori@nishi-mfg.co.jp',
        timestamp: '2025-07-07T23:10:00+09:00',
        ai_summary: '当夜中のドラフト提供と、翌日の昼帯レビュー体制を約束。',
        subject: 'Re: 競合比較資料の準備について',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `森様

ご連絡ありがとうございます。Cross-Mの田中です。

本日中に競合比較資料のドラフトを「競合比較資料_ドラフト.pdf」としてお送りします。
内容は以下の通りです：
- 価格比較：初期費用、月額費用、年間総額の比較表
- 機能比較：主要機能10項目の比較表
- 導入実績：製造業の導入事例3件

加えて、明日10:00に営業企画の責任者も同席のうえでレビューの時間を確保しました。
資料の確認と、夜間対応から日中帯へ切り替える段取りも併せてご相談させてください。

よろしくお願いいたします。

田中`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    company: 'Nishi Manufacturing',
    detection_score: 58,
    phrases: ['競合比較', '夜間対応', 'レビュー調整'],
    threadId: 'thread-004',
    messageId: 'msg-013',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'forecast',
    segmentConfidence: 0.8,
    urgencyScore: 58,
    detectionReasons: [
      SEGMENT_META.forecast.detectionLabel,
      '夜間稼働の継続が顧客に不安を与えている',
    ],
    highlightKeywords: ['競合', '夜間', 'レビュー'],
    resolutionPrediction: {
      probability: 0.57,
      ttrHours: 10,
    },
    quality: {
      level: 'Medium',
      score: 66,
      signals: ['即応性 0.74', '稼働調整提案 0.6'],
    },
    detectionRule: {
      rule_type: 'night_reply_rate',
      hours_since_last_activity: 45,
      score: 58,
    },
  },
  {
    id: 'dummy-alert-008',
    subject: 'ROI試算の補足要望',
    severity: 'C',
    level: 'medium',
    sentiment_score: -0.22,
    department: '営業企画',
    customer: 'GreenLeaf Farms',
    updated_at: getRecentDate(65),
    status: 'in_progress',
    ai_summary: 'ROI試算の前提条件が伝わっておらず、投資判断への不安が生じています。',
    emails: [
      {
        id: 'msg-019',
        sender: 'info@greenleaf.co.jp',
        recipient: 'salesplanning@cross-m.co.jp',
        timestamp: '2025-07-04T10:25:00+09:00',
        ai_summary: '提示されたROI試算の裏付けデータを確認したいと依頼。',
        subject: 'ROI試算の前提値についてご質問があります',
        sentiment: 'negative',
        replyLevel: 0,
        body: `お世話になっております。GreenLeaf Farmsです。

先日はROI試算をご提供いただき、ありがとうございました。

7月15日（月）に開催予定の経営会議で、このROI試算を説明する予定なのですが、
経営層から「利用定着率65%とアップセル率8%という前提値の根拠は何か」という
質問が出る可能性が高いです。

弊社としては、導入後1年で65%の定着率、2年目で8%のアップセル率という
数値が現実的かどうかを判断する必要があります。

そのため、以下の点についてご教示いただけますでしょうか。

【ご確認事項】
1. 利用定着率65%の根拠データ
   → どのような業界・企業規模の実績データに基づいているか
   → 同業他社の導入事例があれば共有いただけますか

2. アップセル率8%の根拠データ
   → どのような条件で8%のアップセルが発生する想定か
   → 過去の導入事例での実績があれば共有いただけますか

可能であれば、元データまたは仮定の根拠となる資料を
ご共有いただけますと幸いです。

ご多忙のところ恐縮ですが、よろしくお願いいたします。

GreenLeaf Farms`,
      },
      {
        id: 'msg-019b',
        sender: 'tanaka@cross-m.co.jp',
        recipient: 'info@greenleaf.co.jp',
        timestamp: '2025-07-04T10:55:00+09:00',
        ai_summary: '前提値の根拠と、導入後の数値感をまとめた補足資料を共有。',
        subject: 'Re: ROI試算の前提値についてご質問があります',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `お世話になっております。Cross-Mの田中です。

ご質問いただき、ありがとうございます。

ROI試算の前提値について、以下ご説明申し上げます。

【利用定着率65%について】
製造業の同規模企業（従業員数200-500名）3社の過去2年間の実績データの平均値に基づいております。
具体的には：
- A社（製造業、従業員300名）：定着率68%
- B社（製造業、従業員250名）：定着率62%
- C社（製造業、従業員400名）：定着率65%
平均：65%

詳細なデータは添付ファイル「定着率実績データ.xlsx」にまとめておりますので、
ご確認ください。

【アップセル率8%について】
同様に、同業他社3社のアップセル実績の平均値（8.2%）を基準として、
8%と設定しております。詳細データも同ファイルに含まれております。

もし貴社の想定が異なる場合は、前提値を差し替えて再試算することも可能です。
ご希望の前提値がございましたら、お知らせください。

ご不明点がございましたら、お気軽にお声がけください。

田中 太郎
Cross-M株式会社
営業企画部
TEL: 03-9876-5432
Email: tanaka@cross-m.co.jp`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    company: 'GreenLeaf Farms',
    detection_score: 42,
    phrases: ['ROI試算', '前提値', '補足資料'],
    threadId: 'thread-008',
    messageId: 'msg-019b',
    sentiment_label: 'negative',
    negative_flag: false,
    primarySegment: 'forecast',
    segmentConfidence: 0.72,
    urgencyScore: 42,
    detectionReasons: [
      SEGMENT_META.forecast.detectionLabel,
      'ROI試算の前提条件が伝わっておらず、投資判断への不安が生じている',
    ],
    highlightKeywords: ['ROI', '前提', '不安'],
    resolutionPrediction: {
      probability: 0.78,
      ttrHours: 10,
    },
    quality: {
      level: 'Medium',
      score: 68,
      signals: ['データ根拠 0.7', '補足資料 0.66'],
    },
    detectionRule: {
      rule_type: 'night_reply_rate',
      hours_since_last_activity: 65,
      score: 42,
    },
  },
  // 佐藤花子（5件）- occurrence系（発生系）に特化：問題対応・クレーム対応のパターン

  {
    id: 'dummy-alert-016',
    subject: '稟議承認前の競合比較質問',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.25,
    department: 'エンタープライズ営業',
    customer: 'Metro Logistics',
    updated_at: getRecentDate(36),
    status: 'in_progress',
    ai_summary: '競合比較とROI根拠を求められており、稟議での不安が高まっている。',
    emails: [
      {
        id: 'msg-020',
        sender: 'mita@metro-logi.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-07T09:38:00+09:00',
        ai_summary: '競合A/Bとの比較資料とROI根拠データを要請。',
        subject: '競合比較資料とROI算定の根拠について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `田中様

稟議決裁者から、競合A/Bとの比較資料を求められています。
特にROI算定の根拠を数値で示してほしいとの要望が出ました。

今週中に提示できない場合は再検討になるリスクがあります。
データ共有の可否をご教示ください。

三田
Metro Logistics`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    company: 'Metro Logistics',
    detection_score: 64,
    phrases: ['競合比較', 'ROI', '稟議'],
    threadId: 'thread-016',
    messageId: 'msg-020',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'forecast',
    segmentConfidence: 0.81,
    urgencyScore: 60,
    detectionReasons: [
      SEGMENT_META.forecast.detectionLabel,
      '競合比較とROIの不安が高まっている',
    ],
    highlightKeywords: ['競合', 'ROI', '稟議'],
    resolutionPrediction: {
      probability: 0.6,
      ttrHours: 14,
    },
    quality: {
      level: 'Medium',
      score: 65,
      signals: ['データ根拠 0.6', '比較表 0.58'],
    },
    detectionRule: {
      rule_type: 'forecast_trust_risk',
      score: 64,
    },
  },
  {
    id: 'dummy-alert-017',
    subject: '夜間サポートの品質懸念',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.3,
    department: 'カスタマー営業',
    customer: 'Sakura Retail',
    updated_at: getRecentDate(22),
    status: 'unhandled',
    ai_summary: '夜間帯の回答品質に不満があり、エスカレーション基準の見直しを求められている。',
    emails: [
      {
        id: 'msg-021',
        sender: 'support@sakura-retail.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-08T01:05:00+09:00',
        ai_summary: '夜間の回答が曖昧だったため品質基準の徹底を要望。',
        subject: '夜間帯の対応品質について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `田中様

夜間サポートの回答が状況把握に欠けており、お客様対応が難航しました。
エスカレーション基準や夜間担当の品質基準を再整理いただけないでしょうか。

Sakura Retail サポートチーム`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    company: 'Sakura Retail',
    detection_score: 59,
    phrases: ['夜間サポート', '品質', 'エスカレーション'],
    threadId: 'thread-017',
    messageId: 'msg-021',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'forecast',
    segmentConfidence: 0.78,
    urgencyScore: 58,
    detectionReasons: [
      SEGMENT_META.forecast.detectionLabel,
      '夜間対応の品質への懸念が出ている',
    ],
    highlightKeywords: ['夜間', '品質', 'エスカレーション'],
    resolutionPrediction: {
      probability: 0.63,
      ttrHours: 12,
    },
    quality: {
      level: 'Medium',
      score: 62,
      signals: ['夜間対応 0.7', '品質 0.6'],
    },
    detectionRule: {
      rule_type: 'forecast_response_quality',
      score: 59,
    },
  },
  {
    id: 'dummy-alert-005',
    subject: 'PoCレポート提出への強いフォロー',
    severity: 'A',
    level: 'high',
    sentiment_score: -0.44,
    department: 'アカウント営業',
    customer: 'Metro Logistics',
    updated_at: getRecentDate(26),
    status: 'unhandled',
    ai_summary: 'PoC結果レポートの未提出が続き、顧客が正式契約への不安を表明しています。',
    emails: [
      {
        id: 'msg-014',
        sender: 'tanaka@metro-logi.jp',
        recipient: 'sato@cross-m.co.jp',
        timestamp: '2025-07-06T18:00:00+09:00',
        ai_summary: 'PoC結果をまとめたレポートの提出期限を翌日と明示。',
        subject: '【至急】PoC結果レポートの提出期限について（7/7 17:00締切）',
        sentiment: 'negative',
        replyLevel: 0,
        body: `佐藤様

お世話になっております。Metro Logisticsの田中です。

先月6月に実施いただいたPoC（概念実証）の結果レポートについて、
社内での正式契約判断を進めるため、以下の内容でご提出いただけますでしょうか。

【ご提出いただきたい内容】
1. PoC結果のサマリー
   → 実施期間：6/10〜6/30（3週間）
   → 検証項目：データ連携、レポート機能、ユーザー管理
   → 検証結果：達成できた項目・できなかった項目

2. 改善提案
   → PoCで判明した課題（データ連携の遅延など）に対する改善案
   → 正式導入時の推奨事項・注意点

【提出期限】
7月7日（月）17:00まで

実は、翌日7月8日（火）の経営会議で正式契約の可否を判断することになっており、
それまでにレポートを社内でレビューする必要があります。

もし期限に間に合わない場合は、遅延理由とリカバリープランを併せてご教示いただけますと幸いです。

ご多忙のところ恐縮ですが、よろしくお願いいたします。

田中`,
      },
      {
        id: 'msg-015',
        sender: 'sato@cross-m.co.jp',
        recipient: 'tanaka@metro-logi.jp',
        timestamp: '2025-07-06T21:10:00+09:00',
        ai_summary: '速報版を謝罪とともに共有し、提出までの段取りを説明。',
        subject: 'Re: 【至急】PoC結果レポートの提出期限について（7/7 17:00締切）',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `田中様

お世話になっております。Cross-Mの佐藤です。

ご催促いただき、大変恐縮でございます。

まず、PoC結果の速報版サマリーを添付しました。
主要な検証結果は以下の通りです：
- データ連携：正常動作（平均レスポンス2.3秒）
- レポート機能：一部改善が必要（集計処理が遅い）
- ユーザー管理：正常動作

正式版レポート（改善提案付き）につきましては、
改善提案の章を追加で作成する必要があり、明日7月7日（月）10:00までに
ご送付させていただく予定です。

失注リスクとなっている点は社内でも共有済みで、本日夜中に
営業企画部と技術部でレビュー体制を整え、正式版の完成に向けて
作業を進めております。

ご不便をおかけして申し訳ございませんが、よろしくお願いいたします。

佐藤`,
      },
    ],
    assignee: 'sato@cross-m.co.jp',
    company: 'Metro Logistics',
    detection_score: 76,
    phrases: ['PoCレポート', '提出期限', '正式契約'],
    threadId: 'thread-005',
    messageId: 'msg-014',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'occurrence',
    segmentConfidence: 0.9,
    urgencyScore: 76,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '明日17時が経営会議の締め切りとして明確に示されており、強い催促が入っている',
    ],
    highlightKeywords: ['PoC', '提出期限', '正式契約'],
    resolutionPrediction: {
      probability: 0.44,
      ttrHours: 20,
    },
    quality: {
      level: 'Low',
      score: 52,
      signals: ['提出遅延 0.2', '情報整理 0.4'],
    },
    detectionRule: {
      rule_type: 'inactivity_72h',
      hours_since_last_activity: 26,
      score: 76,
    },
  },
  {
    id: 'dummy-alert-007',
    subject: '拡張ユーザー契約の未回答',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.37,
    department: 'カスタマー営業',
    customer: 'NorthWind Consulting',
    updated_at: getRecentDate(55),
    status: 'in_progress',
    ai_summary: '提案した追加ユーザー契約について返信が遅れており、顧客から催促が入りました。',
    emails: [
      {
        id: 'msg-017',
        sender: 'yamada@northwind.co.jp',
        recipient: 'growth@cross-m.co.jp',
        timestamp: '2025-07-05T13:50:00+09:00',
        ai_summary: '拡張ユーザー契約の見積回答が滞っている点を指摘。',
        subject: '追加ユーザー契約について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `お世話になっております。NorthWind Consultingの山田です。

拡張ユーザー契約の件、先週いただいた概算見積のままで社内検討が止まっています。
初期費用と月額費の内訳、年度契約時の割引条件を整理してご提示いただけますか。

先方の財務部から催促されています。

よろしくお願いいたします。

山田
NorthWind Consulting株式会社`,
      },
      {
        id: 'msg-018',
        sender: 'sato@cross-m.co.jp',
        recipient: 'yamada@northwind.co.jp',
        timestamp: '2025-07-06T09:40:00+09:00',
        ai_summary: '遅延を謝罪し、当日中の詳細提示とフォローMTGを約束。',
        subject: 'Re: 追加ユーザー契約について',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `山田様

ご迷惑をお掛けして申し訳ございません。Cross-Mの佐藤です。

内訳の整理が遅れておりました。
本日12時までに初期費用・月額費・オプションの詳細をまとめて共有いたします。

14時から15分ほどフォローのお時間をいただけますでしょうか。

よろしくお願いいたします。

佐藤
Cross-M株式会社`,
      },
    ],
    assignee: 'sato@cross-m.co.jp',
    company: 'NorthWind Consulting',
    detection_score: 61,
    phrases: ['追加契約', '見積内訳', '検討停滞'],
    threadId: 'thread-007',
    messageId: 'msg-017',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'occurrence',
    segmentConfidence: 0.76,
    urgencyScore: 61,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '返信が止まり検討が停滞している',
    ],
    highlightKeywords: ['追加契約', '見積', '停滞'],
    resolutionPrediction: {
      probability: 0.48,
      ttrHours: 18,
    },
    quality: {
      level: 'Medium',
      score: 60,
      signals: ['回答スピード 0.4', '内訳提示 0.6'],
    },
    detectionRule: {
      rule_type: 'inactivity_72h',
      hours_since_last_activity: 55,
      score: 61,
    },
  },
  {
    id: 'dummy-alert-010',
    subject: '契約書レビュー期限の催促',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.33,
    department: '法務アライアンス',
    customer: 'Sakura Retail',
    updated_at: getRecentDate(42),
    status: 'in_progress',
    ai_summary: '自社営業側の契約書修正案提出が遅れており、顧客から締切の再共有がありました。',
    emails: [
      {
        id: 'msg-022',
        sender: 'ishikawa@sakura-retail.jp',
        recipient: 'legal@cross-m.co.jp',
        timestamp: '2025-07-02T16:40:00+09:00',
        ai_summary: '契約書ドラフトの修正期限を明確化し、追加条項の説明を依頼。',
        subject: '【緊急】契約書修正案のご提出について（7/3 18:00締切）',
        sentiment: 'negative',
        replyLevel: 0,
        body: `お世話になっております。Sakura Retailの石川です。

先週ご依頼した契約書の修正案について、まだ届いておりません。

実は、明日（7/3）10時から法務部による社内レビューが予定されており、
その前に修正案を確認する必要があります。

【提出期限】
7月3日（水）18:00まで

もしこの時間までに最新版を受領できない場合、
社内レビューのスケジュールが遅延し、契約締結のタイミングに影響が出る可能性があります。

また、追加予定のデータ共有条項についても、以下の点を明記いただけると助かります。

【データ共有条項について】
- 条項を追加する背景・理由
- 適用範囲（どのデータが対象となるか）
- 責任分界点（どこまでが弊社責任か）

ご多忙のところ恐縮ですが、よろしくお願いいたします。

石川`,
      },
      {
        id: 'msg-023',
        sender: 'sato@cross-m.co.jp',
        recipient: 'ishikawa@sakura-retail.jp',
        timestamp: '2025-07-02T17:10:00+09:00',
        ai_summary: '修正案を共有し、データ共有条項の背景資料を添付。',
        subject: 'Re: 【緊急】契約書修正案のご提出について（7/3 18:00締切）',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `石川様

お世話になっております。Cross-Mの佐藤です。

お待たせしてしまい、申し訳ございませんでした。

契約書の修正案を添付いたします。
ご指摘いただいた点を反映し、以下の修正を行いました。

【主な修正内容】
1. データ共有条項の追加
   → 先月実施したセキュリティ監査で求められた要件に対応するため、
      データ共有に関する条項を第8条として追記しました

2. 適用範囲と責任分界点の明記
   → データ共有条項の適用範囲と責任分界点をまとめた説明資料も同封しました

ご確認のうえ、ご不明点やご質問がございましたらお気軽にお声がけください。

佐藤`,
      },
    ],
    assignee: 'sato@cross-m.co.jp',
    company: 'Sakura Retail',
    detection_score: 57,
    phrases: ['契約書', '修正案', 'データ共有'],
    threadId: 'thread-010',
    messageId: 'msg-023',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'occurrence',
    segmentConfidence: 0.85,
    urgencyScore: 57,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '契約書修正案の提出期限が明確に示されている',
    ],
    highlightKeywords: ['修正案', '締切', '条項説明'],
    resolutionPrediction: {
      probability: 0.67,
      ttrHours: 9,
    },
    quality: {
      level: 'Medium',
      score: 72,
      signals: ['修正スピード 0.7', '条項説明 0.65'],
    },
    detectionRule: {
      rule_type: 'sentiment_urgency',
      hours_since_last_activity: 42,
      score: 57,
    },
  },
  {
    id: 'dummy-alert-011',
    subject: '契約書レビュー期限の催促へのフォロー',
    severity: 'C',
    level: 'low',
    sentiment_score: 0.15,
    department: '法務アライアンス',
    customer: 'Sakura Retail',
    updated_at: getRecentDate(55),
    status: 'in_progress',
    ai_summary: '契約書レビュー期限の催促トラブル後、顧客の状況を確認するフォローメールを送信。',
    emails: [
      {
        id: 'msg-024b',
        sender: 'sato@cross-m.co.jp',
        recipient: 'ishikawa@sakura-retail.jp',
        timestamp: '2025-07-03T09:05:00+09:00',
        ai_summary: '催促トラブル後のフォローメール。顧客の状況を確認。',
        subject: 'Re: 契約書レビュー期限について',
    sentiment: 'positive',
    replyLevel: 1,
        body: `石川様

お世話になっております。Cross-Mの佐藤です。

先日は失礼いたしました。その後貴社内のご状況いかがでしょうか。

契約書レビュー期限の件でご不便をおかけし、申し訳ございませんでした。
修正案をお送りした後、社内でのご検討状況はいかがでしょうか。

何かご不明点やご要望がございましたら、お気軽にお声がけください。

よろしくお願いいたします。

佐藤`,
      },
    ],
    assignee: 'sato@cross-m.co.jp',
    company: 'Sakura Retail',
    detection_score: 44,
    phrases: ['フォロー', '状況確認', 'ご不便'],
    threadId: 'thread-010-followup',
    messageId: 'msg-024b',
    sentiment_label: 'positive',
    negative_flag: false,
    primarySegment: 'follow',
    segmentConfidence: 0.72,
    urgencyScore: 38,
    detectionReasons: [
      SEGMENT_META.follow.detectionLabel,
      '催促トラブル後のフォロー。顧客の状況を確認している',
    ],
    highlightKeywords: ['フォロー', '状況確認', '失礼'],
    resolutionPrediction: {
      probability: 0.84,
      ttrHours: 10,
    },
    quality: {
      level: 'High',
      score: 84,
      signals: ['信頼回復 0.81', 'フォロー体制 0.79'],
    },
    detectionRule: {
      rule_type: 'recovery_monitoring',
      hours_since_last_activity: 55,
      score: 44,
    },
  },
  {
    id: 'dummy-alert-204',
    subject: 'North Data案件：72h遅延後のフォロー確認',
    severity: 'C',
    level: 'low',
    sentiment_score: 0.05,
    department: 'エンタープライズ営業',
    customer: 'North Data',
    updated_at: getRecentDate(1),
    status: 'in_progress',
    ai_summary: '72時間遅延トラブルを経て、謝罪と補足資料送付後のフォロー状況を確認しています。',
    emails: [
      {
        id: 'msg-north-01',
        sender: 'exec@northdata.co.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-12T14:20:00+09:00',
        ai_summary: '資料提出が72時間以上遅延していることを指摘し、緊急対応を要求。',
        subject: '【緊急】資料提出の遅延について（72時間超過）',
        sentiment: 'negative',
        replyLevel: 0,
        body: `田中様

お世話になっております。North Dataのエグゼクティブチームです。

先週月曜（7/8）までにご提出いただく予定だった資料が、本日（7/12）時点でまだ届いておりません。
既に72時間以上が経過しており、社内のプロジェクト進行に大きな影響が出ています。

【遅延している資料】
- ROI試算書
- 導入スケジュール詳細版
- リスク評価資料

この遅延により、弊社の役員レビューが先送りとなり、プロジェクト全体のスケジュールに影響が出る可能性があります。

至急、以下の点についてご回答いただけますでしょうか。
1. 遅延の理由
2. 提出可能な具体的な日時
3. リカバリープラン

本日17時までにご回答いただけますと助かります。

North Data
エグゼクティブチーム`,
      },
      {
        id: 'msg-north-02',
        sender: 'tanaka@cross-m.co.jp',
        recipient: 'exec@northdata.co.jp',
        timestamp: '2025-07-15T09:40:00+09:00',
        ai_summary: '遅延対応の謝罪と補足資料の送付完了を報告し、状況確認を依頼。',
        subject: 'Re: 【緊急】資料提出の遅延について（72時間超過）',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `North Data
エグゼクティブ各位

先日の資料遅延につきまして、重ねてお詫び申し上げます。
本日朝、補足のROI試算とリカバリープランを共有いたしました。

ご確認後、追加で必要な情報やご懸念点がございましたらご遠慮なくお知らせください。
今回のタイムラインを教訓に、毎朝の進捗共有を徹底いたします。

田中
Cross-M株式会社`,
      },
      {
        id: 'msg-north-03',
        sender: 'exec@northdata.co.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-15T11:55:00+09:00',
        ai_summary: '補足資料の受領を確認し、翌日の役員レビューまでにFAQをまとめてほしいと依頼。',
        subject: 'Re: 【緊急】資料提出の遅延について（72時間超過）',
        sentiment: 'neutral',
        replyLevel: 2,
        body: `田中様

ご対応ありがとうございました。補足資料は問題なく受領いたしました。
明日の役員レビューまでに、想定FAQをまとめた1枚資料をご共有いただけますと助かります。

引き続きよろしくお願いいたします。

North Data`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    detection_score: 48,
    phrases: ['フォロー', '補足資料', 'リカバリープラン'],
    sentiment_label: 'neutral',
    primarySegment: 'follow',
    segmentConfidence: 0.74,
    urgencyScore: 40,
    detectionReasons: [
      SEGMENT_META.follow.detectionLabel,
      '72h遅延後のリカバリープラン共有とフォロー中',
    ],
    highlightKeywords: ['フォロー', '補足資料', 'FAQ'],
    resolutionPrediction: {
      probability: 0.81,
      ttrHours: 12,
    },
    quality: {
      level: 'High',
      score: 88,
      signals: ['謝罪品質 0.82', 'リカバリープラン 0.79'],
    },
    detectionRule: {
      rule_type: 'recovery_monitoring',
      hours_since_last_activity: 4,
      score: 48,
    },
    threadId: 'thread-north-delay',
    messageId: 'msg-north-01',
  },
  {
    id: 'dummy-alert-015',
    subject: '四半期成果レポートの提出催促',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.28,
    department: 'カスタマーサクセス営業',
    customer: 'Prime Foods',
    updated_at: getRecentDate(47),
    status: 'in_progress',
    ai_summary: '四半期成果レポートの提出が遅れ、経営報告向けの資料準備が滞っています。',
    emails: [
      {
        id: 'msg-030',
        sender: 'planning@primefoods.co.jp',
        recipient: 'sato@cross-m.co.jp',
        timestamp: '2025-06-27T15:05:00+09:00',
        ai_summary: '経営報告前にレポートドラフトを催促。',
        subject: '【至急】Q2四半期成果レポートのご提出について（7/8 経営報告使用）',
        sentiment: 'negative',
        replyLevel: 0,
        body: `佐藤様

お世話になっております。Prime Foodsです。

7月8日（月）10時から開催予定の経営報告会で、Q2（4-6月）の四半期成果レポートを
使用したいのですが、ドラフト版がまだ届いておりません。

【提出期限】
本日7月7日（日）中にご共有いただけますと助かります。

【レポートに含めていただきたい要点】
1. ROI（投資対効果）
   → Q2のROI率：具体的な数値（例：ROI 180%など）
   → 前四半期（Q1）との比較：Q1はROI 150%でした
   → 投資回収期間：何ヶ月で回収できたか

2. サクセス施策
   → 実施した施策：新機能の導入、ユーザー研修など
   → その成果：ユーザー利用率の向上、問い合わせ件数の減少など

3. 改善項目
   → 課題：レスポンス時間の遅延、一部機能の使いづらさなど
   → 今後の改善計画：Q3での対応予定

ご多忙のところ恐縮ですが、よろしくお願いいたします。

Prime Foods`,
      },
      {
        id: 'msg-031',
        sender: 'sato@cross-m.co.jp',
        recipient: 'planning@primefoods.co.jp',
        timestamp: '2025-06-27T15:30:00+09:00',
        ai_summary: '速報版レポートを共有し、最終版納品の時間を約束。',
        subject: 'Re: 【至急】Q2四半期成果レポートのご提出について（7/8 経営報告使用）',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `お世話になっております。Cross-Mの佐藤です。

ご依頼いただいたQ2四半期成果レポートの速報版を添付いたします。

【速報版に含まれている内容】
1. KPIサマリー
   → 主要指標の達成状況：
     - ユーザー利用率：85%（前四半期：72%）
     - 問い合わせ件数：月平均15件（前四半期：月平均25件）
     - システム稼働率：99.8%（前四半期：99.5%）

2. ボイスオブカスタマー
   → 顧客満足度：4.2/5.0（前四半期：3.8/5.0）
   → 主なフィードバック：「レスポンスが早くなった」「使いやすくなった」

最終版レポートは、明日7月8日（月）9:00までに
ご送付させていただく予定です。

もし速報版で気になる点や修正依頼がございましたら、
本日18:00までにご連絡いただければ、最終版に反映いたします。

ご確認のほど、よろしくお願いいたします。

佐藤`,
      },
    ],
    assignee: 'sato@cross-m.co.jp',
    company: 'Prime Foods',
    detection_score: 53,
    phrases: ['成果レポート', '経営報告', '速報版'],
    threadId: 'thread-015',
    messageId: 'msg-031',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'occurrence',
    segmentConfidence: 0.80,
    urgencyScore: 53,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '四半期成果レポートの提出が遅れており、経営報告前の催促が入っている',
    ],
    highlightKeywords: ['速報版', '経営報告', 'ドラフト'],
    resolutionPrediction: {
      probability: 0.69,
      ttrHours: 18,
    },
    quality: {
      level: 'Medium',
      score: 71,
      signals: ['レポート構成 0.68', '納期配慮 0.7'],
    },
    detectionRule: {
      rule_type: 'inactivity_72h',
      hours_since_last_activity: 47,
      score: 53,
    },
  },
  // 鈴木一郎（5件）
  {
    id: 'dummy-alert-002',
    subject: '大型プラン追加の稟議支援',
    severity: 'A',
    level: 'high',
    sentiment_score: -0.52,
    department: 'エンタープライズ営業',
    customer: 'VIP Client Inc.',
    updated_at: getRecentDate(28),
    status: 'in_progress',
    ai_summary: '大型拡張の稟議資料ドラフトを当日中に求められており、担当役員が強くフォローを期待しています。',
    emails: expansionThread,
    assignee: 'suzuki@cross-m.co.jp',
    company: 'VIP Client Inc.',
    detection_score: 82,
    phrases: ['稟議', 'ROI試算', '導入スケジュール'],
    threadId: 'thread-002',
    messageId: 'msg-006',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'occurrence',
    segmentConfidence: 0.88,
    urgencyScore: 82,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '週内の稟議通過が条件となっており、本日18時までの資料共有を要求',
    ],
    highlightKeywords: ['稟議フォーマット', 'ROI', '導入計画'],
    resolutionPrediction: {
      probability: 0.41,
      ttrHours: 16,
    },
    quality: {
      level: 'Medium',
      score: 64,
      signals: ['提案スピード 0.6', '稟議支援 0.58', '事例共有 0.5'],
    },
    phaseC: {
      p_resolved_24h: 0.32,
      ttr_pred_min: 780,
      hazard_score: 0.78,
    },
    phaseD: {
      quality_score: 58,
      quality_level: 'Medium',
    },
    detectionRule: {
      rule_type: 'sentiment_urgency',
      hours_since_last_activity: 28,
      score: 82,
    },
  },
  {
    id: 'dummy-alert-009',
    subject: '導入スケジュール見直しの夜間要請',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.27,
    department: 'プロジェクト営業',
    customer: 'Delta Finance',
    updated_at: getRecentDate(35),
    status: 'completed',
    ai_summary: '深夜帯の導入ミーティングが続き、日中帯への切り替え要請が届きました。',
    emails: [
      {
        id: 'msg-020',
        sender: 'kato@delta-finance.jp',
        recipient: 'suzuki@cross-m.co.jp',
        timestamp: '2025-07-03T21:00:00+09:00',
        ai_summary: '夜間ミーティングの継続に対し、日中へのリスケを希望。',
        subject: '導入定例ミーティングの時間変更のお願い（毎週水曜21:00→日中帯希望）',
        sentiment: 'negative',
        replyLevel: 0,
        body: `鈴木様

お世話になっております。Delta Financeの加藤です。

現在、毎週水曜日の21:00から実施している導入定例ミーティングについて、
社内メンバーから負担が大きいという声が上がっております。

具体的には、以下のような課題があります：
- 夜間のミーティングが続き、社員のワークライフバランスに影響が出ている
- 翌日の業務に支障が出るケースがある
- 一部メンバー（特に女性メンバー）が参加できない状況が発生している

現在の導入状況は順調に進んでいますが（進捗率75%）、
ミーティング時間の見直しが必要だと判断しました。

つきましては、次回以降のミーティングを日中帯（平日9:00〜18:00の間）に
変更していただけないでしょうか。

社内でスケジュール調整を進めたいため、可能であれば
候補時間をいくつかご提示いただけますと幸いです。
（例：毎週水曜 10:00〜11:00、毎週水曜 14:00〜15:00など）

ご検討のほど、よろしくお願いいたします。

加藤`,
      },
      {
        id: 'msg-021',
        sender: 'suzuki@cross-m.co.jp',
        recipient: 'kato@delta-finance.jp',
        timestamp: '2025-07-03T21:40:00+09:00',
        ai_summary: '翌週以降の午前帯へ変更し、再招待を約束。',
        subject: 'Re: 導入定例ミーティングの時間変更のお願い（毎週水曜21:00→日中帯希望）',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `加藤様

お世話になっております。Cross-M株式会社の鈴木です。

ご負担をお掛けしており、大変申し訳ございませんでした。

ご要望の通り、次回以降の導入定例ミーティングを
毎週水曜日の10:00〜11:00に変更させていただきます。

【変更内容】
- 変更前：毎週水曜 21:00〜22:00
- 変更後：毎週水曜 10:00〜11:00

調整したスケジュールと新しいZoom招待リンクを
「導入定例ミーティング_スケジュール変更.pdf」として
添付いたしますので、ご確認ください。

また、これまでの夜間帯の議事録も併せて共有いたします。
過去の議事録は共有フォルダにアップロードしておりますので、
必要に応じてご確認ください。

ご対応のほど、よろしくお願いいたします。

鈴木 一郎
Cross-M株式会社
プロジェクト営業部
TEL: 03-9876-5432
Email: suzuki@cross-m.co.jp`,
      },
    ],
    assignee: 'suzuki@cross-m.co.jp',
    company: 'Delta Finance',
    detection_score: 39,
    phrases: ['導入ミーティング', '夜間対応', 'スケジュール変更'],
    threadId: 'thread-009',
    messageId: 'msg-021',
    sentiment_label: 'negative',
    negative_flag: false,
    primarySegment: 'occurrence',
    segmentConfidence: 0.72,
    urgencyScore: 39,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '深夜帯の導入ミーティングが続き、顧客からの返信が止まっている',
    ],
    highlightKeywords: ['ミーティング', '夜間', 'リスケ'],
    resolutionPrediction: {
      probability: 0.85,
      ttrHours: 4,
    },
    quality: {
      level: 'High',
      score: 88,
      signals: ['迅速対応 0.9', '負担配慮 0.86'],
    },
    detectionRule: {
      rule_type: 'night_reply_rate',
      hours_since_last_activity: 35,
      score: 39,
    },
  },
  {
    id: 'dummy-alert-012',
    subject: '年度予算取り込みの停滞',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.34,
    department: 'エンタープライズ営業',
    customer: 'Helios Systems',
    updated_at: getRecentDate(51),
    status: 'in_progress',
    ai_summary: '自社営業側の正式見積提出が遅延し、顧客の年度予算取り込みの稟議が止まっています。',
    emails: [
      {
        id: 'msg-026',
        sender: 'accounting@helios.co.jp',
        recipient: 'suzuki@cross-m.co.jp',
        timestamp: '2025-06-30T16:15:00+09:00',
        ai_summary: '年度予算に組み込むための正式見積の再送を依頼。',
        subject: '年度予算取り込みの見積について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `鈴木様

お世話になっております。Helios Systemsです。

年度予算の締切が迫っております。
弊社指定フォーマットに沿った正式見積を本日中に再送いただけますか。

金額のブレがあると稟議がやり直しになるため、ご確認のうえご対応いただけると助かります。

よろしくお願いいたします。

Helios Systems`,
      },
      {
        id: 'msg-027',
        sender: 'suzuki@cross-m.co.jp',
        recipient: 'accounting@helios.co.jp',
        timestamp: '2025-06-30T19:05:00+09:00',
        ai_summary: '遅延理由を説明し、夜間対応での提出を約束。',
        subject: 'Re: 年度予算取り込みの見積について',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `お世話になっております。Cross-Mの鈴木です。

回答が遅くなり申し訳ございません。
社内で価格調整の承認が難航しており、本日19時に最終承認が下りる予定です。

承認後すぐにフォーマットへ転記し、21時までに正式版をお送りします。

よろしくお願いいたします。

鈴木
Cross-M株式会社`,
      },
    ],
    assignee: 'suzuki@cross-m.co.jp',
    company: 'Helios Systems',
    detection_score: 65,
    phrases: ['年度予算', '正式見積', '稟議'],
    threadId: 'thread-012',
    messageId: 'msg-026',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'occurrence',
    segmentConfidence: 0.85,
    urgencyScore: 65,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '年度予算締切直前まで提出が遅延',
    ],
    highlightKeywords: ['予算', '見積', '締切'],
    resolutionPrediction: {
      probability: 0.52,
      ttrHours: 14,
    },
    quality: {
      level: 'Low',
      score: 55,
      signals: ['フォーマット適合 0.3', '進捗共有 0.4'],
    },
    detectionRule: {
      rule_type: 'inactivity_72h',
      hours_since_last_activity: 51,
      score: 65,
    },
  },
  {
    id: 'dummy-alert-014',
    subject: '提案プレゼンリハの深夜対応',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.36,
    department: 'プリセールス',
    customer: 'EastWorks Agency',
    updated_at: getRecentDate(38),
    status: 'in_progress',
    ai_summary: '自社営業側のプレゼンリハーサルが深夜に偏っており、顧客からタイムマネジメントへの不安が出ています。',
    emails: [
      {
        id: 'msg-028',
        sender: 'project@eastworks.jp',
        recipient: 'suzuki@cross-m.co.jp',
        timestamp: '2025-06-28T00:40:00+09:00',
        ai_summary: '深夜帯でのリハーサルに疲弊しており、日中レビューへの切り替えを要請。',
        subject: 'リハーサル時間について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `鈴木様

お世話になっております。EastWorks Agencyです。

直前リハが毎回深夜に及んでおり、社内のクリエイティブチームも疲弊しています。
日中の時間帯へ切り替えられないでしょうか。

資料の手直しも翌朝にまとめて行いたいです。

よろしくお願いいたします。

EastWorks Agency`,
      },
      {
        id: 'msg-029',
        sender: 'suzuki@cross-m.co.jp',
        recipient: 'project@eastworks.jp',
        timestamp: '2025-06-28T01:10:00+09:00',
        ai_summary: '翌週から午前帯リハへ変更し、当日資料のチェックリストを共有。',
        subject: 'Re: リハーサル時間について',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `お世話になっております。Cross-Mの鈴木です。

ご負担をお掛けしており申し訳ありません。
来週からは午前10:00開始とし、夜間作業は原則行わない運用に変更します。

資料チェックリストを添付しましたので、明日の午前までに反映事項をご連絡ください。

よろしくお願いいたします。

鈴木
Cross-M株式会社`,
      },
    ],
    assignee: 'suzuki@cross-m.co.jp',
    company: 'EastWorks Agency',
    detection_score: 63,
    phrases: ['リハーサル', '深夜対応', 'チェックリスト'],
    threadId: 'thread-014',
    messageId: 'msg-029',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'occurrence',
    segmentConfidence: 0.81,
    urgencyScore: 63,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '大型提案前の深夜リハが常態化',
    ],
    highlightKeywords: ['リハーサル', '午前帯', 'チェックリスト'],
    resolutionPrediction: {
      probability: 0.53,
      ttrHours: 9,
    },
    quality: {
      level: 'Medium',
      score: 67,
      signals: ['提案準備 0.68', '調整力 0.62'],
    },
    detectionRule: {
      rule_type: 'tone_frequency_drop',
      hours_since_last_activity: 38,
      score: 63,
    },
  },
  {
    id: 'dummy-alert-021',
    subject: '見積依頼への未回答',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.18,
    department: '営業部',
    customer: 'Innovation Corp',
    updated_at: getRecentDate(68),
    status: 'unhandled',
    ai_summary: '自社営業側が顧客からの見積依頼メールに返信せず放置している状態。機会損失のリスクが高い。',
    emails: [
      {
        id: 'msg-053',
        sender: 'tanaka@innovation-corp.co.jp',
        recipient: 'suzuki@cross-m.co.jp',
        timestamp: '2025-07-03T09:00:00+09:00',
        ai_summary: '新規プランの見積依頼。',
        subject: '新規プランの見積について',
        sentiment: 'neutral',
        replyLevel: 0,
        body: `鈴木様

お世話になっております。Innovation Corpの田中です。

先日ご紹介いただいた新規プランについて、見積をお願いしたいです。
以下の条件でお見積いただけますでしょうか。

【条件】
- ユーザー数: 50名
- 契約期間: 1年間
- 希望開始時期: 2025年8月

ご都合がよろしければ、来週中にご回答いただけますと幸いです。

よろしくお願いいたします。

田中
Innovation Corp株式会社`,
      },
      {
        id: 'msg-054',
        sender: 'tanaka@innovation-corp.co.jp',
        recipient: 'suzuki@cross-m.co.jp',
        timestamp: '2025-07-05T14:30:00+09:00',
        ai_summary: '見積依頼への返信がないため、リマインドを送信。',
        subject: 'Re: 新規プランの見積について',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `鈴木様

お世話になっております。Innovation Corpの田中です。

先日お送りした見積依頼について、ご確認いただけましたでしょうか。
社内での検討を進めたいため、お見積のご回答をお待ちしております。

ご都合がよろしければ、今週中にご回答いただけますと幸いです。

よろしくお願いいたします。

田中
Innovation Corp株式会社`,
      },
    ],
    assignee: 'suzuki@cross-m.co.jp',
    company: 'Innovation Corp',
    detection_score: 58,
    phrases: ['見積依頼', '未回答', 'リマインド'],
    threadId: 'thread-021',
    messageId: 'msg-054',
    sentiment_label: 'neutral',
    negative_flag: false,
    primarySegment: 'occurrence',
    segmentConfidence: 0.85,
    urgencyScore: 58,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '見積依頼への返信がなく、顧客からリマインドが来ている',
    ],
    highlightKeywords: ['見積依頼', '未回答', 'リマインド', '機会損失'],
    resolutionPrediction: {
      probability: 0.52,
      ttrHours: 6,
    },
    quality: {
      level: 'Low',
      score: 45,
      signals: ['初動遅延 0.3', '機会損失リスク 0.4'],
    },
    phaseC: {
      p_resolved_24h: 0.52,
      ttr_pred_min: 360,
      hazard_score: 0.48,
    },
    phaseD: {
      quality_score: 45,
      quality_level: 'Low',
    },
    detectionRule: {
      rule_type: 'inactivity_72h',
      hours_since_last_activity: 68,
      score: 58,
    },
  },
  {
    id: 'dummy-alert-022',
    subject: '顧客からの問い合わせへの未返信',
    severity: 'C',
    level: 'medium',
    sentiment_score: -0.15,
    department: 'エンタープライズ営業',
    customer: 'TechStart Solutions',
    updated_at: getRecentDate(75),
    status: 'unhandled',
    ai_summary: '顧客から問い合わせメールが来ているが、自社営業側が75時間以上返信しておらず、放置状態が続いています。自社営業側の対応不足により、ボールが宙に浮いている状態です。',
    emails: [
      {
        id: 'msg-055',
        sender: 'yamada@techstart.co.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-01T14:00:00+09:00',
        ai_summary: '新規プランについての問い合わせを送信したが、自社営業側からの返信がない。',
        subject: '新規プランについてのご質問',
        sentiment: 'neutral',
        replyLevel: 0,
        body: `田中様

お世話になっております。TechStart Solutionsの山田です。

先日お話しさせていただいた新規プランについて、いくつかご質問があります。

1. 導入スケジュールの詳細について
2. 初期費用と月額費用の内訳について
3. 既存システムとの連携について

ご都合がよろしければ、来週中にご回答いただけますと幸いです。
よろしくお願いいたします。

山田
TechStart Solutions株式会社`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    company: 'TechStart Solutions',
    detection_score: 45,
    phrases: ['問い合わせ', '未返信', '放置'],
    threadId: 'thread-022',
    messageId: 'msg-055',
    sentiment_label: 'neutral',
    negative_flag: false,
    primarySegment: 'forecast',
    segmentConfidence: 0.78,
    urgencyScore: 45,
    detectionReasons: [
      SEGMENT_META.forecast.detectionLabel,
      '顧客からの問い合わせに対して、自社営業側が75時間以上返信しておらず、ボールが宙に浮いている状態',
    ],
    highlightKeywords: ['問い合わせ', '未返信', '放置'],
    resolutionPrediction: {
      probability: 0.35,
      ttrHours: 48,
    },
    quality: {
      level: 'Medium',
      score: 58,
      signals: ['提案資料送付 0.6', 'フォロー不足 0.4', '自社営業起因の放置リスク 0.5'],
    },
    phaseC: {
      p_resolved_24h: 0.35,
      ttr_pred_min: 2880,
      hazard_score: 0.25,
    },
    phaseD: {
      quality_score: 58,
      quality_level: 'Medium',
    },
    detectionRule: {
      rule_type: 'inactivity_72h',
      hours_since_last_activity: 75,
      score: 45,
    },
  },
  // 情報共有ミス - occurrence_info_gap
  {
    id: 'dummy-alert-023',
    subject: '契約条項の確認不足による指摘',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.35,
    department: 'カスタマー営業',
    customer: 'Tech Solutions Inc.',
    updated_at: getRecentDate(30),
    status: 'in_progress',
    ai_summary: '自社営業側の契約条項の説明不足が指摘され、資料の再共有を求められています。',
    emails: [
      {
        id: 'msg-023-001',
        sender: 'yamada@tech-solutions.co.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-11T14:00:00+09:00',
        ai_summary: '契約条項の確認不足を指摘し、詳細資料の再共有を要望。',
        subject: '契約条項についての確認',
        sentiment: 'negative',
        replyLevel: 0,
        body: `田中様

お世話になっております。Tech Solutions Inc.の山田です。

先日ご共有いただいた契約案について、いくつか確認させていただきたい点があります。

特に以下の点について、詳細な説明資料を改めてご共有いただけますでしょうか：
1. 解約条項の具体的な条件
2. データ保持期間の詳細
3. セキュリティ要件の具体的な基準

これらの情報が不足していたため、社内での検討が進んでいない状況です。
お忙しいところ恐縮ですが、よろしくお願いいたします。

山田
Tech Solutions Inc.`,
      },
      {
        id: 'msg-023-002',
        sender: 'tanaka@cross-m.co.jp',
        recipient: 'yamada@tech-solutions.co.jp',
        timestamp: '2025-07-11T15:30:00+09:00',
        ai_summary: '不足していた情報を謝罪し、詳細資料を即座に提供。',
        subject: 'Re: 契約条項についての確認',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `山田様

ご連絡ありがとうございます。Cross-Mの田中です。

ご指摘の点、申し訳ございませんでした。
詳細資料を添付いたしますので、ご確認ください。

ご不明点がございましたら、いつでもお気軽にお知らせください。

田中
Cross-M株式会社`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    company: 'Tech Solutions Inc.',
    detection_score: 55,
    phrases: ['契約条項', '確認不足', '資料再共有'],
    threadId: 'thread-023',
    messageId: 'msg-023-001',
    sentiment_label: 'negative',
    negative_flag: false,
    primarySegment: 'occurrence',
    segmentConfidence: 0.82,
    urgencyScore: 55,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '自社営業側の契約条項の説明不足が指摘され、情報共有不足が発生している',
    ],
    highlightKeywords: ['契約', '条項', '確認'],
    resolutionPrediction: {
      probability: 0.72,
      ttrHours: 4,
    },
    quality: {
      level: 'Medium',
      score: 70,
      signals: ['情報共有 0.70', '対応速度 0.75'],
    },
    detectionRule: {
      rule_type: 'sentiment_urgency',
      hours_since_last_activity: 30,
      score: 55,
    },
  },
  // 遅延 - occurrence_delay
  {
    id: 'dummy-alert-024',
    subject: '提出物の期限超過による影響',
    severity: 'A',
    level: 'high',
    sentiment_score: -0.52,
    department: 'ソリューション営業',
    customer: 'Global Systems Ltd.',
    updated_at: getRecentDate(20),
    status: 'unhandled',
    ai_summary: '自社営業側の提出期限超過により、顧客のビジネスに影響が出ている状態です。',
    emails: [
      {
        id: 'msg-024-001',
        sender: 'sato@global-systems.co.jp',
        recipient: 'suzuki@cross-m.co.jp',
        timestamp: '2025-07-12T09:00:00+09:00',
        ai_summary: '提出期限超過を指摘し、遅延理由とリカバリープランを要求。',
        subject: '提出物の期限超過について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `鈴木様

お世話になっております。Global Systems Ltd.の佐藤です。

先週金曜日までにご提出いただく予定だった技術仕様書が未着のため、本日の社内レビュー会議に影響が出ています。

遅延の理由と、いつまでに提出可能か、またリカバリープランについて、至急ご連絡いただけますでしょうか。

この件により、プロジェクトの進行に遅れが生じる可能性があります。
よろしくお願いいたします。

佐藤
Global Systems Ltd.`,
      },
    ],
    assignee: 'suzuki@cross-m.co.jp',
    company: 'Global Systems Ltd.',
    detection_score: 78,
    phrases: ['期限超過', '遅延', 'リカバリー'],
    threadId: 'thread-024',
    messageId: 'msg-024-001',
    sentiment_label: 'negative',
    negative_flag: false,
    primarySegment: 'occurrence',
    segmentConfidence: 0.88,
    urgencyScore: 78,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '自社営業側の提出期限超過により、ビジネス影響が出ている',
    ],
    highlightKeywords: ['期限', '遅延', '提出'],
    resolutionPrediction: {
      probability: 0.85,
      ttrHours: 2,
    },
    quality: {
      level: 'Low',
      score: 45,
      signals: ['対応速度 0.45', '計画性 0.40'],
    },
    detectionRule: {
      rule_type: 'sentiment_urgency',
      hours_since_last_activity: 20,
      score: 78,
    },
  },
  // 再発 - occurrence_reoccurrence
  {
    id: 'dummy-alert-025',
    subject: '過去に解決したはずの課題が再発',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.42,
    department: 'カスタマーサポート',
    customer: 'Enterprise Corp',
    updated_at: getRecentDate(15),
    status: 'in_progress',
    ai_summary: '自社営業側が先月解決したはずのシステムエラーが再発しており、顧客の不信感が高まっています。',
    emails: [
      {
        id: 'msg-025-001',
        sender: 'tanaka@enterprise-corp.co.jp',
        recipient: 'sato@cross-m.co.jp',
        timestamp: '2025-07-12T11:00:00+09:00',
        ai_summary: '先月解決したはずのエラーが再発したことを指摘し、恒久対策を要求。',
        subject: 'システムエラーの再発について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `佐藤様

お世話になっております。Enterprise Corpの田中です。

先月ご対応いただき、解決したとお聞きしていたシステムエラーが、本日また発生いたしました。

前回は一時的な対応で解決したとのことでしたが、今回の再発により、社内での信頼に影響が出ています。

恒久対策について、改めてご対応いただけますでしょうか。
また、再発を防ぐための検証プロセスについても、ご共有いただけますと幸いです。

よろしくお願いいたします。

田中
Enterprise Corp`,
      },
      {
        id: 'msg-025-002',
        sender: 'sato@cross-m.co.jp',
        recipient: 'tanaka@enterprise-corp.co.jp',
        timestamp: '2025-07-12T12:30:00+09:00',
        ai_summary: '再発を謝罪し、恒久対策と検証プロセスを提示。',
        subject: 'Re: システムエラーの再発について',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `田中様

ご連絡ありがとうございます。Cross-Mの佐藤です。

再発によりご迷惑をおかけし、誠に申し訳ございません。

恒久対策として、根本原因の修正と検証プロセスの強化を実施いたします。
詳細は添付資料にまとめましたので、ご確認ください。

今後このような事態が発生しないよう、万全を期してまいります。

佐藤
Cross-M株式会社`,
      },
    ],
    assignee: 'sato@cross-m.co.jp',
    company: 'Enterprise Corp',
    detection_score: 65,
    phrases: ['再発', 'また', '再度', '恒久対策'],
    threadId: 'thread-025',
    messageId: 'msg-025-001',
    sentiment_label: 'negative',
    negative_flag: false,
    primarySegment: 'occurrence',
    segmentConfidence: 0.85,
    urgencyScore: 65,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '過去に解決したはずの課題が再発している',
    ],
    highlightKeywords: ['再発', 'また', '恒久対策'],
    resolutionPrediction: {
      probability: 0.68,
      ttrHours: 12,
    },
    quality: {
      level: 'Medium',
      score: 60,
      signals: ['対応品質 0.60', '再発防止 0.55'],
    },
    detectionRule: {
      rule_type: 'sentiment_urgency',
      hours_since_last_activity: 15,
      score: 65,
    },
  },
  {
    id: 'dummy-alert-201',
    subject: '夜間帯ミーティングが続き顧客から時間帯変更の要望',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.35,
    department: 'カスタマーサクセス',
    customer: 'Urban Works',
    updated_at: getRecentDate(8),
    status: 'in_progress',
    ai_summary: '夜間に集中した打合せに対し、顧客から日中帯への切り替え要望と対応品質への懸念が届いています。',
    emails: [
      {
        id: 'msg-urban-01',
        sender: 'client@urbanworks.co.jp',
        recipient: 'sato@cross-m.co.jp',
        timestamp: '2025-07-11T22:15:00+09:00',
        ai_summary: '深夜対応への負担を訴え、午前帯へのリスケを要望。',
        subject: '夜間ミーティングの時間帯について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `佐藤様

お世話になっております。Urban Worksのクライアント担当です。

現在、毎週水曜日の21:00から実施している導入定例ミーティングについて、
社内メンバーから負担が大きいという声が上がっております。

具体的には、以下のような課題があります：
- 夜間のミーティングが続き、社員のワークライフバランスに影響が出ている
- 翌日の業務に支障が出るケースがある
- 一部メンバー（特に女性メンバー）が参加できない状況が発生している

現在の導入状況は順調に進んでいますが（進捗率75%）、
ミーティング時間の見直しが必要だと判断しました。

つきましては、次回以降のミーティングを日中帯（平日9:00〜18:00の間）に
変更していただけないでしょうか。

社内でスケジュール調整を進めたいため、可能であれば
候補時間をいくつかご提示いただけますと幸いです。
（例：毎週水曜 10:00〜11:00、毎週水曜 14:00〜15:00など）

ご検討のほど、よろしくお願いいたします。

Urban Works
クライアント担当`,
      },
    ],
    assignee: 'sato@cross-m.co.jp',
    company: 'Urban Works',
    detection_score: 68,
    phrases: ['夜間', 'リスケ', '負担'],
    sentiment_label: 'negative',
    negative_flag: false,
    primarySegment: 'occurrence',
    segmentConfidence: 0.78,
    urgencyScore: 68,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '夜間対応が連続',
      '顧客から負担の指摘',
    ],
    highlightKeywords: ['夜間', '負担', 'リスケ'],
    threadId: 'thread-urban-night',
    messageId: 'msg-urban-01',
    resolutionPrediction: {
      probability: 0.75,
      ttrHours: 8,
    },
    quality: {
      level: 'Medium',
      score: 72,
      signals: ['対応品質 0.72', 'リスケ対応 0.70'],
    },
    phaseD: {
      quality_level: 'Medium',
      quality_score: 72,
    },
    detectionRule: {
      rule_type: 'night_reply_rate',
      hours_since_last_activity: 6,
      score: 65,
    },
  },
  {
    id: 'dummy-alert-205',
    subject: 'North Data案件：資料共有の遅延懸念',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.32,
    department: 'エンタープライズ営業',
    customer: 'North Data',
    updated_at: getRecentDate(6),
    status: 'in_progress',
    ai_summary: '役員会議前に必要な資料が届いておらず、納期前でも再三確認が入っている状態です。',
    emails: [
      {
        id: 'msg-north-00',
        sender: 'pm@northdata.co.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-12T09:30:00+09:00',
        ai_summary: '納期前でも資料が確認できず、役員レビューに間に合うかを懸念している。',
        subject: '来週の役員会議資料について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `田中様

来週の経営会議で使用するレポートがまだ届いていません。
ドラフト版でも構いませんので、進捗と受領予定日をご教示ください。
役員からは「今回も遅れるのでは」と懸念されています。

North Data`,
      },
      {
        id: 'msg-north-00b',
        sender: 'tanaka@cross-m.co.jp',
        recipient: 'pm@northdata.co.jp',
        timestamp: '2025-07-12T10:05:00+09:00',
        ai_summary: 'ドラフトを同日内に送付予定と伝えたが、具体的な提出時刻は未確定。',
        subject: 'Re: 来週の役員会議資料について',
        sentiment: 'neutral',
        replyLevel: 1,
        body: `お世話になっております。Cross-Mの田中です。

ドラフト版を本日中にお送りできるよう調整しております。
最終確定は月曜朝を予定していますが、進捗を随時共有いたします。

よろしくお願いいたします。`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    detection_score: 67,
    phrases: ['資料', '会議', 'ドラフト'],
    sentiment_label: 'negative',
    primarySegment: 'occurrence',
    segmentConfidence: 0.78,
    urgencyScore: 67,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '役員会議前に資料未提出のため催促が発生',
    ],
    highlightKeywords: ['資料遅延', '役員会議', 'ドラフト'],
    resolutionPrediction: {
      probability: 0.58,
      ttrHours: 20,
    },
    detectionRule: {
      rule_type: 'sentiment_urgency',
      hours_since_last_activity: 6,
      score: 60,
    },
    threadId: 'thread-north-delay',
    messageId: 'msg-north-00',
  },
  {
    id: 'dummy-alert-202',
    subject: '72時間返信がなく顧客から催促の追撃',
    severity: 'A',
    level: 'high',
    sentiment_score: -0.55,
    department: 'エンタープライズ営業',
    customer: 'North Data',
    updated_at: getRecentDate(3),
    status: 'unhandled',
    ai_summary: '72時間以上返信が無く、顧客からエスカレーション寸前の催促が届いています。',
    emails: [
      {
        id: 'msg-north-01',
        sender: 'exec@northdata.co.jp',
        recipient: 'tanaka@cross-m.co.jp',
        timestamp: '2025-07-13T08:00:00+09:00',
        ai_summary: '納期が迫る中で返信が無いことへの不満とエスカレーション予告。',
        subject: '資料共有の遅延について',
        sentiment: 'negative',
        replyLevel: 0,
        body: `田中様

72時間以上返信がなく、社内でエスカレーション寸前まで議論が進んでいます。
このままですと週末の役員会にかけられません。
事情と最新スケジュールを本日午前中にご共有ください。

North Data`,
      },
    ],
    assignee: 'tanaka@cross-m.co.jp',
    company: 'North Data',
    detection_score: 82,
    phrases: ['72時間', '遅延', 'エスカレーション'],
    threadId: 'thread-north-delay',
    messageId: 'msg-north-01',
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'occurrence',
    segmentConfidence: 0.83,
    urgencyScore: 82,
    detectionReasons: [
      SEGMENT_META.occurrence.detectionLabel,
      '72時間以上返信がなく、顧客からエスカレーション寸前の催促が届いている',
    ],
    highlightKeywords: ['72時間', '遅延', 'エスカレーション', '返信'],
    resolutionPrediction: {
      probability: 0.42,
      ttrHours: 24,
    },
    quality: {
      level: 'Low',
      score: 58,
      signals: ['72時間未返信 0.58', 'エスカレーションリスク 0.65'],
    },
    phaseC: {
      p_resolved_24h: 0.42,
      ttr_pred_min: 1440,
      hazard_score: 0.68,
    },
    detectionRule: {
      rule_type: 'inactivity_72h',
      hours_since_last_activity: 75,
      score: 85,
    },
  },
  {
    id: 'dummy-alert-203',
    subject: '同一トピックの繰り返しでネガ感情が増幅',
    severity: 'B',
    level: 'medium',
    sentiment_score: -0.4,
    department: 'アカウント戦略',
    customer: 'Prime Capital',
    updated_at: getRecentDate(2),
    status: 'in_progress',
    ai_summary: 'PoC報告の遅延に対し、同じ質問が繰り返されネガティブトーンが強まっています。',
    emails: [
      {
        id: 'msg-prime-01',
        sender: 'cfo@prime-capital.co.jp',
        recipient: 'suzuki@cross-m.co.jp',
        timestamp: '2025-07-14T13:10:00+09:00',
        ai_summary: '再三同じ回答を求めており、ネガティブな言い回しが増えている。',
        subject: '【懸念】PoC報告の遅延と同一質問の繰り返し',
        sentiment: 'negative',
        replyLevel: 0,
        body: `鈴木様

お世話になっております。Prime CapitalのCFOです。

先週お願いしたPoCレポートの提出期限が過ぎておりますが、
まだ受領できておりません。

先月のミーティングでも同様の件で確認をさせていただきましたが、
今回も同じ状況が繰り返されており、社内で懸念が高まっています。

具体的には以下の点について、早急にご回答いただけますでしょうか：
1. PoCレポートの提出予定日時
2. 遅延の理由
3. 今後の再発防止策

先月の件では「次回は確実に提出する」とお約束いただきましたが、
今回も同じ状況となっており、信頼関係に影響が出かねません。

本日17時までにご回答いただけますと幸いです。

Prime Capital
CFO`,
      },
    ],
    assignee: 'suzuki@cross-m.co.jp',
    company: 'Prime Capital',
    detection_score: 74,
    phrases: ['繰り返し', 'PoC', '回答'],
    sentiment_label: 'negative',
    negative_flag: true,
    primarySegment: 'forecast',
    segmentConfidence: 0.76,
    urgencyScore: 74,
    detectionReasons: [
      SEGMENT_META.forecast.detectionLabel,
      '同一トピックの繰り返しでネガティブトーンが増幅している',
    ],
    highlightKeywords: ['PoC', '再確認', '回答', '繰り返し'],
    threadId: 'thread-prime-poc',
    messageId: 'msg-prime-01',
    resolutionPrediction: {
      probability: 0.65,
      ttrHours: 12,
    },
    quality: {
      level: 'Low',
      score: 58,
      signals: ['回答遅延 0.58', '一次情報不足 0.55'],
    },
    phaseD: {
      quality_level: 'Low',
      quality_score: 58,
      signals: ['回答遅延', '一次情報不足'],
    },
    detectionRule: {
      rule_type: 'topic_repetition_tone_drop',
      hours_since_last_activity: 18,
      score: 70,
    },
  },
];

export const DUMMY_SEGMENT_COUNTS = {
  forecast: 8,
  occurrence: 15,
  follow: 2,
};

export const DUMMY_ALERTS_BY_OWNER = DUMMY_ALERTS.reduce<Record<string, Alert[]>>((acc, alert) => {
  const owner = alert.assignee || '未割り当て';
  if (!acc[owner]) {
    acc[owner] = [];
  }
  acc[owner].push(alert);
  return acc;
}, {});

export const DUMMY_OWNER_SUMMARY = Object.entries(DUMMY_ALERTS_BY_OWNER).reduce<
  Record<
    string,
    {
      alertCount: number;
      customers: string[];
      segments: SegmentKey[];
      severity: { A: number; B: number; C: number };
    }
  >
>((acc, [owner, alerts]) => {
  const customers = Array.from(new Set(alerts.map((alert) => alert.customer).filter(Boolean)));
  const segments = Array.from(
    new Set(alerts.map((alert) => alert.primarySegment).filter(Boolean))
  ) as SegmentKey[];
  const severity = alerts.reduce(
    (counts, alert) => {
      counts[alert.severity] = (counts[alert.severity] ?? 0) + 1;
      return counts;
    },
    { A: 0, B: 0, C: 0 } as Record<'A' | 'B' | 'C', number>
  );

  acc[owner] = {
    alertCount: alerts.length,
    customers,
    segments,
    severity,
  };
  return acc;
}, {});

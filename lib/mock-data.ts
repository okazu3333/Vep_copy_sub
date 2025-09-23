import { Alert, KPI, DetectionRule, User } from '@/types';

export const mockUser: User = {
  id: '1',
  email: 'admin@company.com',
  name: '田中 太郎',
  role: 'executive',
  department: '経営企画部',
  avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2'
};

export const mockWorkerUser: User = {
  id: '2',
  email: 'worker@company.com',
  name: '佐藤 花子',
  role: 'worker',
  department: 'カスタマーサポート',
  avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=64&h=64&dpr=2'
};

export const mockKPI: KPI = {
  critical_alerts: 12,
  negative_ratio: 0.34,
  department_rankings: [
    { department: 'カスタマーサポート', alert_count: 8 },
    { department: '営業部', alert_count: 6 },
    { department: '開発部', alert_count: 3 }
  ]
};

export const mockAlerts: Alert[] = [
  {
    id: '1',
    subject: '【緊急】システム障害による顧客クレーム',
    severity: 'A',
    sentiment_score: -0.8,
    department: 'カスタマーサポート',
    customer: '株式会社ABC',
    updated_at: '2024-01-15T10:30:00Z',
    status: 'unhandled',
    ai_summary: '大規模システム障害により複数の顧客から苦情が寄せられています。迅速な対応が必要です。',
    emails: [
      {
        id: '1',
        sender: 'customer@abc.com',
        recipient: 'support@company.com',
        timestamp: '2024-01-15T09:15:00Z',
        sentiment: 'negative',
        ai_summary: '月次処理が停止し、業務に支障が出ているとのクレーム'
      },
      {
        id: '2',
        sender: 'support@company.com',
        recipient: 'customer@abc.com',
        timestamp: '2024-01-15T10:00:00Z',
        sentiment: 'neutral',
        ai_summary: '障害状況の確認と復旧見込みについて回答'
      }
    ]
  },
  {
    id: '2',
    subject: '契約解約の検討について',
    severity: 'B',
    sentiment_score: -0.6,
    department: '営業部',
    customer: '株式会社XYZ',
    updated_at: '2024-01-14T15:45:00Z',
    status: 'in_progress',
    ai_summary: '価格面での不満から契約解約を検討しているお客様への対応が進行中です。',
    emails: [
      {
        id: '3',
        sender: 'procurement@xyz.com',
        recipient: 'sales@company.com',
        timestamp: '2024-01-14T14:30:00Z',
        sentiment: 'negative',
        ai_summary: '競合他社との価格比較で不利な状況への言及'
      }
    ]
  },
  {
    id: '3',
    subject: '新機能へのポジティブな反応',
    severity: 'C',
    sentiment_score: 0.7,
    department: '開発部',
    customer: '株式会社DEF',
    updated_at: '2024-01-13T11:20:00Z',
    status: 'completed',
    ai_summary: 'リリースした新機能に対して顧客から好意的な反応をいただいています。',
    emails: [
      {
        id: '4',
        sender: 'manager@def.com',
        recipient: 'product@company.com',
        timestamp: '2024-01-13T11:00:00Z',
        sentiment: 'positive',
        ai_summary: '新しいダッシュボード機能の使いやすさを評価'
      }
    ]
  }
];

export const mockDetectionRules: DetectionRule[] = [
  {
    id: '1',
    keyword: '解約',
    ai_suggested: true,
    status: 'pending',
    confidence_score: 0.92
  },
  {
    id: '2',
    keyword: '炎上',
    ai_suggested: true,
    status: 'pending',
    confidence_score: 0.88
  },
  {
    id: '3',
    keyword: '障害',
    ai_suggested: false,
    status: 'approved',
    confidence_score: 0.95
  },
  {
    id: '4',
    keyword: 'クレーム',
    ai_suggested: false,
    status: 'approved',
    confidence_score: 0.91
  },
  {
    id: '5',
    keyword: '不具合',
    ai_suggested: true,
    status: 'pending',
    confidence_score: 0.85
  }
];

export const mockTimeSeriesData = [
  { date: '1/1', alerts: 5, negative_ratio: 0.2 },
  { date: '1/2', alerts: 8, negative_ratio: 0.3 },
  { date: '1/3', alerts: 12, negative_ratio: 0.4 },
  { date: '1/4', alerts: 6, negative_ratio: 0.25 },
  { date: '1/5', alerts: 9, negative_ratio: 0.35 },
  { date: '1/6', alerts: 15, negative_ratio: 0.45 },
  { date: '1/7', alerts: 11, negative_ratio: 0.38 }
];

export const mockHeatmapData = [
  { department: 'カスタマーサポート', day: '月', value: 12 },
  { department: 'カスタマーサポート', day: '火', value: 8 },
  { department: 'カスタマーサポート', day: '水', value: 15 },
  { department: 'カスタマーサポート', day: '木', value: 6 },
  { department: 'カスタマーサポート', day: '金', value: 10 },
  { department: '営業部', day: '月', value: 5 },
  { department: '営業部', day: '火', value: 8 },
  { department: '営業部', day: '水', value: 3 },
  { department: '営業部', day: '木', value: 7 },
  { department: '営業部', day: '金', value: 4 },
  { department: '開発部', day: '月', value: 2 },
  { department: '開発部', day: '火', value: 4 },
  { department: '開発部', day: '水', value: 1 },
  { department: '開発部', day: '木', value: 3 },
  { department: '開発部', day: '金', value: 2 }
];

export const mockCompanyAlerts = [
  { name: '株式会社ABC', alerts: 15, severity: 'high', trend: 'up' },
  { name: '株式会社XYZ', alerts: 8, severity: 'medium', trend: 'down' },
  { name: '株式会社DEF', alerts: 3, severity: 'low', trend: 'stable' },
  { name: '株式会社GHI', alerts: 12, severity: 'high', trend: 'up' },
  { name: '株式会社JKL', alerts: 6, severity: 'medium', trend: 'stable' }
];

export const mockDepartmentDetails = [
  { department: 'カスタマーサポート', alerts: 51, members: 12, avgPerPerson: 4.3, trend: 'up' },
  { department: '営業部', alerts: 27, members: 8, avgPerPerson: 3.4, trend: 'down' },
  { department: '開発部', alerts: 12, members: 15, avgPerPerson: 0.8, trend: 'stable' },
  { department: '経営企画部', alerts: 5, members: 3, avgPerPerson: 1.7, trend: 'stable' }
];

export const mockPersonalAlerts = [
  { name: '田中 太郎', department: 'カスタマーサポート', alerts: 18, severity: 'high', lastAlert: '2024-01-15' },
  { name: '佐藤 花子', department: 'カスタマーサポート', alerts: 15, severity: 'high', lastAlert: '2024-01-15' },
  { name: '山田 次郎', department: '営業部', alerts: 12, severity: 'medium', lastAlert: '2024-01-14' },
  { name: '鈴木 美咲', department: '開発部', alerts: 8, severity: 'medium', lastAlert: '2024-01-13' },
  { name: '高橋 健一', department: 'カスタマーサポート', alerts: 7, severity: 'medium', lastAlert: '2024-01-14' },
  { name: '伊藤 真理', department: '営業部', alerts: 6, severity: 'low', lastAlert: '2024-01-12' },
  { name: '渡辺 大輔', department: '開発部', alerts: 4, severity: 'low', lastAlert: '2024-01-11' },
  { name: '中村 由美', department: '経営企画部', alerts: 3, severity: 'low', lastAlert: '2024-01-10' }
]; 
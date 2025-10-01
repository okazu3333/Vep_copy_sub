export interface User {
  id: string;
  email: string;
  name: string;
  role: 'executive' | 'worker';
  department: string;
  avatar?: string;
}

export interface Alert {
  id: string;
  subject: string;
  email_subject?: string;
  severity: 'A' | 'B' | 'C';
  level?: 'high' | 'medium' | 'low';
  sentiment_score: number;
  department: string;
  customer: string;
  updated_at: string;
  status: 'unhandled' | 'in_progress' | 'completed';
  ai_summary: string;
  emails: EmailThread[];
  assignee?: string;
  // 追加（オプション）: 会社名と検知スコア
  company?: string | null;
  detection_score?: number; // 0-100
  // 追加（オプション）: 検知フレーズ - より柔軟な型定義
  phrases?: string[] | string | null;
  // 取得用の付加情報（任意）
  threadId?: string | null;
  messageId?: string | null;
  // 追加（任意）: 感情・ネガ判定
  sentiment_label?: 'positive' | 'neutral' | 'negative' | null;
  negative_flag?: boolean;
  // 新しいセグメント形式
  primarySegment?: 'urgent_response' | 'churn_risk' | 'competitive_threat' | 'contract_related' | 'revenue_opportunity' | 'other' | null;
  segmentConfidence?: number;
  urgencyScore?: number;
  // 検知理由とキーワードハイライト
  detectionReasons?: string[];
  highlightKeywords?: string[];
}

export interface EmailThread {
  id: string;
  sender: string;
  recipient: string;
  timestamp: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  ai_summary: string;
  // 追加情報（任意）
  subject?: string;
  replyLevel?: number;
  inReplyTo?: string | null;
  messageId?: string | null;
}

export interface KPI {
  critical_alerts: number;
  negative_ratio: number;
  department_rankings: Array<{
    department: string;
    alert_count: number;
  }>;
}

export interface DetectionRule {
  id: string;
  keyword: string;
  ai_suggested: boolean;
  status: 'approved' | 'rejected' | 'pending';
  confidence_score: number;
} 

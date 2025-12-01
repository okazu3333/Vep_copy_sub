export interface User {
  id: string;
  email: string;
  name: string;
  role: 'executive' | 'worker';
  department: string;
  avatar?: string;
}

import type { SegmentKey } from '@/lib/segments';

export interface Alert {
  id: string;
  subject: string;
  email_subject?: string;
  severity: 'A' | 'B' | 'C';
  level?: 'high' | 'medium' | 'low';
  sentiment_score: number;
  department: string;
  customer: string;
  created_at?: string;
  updated_at: string;
  status: 'unhandled' | 'in_progress' | 'completed';
  ai_summary: string;
  body_preview?: string;
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
  primarySegment?: SegmentKey | null;
  segmentConfidence?: number;
  urgencyScore?: number;
  // 検知理由とキーワードハイライト
  detectionReasons?: string[];
  highlightKeywords?: string[];
  resolutionPrediction?: {
    probability: number; // 0-1
    ttrHours?: number;
    notes?: string;
  };
  quality?: {
    level: 'High' | 'Medium' | 'Low';
    score: number;
    signals?: string[];
  };
  // 分析モデル指標（オプション）
  phaseC?: {
    p_resolved_24h: number;
    ttr_pred_min?: number;
    hazard_score?: number;
  };
  phaseD?: {
    quality_score: number;
    quality_level: 'High' | 'Medium' | 'Low';
  };
  detectionRule?: {
    rule_type: 'inactivity_72h' | 'night_reply_rate' | 'sentiment_urgency' | 'tone_frequency_drop' | 'recovery_monitoring' | 'topic_repetition_tone_drop';
    hours_since_last_activity?: number;
    score: number;
  };
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
  body?: string; // メール本文（オプション）
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

/**
 * セグメント遷移履歴
 */
export interface SegmentTransition {
  id: string;
  alert_id: string;
  thread_id: string;
  from_segment: SegmentKey | null;
  to_segment: SegmentKey;
  transition_reason: string;
  transition_score: number;
  transitioned_by: string; // 'system' | 'manual' | user_id
  created_at: string;
}

/**
 * 自動解決履歴
 */
export interface AutoResolution {
  id: string;
  alert_id: string;
  thread_id: string;
  resolution_type: 'positive_sentiment' | 'no_response_7d' | 'spam_detected';
  resolution_score: number;
  resolution_reason: string;
  previous_status: 'unhandled' | 'in_progress';
  resolved_at: string;
} 

import { SegmentKey } from '@/lib/segments';
import { Alert, EmailThread } from '@/types';

export type DetectionRuleKey =
  | 'forecast_trust_risk'
  | 'forecast_response_quality'
  | 'forecast_tone_down'
  | 'forecast_inactive'
  | 'occurrence_complaint'
  | 'occurrence_silence'
  | 'occurrence_proposal_issue'
  | 'occurrence_reoccurrence'
  | 'occurrence_followup'
  | 'follow_recovery';

export interface RawEvent {
  id: string;
  externalId?: string;
  threadId?: string;
  subject: string;
  body: string;
  summary?: string;
  customer: string;
  channel: 'email' | 'slack' | 'crm';
  direction: 'inbound' | 'outbound';
  assignee?: string;
  sentimentScore?: number; // -1..1
  urgencyHints?: string[];
  keywords?: string[];
  occurredAt: string; // ISO string
  hoursSinceLastReply?: number;
  priorAlerts?: string[];
  language?: 'ja' | 'en';
}

export interface DetectionMatch {
  rule: DetectionRuleKey;
  segment: SegmentKey;
  score: number;
  severity: 'A' | 'B' | 'C';
  urgencyScore: number;
  reasons: string[];
  highlightKeywords: string[];
}

export interface RuntimeAlert extends Alert {
  sourceEventId: string;
}

export interface DetectionRuleDescriptor {
  key: DetectionRuleKey;
  segment: SegmentKey;
  keywords?: string[];
  negativeKeywords?: string[];
  minSentiment?: number;
  maxSentiment?: number;
  minHoursSinceLastReply?: number;
  direction?: 'inbound' | 'outbound';
  severity: 'A' | 'B' | 'C';
  urgency: number;
  description: string;
}

export interface AlertBuildOptions {
  generateIds?: boolean;
}

export interface RuntimeAlertStore {
  alerts: RuntimeAlert[];
  updatedAt: string;
}

export interface AlertBuildContext {
  event: RawEvent;
  match: DetectionMatch;
  thread?: EmailThread[];
}

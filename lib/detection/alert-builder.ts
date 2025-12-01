import { cn } from '@/lib/utils';
import { Alert } from '@/types';
import { AlertBuildContext, DetectionMatch, RawEvent } from './models';
import { buildThreadsFromEvent } from './engine';
import { SEGMENT_META } from '@/lib/segments';

const randomId = () => `rt-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;

const pickStatus = (match: DetectionMatch): Alert['status'] => {
  if (match.severity === 'A') return 'unhandled';
  if (match.urgencyScore > 70) return 'unhandled';
  return match.urgencyScore > 50 ? 'in_progress' : 'completed';
};

export const buildAlertFromMatch = (event: RawEvent, match: DetectionMatch): Alert => {
  const threads = buildThreadsFromEvent(event);
  return {
    id: `${event.id}-${match.rule}-${Date.now()}`,
    subject: event.subject,
    severity: match.severity,
    level:
      match.severity === 'A'
        ? 'high'
        : match.severity === 'B'
        ? 'medium'
        : 'low',
    sentiment_score: event.sentimentScore ?? 0,
    department: 'エンタープライズ営業',
    customer: event.customer,
    updated_at: event.occurredAt,
    status: pickStatus(match),
    ai_summary:
      event.summary ??
      `顧客からの${SEGMENT_META[match.segment]?.label ?? match.segment}兆候に関する問い合わせです。`,
    emails: threads,
    assignee: event.assignee,
    company: event.customer,
    detection_score: Math.round(match.score),
    phrases: match.highlightKeywords,
    threadId: event.threadId,
    messageId: threads[0]?.id,
    sentiment_label:
      event.sentimentScore && event.sentimentScore < -0.1
        ? 'negative'
        : event.sentimentScore && event.sentimentScore > 0.2
        ? 'positive'
        : 'neutral',
    negative_flag: (event.sentimentScore ?? 0) < -0.1,
    primarySegment: match.segment,
    segmentConfidence: Math.min(0.99, match.score / 100),
    urgencyScore: match.urgencyScore,
    detectionReasons: match.reasons,
    highlightKeywords: match.highlightKeywords,
    resolutionPrediction: {
      probability: 1 - Math.min(0.9, match.urgencyScore / 120),
      ttrHours: match.urgencyScore > 70 ? 6 : 18,
    },
    quality: {
      level: match.severity === 'A' ? 'Low' : 'Medium',
      score: 70 - (match.urgencyScore - 40),
      signals: [`${match.rule} triggered`, `segment:${match.segment}`],
    },
    detectionRule: {
      rule_type: 'sentiment_urgency',
      score: Math.round(match.score),
    },
  };
};

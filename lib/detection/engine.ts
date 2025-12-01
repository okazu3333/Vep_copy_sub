import { normalizeEmailThreads } from './threads';
import {
  DetectionMatch,
  DetectionRuleDescriptor,
  RawEvent,
} from './models';
import { DETECTION_RULES } from './rules';

const normalizeText = (text: string) => text.toLowerCase();

const matchKeywords = (text: string, keywords: string[] = []) => {
  if (!keywords.length) return false;
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
};

const evaluateRule = (event: RawEvent, rule: DetectionRuleDescriptor): DetectionMatch | null => {
  const content = `${event.subject}\n${event.body}\n${event.summary ?? ''}`;
  if (rule.keywords && !matchKeywords(content, rule.keywords)) {
    return null;
  }

  if (rule.negativeKeywords && matchKeywords(content, rule.negativeKeywords)) {
    return null;
  }

  if (
    typeof rule.minSentiment === 'number' &&
    (event.sentimentScore ?? 0) < rule.minSentiment
  ) {
    return null;
  }

  if (
    typeof rule.maxSentiment === 'number' &&
    (event.sentimentScore ?? 0) > rule.maxSentiment
  ) {
    return null;
  }

  if (
    typeof rule.minHoursSinceLastReply === 'number' &&
    (event.hoursSinceLastReply ?? 0) < rule.minHoursSinceLastReply
  ) {
    return null;
  }

  if (rule.direction && rule.direction !== event.direction) {
    return null;
  }

  const reasons = [rule.description];
  if (rule.keywords?.length) {
    const found = rule.keywords.filter((kw) => content.includes(kw));
    if (found.length) {
      reasons.push(`キーワード一致: ${found.join(', ')}`);
    }
  }
  if (typeof event.hoursSinceLastReply === 'number' && rule.minHoursSinceLastReply) {
    reasons.push(`最終返信から${event.hoursSinceLastReply}h経過`);
  }

  return {
    rule: rule.key,
    segment: rule.segment,
    severity: rule.severity,
    urgencyScore: rule.urgency,
    score: Math.min(100, rule.urgency + (event.sentimentScore ?? 0) * 20),
    reasons,
    highlightKeywords: rule.keywords?.filter((kw) => content.includes(kw)) ?? [],
  };
};

export const evaluateEvent = (event: RawEvent): DetectionMatch[] => {
  const matches: DetectionMatch[] = [];
  DETECTION_RULES.forEach((rule) => {
    const match = evaluateRule(event, rule);
    if (match) {
      matches.push(match);
    }
  });
  return matches;
};

export const buildThreadsFromEvent = (event: RawEvent) => normalizeEmailThreads(event);

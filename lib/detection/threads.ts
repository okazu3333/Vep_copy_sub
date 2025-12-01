import { EmailThread } from '@/types';
import { RawEvent } from './models';

export const normalizeEmailThreads = (event: RawEvent): EmailThread[] => {
  return [
    {
      id: `${event.id}-msg`,
      sender: event.direction === 'inbound' ? event.customer : (event.assignee ?? 'ops@cross-m.co.jp'),
      recipient: event.direction === 'inbound' ? (event.assignee ?? 'ops@cross-m.co.jp') : event.customer,
      timestamp: event.occurredAt,
      sentiment: event.sentimentScore && event.sentimentScore < -0.1 ? 'negative' : event.sentimentScore && event.sentimentScore > 0.1 ? 'positive' : 'neutral',
      ai_summary: event.summary ?? event.body.slice(0, 120),
      subject: event.subject,
      replyLevel: 0,
      body: event.body,
    },
  ];
};

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { evaluateEvent } from '@/lib/detection/engine';
import { buildAlertFromMatch } from '@/lib/detection/alert-builder';
import {
  RawEvent,
  RuntimeAlert,
} from '@/lib/detection/models';
import {
  appendRuntimeAlerts,
  readRuntimeAlerts,
} from '@/lib/detection/store';

const ensureArray = <T>(payload: T | T[]): T[] =>
  Array.isArray(payload) ? payload : [payload];

const normalizeEvent = (event: Partial<RawEvent>): RawEvent => {
  if (!event.id) {
    throw new Error('event.id is required');
  }
  if (!event.subject || !event.body) {
    throw new Error('subject and body are required');
  }
  if (!event.customer) {
    throw new Error('customer is required');
  }

  return {
    id: event.id,
    externalId: event.externalId,
    threadId: event.threadId,
    subject: event.subject,
    body: event.body,
    summary: event.summary,
    customer: event.customer,
    channel: event.channel ?? 'email',
    direction: event.direction ?? 'inbound',
    assignee: event.assignee ?? 'unassigned@cross-m.co.jp',
    sentimentScore: event.sentimentScore ?? 0,
    urgencyHints: event.urgencyHints ?? [],
    keywords: event.keywords ?? [],
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    hoursSinceLastReply: event.hoursSinceLastReply,
    priorAlerts: event.priorAlerts ?? [],
    language: event.language ?? 'ja',
  };
};

const loadScenarioEvents = async (fileName: string) => {
  const filePath = path.join(process.cwd(), 'data', 'mock', fileName);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Array<{ event: RawEvent; label?: string }>;
};

const buildAlertsFromEvents = (events: RawEvent[]): RuntimeAlert[] => {
  const alerts: RuntimeAlert[] = [];
  events.forEach((event) => {
    const matches = evaluateEvent(event);
    matches.forEach((match) => {
      const alert = buildAlertFromMatch(event, match);
      alerts.push({
        ...alert,
        sourceEventId: event.id,
      });
    });
  });
  return alerts;
};

const SCENARIO_HANDLERS: Record<
  string,
  () => Promise<{ alerts: RuntimeAlert[]; meta?: Record<string, unknown> }>
> = {
  'proto-thread': async () => {
    const payload = await loadScenarioEvents('protoScenario.json');
    const events = payload.map((item) => item.event);
    const alerts = buildAlertsFromEvents(events);
    return {
      alerts,
      meta: { label: '予兆→発生→フォロー（protoScenario）', totalEvents: events.length },
    };
  },
  'follow-sample': async () => {
    const followEvent: RawEvent = {
      id: 'scenario-follow-001',
      subject: '改善レポートのご共有と追加プランの提案',
      body: '障害後の対応まとめと改善策をご報告します。追加フォローMTGを調整させてください。',
      summary: 'フォロー報告と改善策MTG依頼',
      customer: 'Bright Future Holdings',
      channel: 'email',
      direction: 'outbound',
      assignee: 'success@cross-m.co.jp',
      sentimentScore: 0.42,
      urgencyHints: ['フォロー'],
      keywords: ['フォロー', '改善', '提案'],
      occurredAt: new Date().toISOString(),
      hoursSinceLastReply: 1,
      language: 'ja',
      threadId: 'scenario-follow-thread',
    };
    const alerts = buildAlertsFromEvents([followEvent]);
    return {
      alerts,
      meta: { label: 'フォローメール単体', totalEvents: 1 },
    };
  },
};

export async function GET(req: NextRequest) {
  const scenarioKey = req.nextUrl.searchParams.get('scenario');
  if (scenarioKey) {
    const handler = SCENARIO_HANDLERS[scenarioKey];
    if (!handler) {
      return NextResponse.json({ error: 'Unknown scenario' }, { status: 404 });
    }
    const scenario = await handler();
    return NextResponse.json({
      alerts: scenario.alerts,
      scenario: scenarioKey,
      meta: scenario.meta,
      updatedAt: new Date().toISOString(),
    });
  }

  const store = await readRuntimeAlerts();
  return NextResponse.json(store);
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const events = ensureArray(payload).map(normalizeEvent);

  const generated: RuntimeAlert[] = [];
  events.forEach((event) => {
    const matches = evaluateEvent(event);
    matches.forEach((match) => {
      const alert = buildAlertFromMatch(event, match);
      generated.push({
        ...alert,
        sourceEventId: event.id,
      });
    });
  });

  if (generated.length) {
    await appendRuntimeAlerts(generated);
  }

  return NextResponse.json(
    {
      created: generated.length,
      alerts: generated,
    },
    { status: generated.length ? 201 : 200 }
  );
}

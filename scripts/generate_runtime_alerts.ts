import { promises as fs } from 'fs';
import path from 'path';
import { evaluateEvent } from '../lib/detection/engine';
import { buildAlertFromMatch } from '../lib/detection/alert-builder';
import { RawEvent, RuntimeAlert } from '../lib/detection/models';
import { appendRuntimeAlerts } from '../lib/detection/store';

const EVENTS_PATH = path.join(process.cwd(), 'data', 'mock', 'runtimeEvents.json');

async function loadEvents(): Promise<RawEvent[]> {
  const raw = await fs.readFile(EVENTS_PATH, 'utf-8');
  const data = JSON.parse(raw);
  return data as RawEvent[];
}

async function main() {
  const events = await loadEvents();
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

  await appendRuntimeAlerts(alerts);
  console.log(`Generated ${alerts.length} alerts from ${events.length} events.`);
}

main().catch((error) => {
  console.error('Failed to generate runtime alerts', error);
  process.exit(1);
});

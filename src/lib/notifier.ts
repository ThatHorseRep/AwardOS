// Simple pluggable notifier for integrity alerts.
// Uses SLACK_WEBHOOK_URL env var if present; otherwise records that delivery was skipped.
// Adds basic retry logic and Slack-friendly formatting.

import { db } from '@/lib/db';
import { notificationEvents } from '@/lib/db/schema/exports';
import { integrityAlerts } from '@/lib/db/schema/integrity';

type IntegrityAlert = typeof integrityAlerts.$inferSelect;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function logNotificationEvent(options: {
  alert: IntegrityAlert;
  destinationType: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  responseCode?: number;
  responseBody?: unknown;
  errorMessage?: string;
}) {
  const { alert, destinationType, status, responseCode, responseBody, errorMessage } = options;
  try {
    await db.insert(notificationEvents).values({
      alertId: alert.id || null,
      eventId: alert.eventId,
      notificationType: destinationType === 'SLACK' ? 'SLACK' : 'EMAIL',
      destinationType,
      status,
      responseCode,
      responseBody: responseBody ? responseBody : null,
      errorMessage: errorMessage || null,
    });
  } catch (err) {
     
    console.error('Failed to persist notification audit event:', err);
  }
}

export async function sendAlertNotifications(alerts: IntegrityAlert[]) {
  if (!alerts || alerts.length === 0) return;

  // Server-side only. A NEXT_PUBLIC_ fallback used to sit here, but Next inlines
  // those into the client bundle at build time — that shipped the webhook, which
  // is a bearer credential for posting to the workspace's Slack, to every visitor.
  const webhook = process.env.SLACK_WEBHOOK_URL;

  for (const a of alerts) {
    const blocks = [
      { type: "section", text: { type: "mrkdwn", text: `*Integrity Alert*` } },
      { type: "section", text: { type: "mrkdwn", text: `*${a.title}*` } },
      { type: "section", text: { type: "mrkdwn", text: `*Severity:* ${a.severity}` } },
      { type: "section", text: { type: "mrkdwn", text: `${a.description}` } },
      { type: "section", text: { type: "mrkdwn", text: `*Affected:* \n\`${JSON.stringify(a.affectedVotes)}\`` } },
    ];

    const payload = webhook ? { blocks } : { text: `Integrity: ${a.title} (${a.severity}) -- ${a.description}` };

    if (webhook) {
      let attempt = 0;
      let lastError: unknown = null;
      let responseCode: number | undefined;
      let responseBody: unknown = null;
      while (attempt < MAX_RETRIES) {
        try {
          const res = await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10_000),
          });
          responseCode = res.status;
          if (res.ok) {
            responseBody = await res.text();
            await logNotificationEvent({
              alert: a,
              destinationType: 'SLACK',
              status: 'SENT',
              responseCode,
              responseBody,
            });
            break;
          }
          lastError = `HTTP ${res.status}`;
          responseBody = await res.text();
          attempt++;
          if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
        } catch (err) {
          lastError = err;
          attempt++;
           
          console.error(`Notifier attempt ${attempt} failed:`, err);
          if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
        }
      }
      if (lastError) {
        await logNotificationEvent({
          alert: a,
          destinationType: 'SLACK',
          status: 'FAILED',
          responseCode,
          responseBody,
          errorMessage: typeof lastError === 'string' ? lastError : String(lastError),
        });
      }
    } else {
      await logNotificationEvent({
        alert: a,
        destinationType: 'SLACK',
        status: 'SKIPPED',
        errorMessage: "SLACK_WEBHOOK_URL is not configured.",
      });
    }
  }
}

export default sendAlertNotifications;

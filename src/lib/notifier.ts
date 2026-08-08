// Simple pluggable notifier for integrity alerts.
// Uses SLACK_WEBHOOK_URL env var if present; otherwise falls back to console logging.
// Adds basic retry logic and Slack-friendly formatting.

import { db } from '@/lib/db';
import { notificationEvents } from '@/lib/db/schema/exports';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function logNotificationEvent(options: {
  alert: any;
  destinationType: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  responseCode?: number;
  responseBody?: any;
  errorMessage?: string;
}) {
  const { alert, destinationType, status, responseCode, responseBody, errorMessage } = options;
  try {
    await db.insert(notificationEvents).values({
      alertId: alert.id || null,
      eventId: alert.eventId,
      notificationType: destinationType === 'SLACK' ? 'SLACK' : 'CONSOLE',
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

export async function sendAlertNotifications(alerts: any[]) {
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
      let lastError: any = null;
      let responseCode: number | undefined;
      let responseBody: any = null;
      while (attempt < MAX_RETRIES) {
        try {
          const res = await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
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
       
      console.log("Notifier (stub):", payload);
      await logNotificationEvent({
        alert: a,
        destinationType: 'CONSOLE',
        status: 'SENT',
      });
    }
  }
}

export default sendAlertNotifications;

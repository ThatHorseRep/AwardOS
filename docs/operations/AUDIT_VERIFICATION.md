# Audit Verification

> **Operational runbook.** These focused checks supplement the full release
> gates documented in `SHIPPING_VERIFICATION.md`.

- **Purpose:** Steps to verify integrity detector and export behavior.

- **Run dev server:**

  ```bash
  cd awardos
  npm run dev
  ```

- **Trigger an integrity scan:**
  - Open the dashboard for an event: `/dashboard/events/<EVENT_ID>/integrity`
  - Click `Run Integrity Audit`.
  - Review alerts in the feed and expand affected ballots.

- **Verify flagged sessions are excluded from exports:**
  - Option A (recommended, requires DB access):

    ```bash
    # set your DB connection and event id
    DATABASE_URL="$VERIFY_DATABASE_URL" EVENT_ID="$VERIFY_EVENT_ID" node scripts/verify_exports.js
    ```

    - Exit code `0` indicates passed verification; non-zero indicates failure.

  - Option B (manual): Run the raw ballots export from the dashboard/exports page and confirm no rows contain `status` = `FLAGGED` or `INVALIDATED`.

- **Acknowledge / Resolve workflow:**
  - Use the `Acknowledge` button to mark alerts as `ACKNOWLEDGED` (optionally add note).
  - Use `Resolve Alert` to mark as `RESOLVED` and optionally disqualify affected vote sessions.
  - Check the Resolution Audit Log for `Resolved by` and note entries.

- **Notifications:**
  - The system will send simple Slack messages to `SLACK_WEBHOOK_URL` for `CRITICAL` alerts. Locally the notifier logs to the console.

- **CI verification:**
  - A GitHub Actions workflow has been added at `.github/workflows/verify-exports.yml`.
  - It runs `cd awardos && npm run verify:exports` when `VERIFY_DATABASE_URL` and `VERIFY_EVENT_ID` are configured in repository secrets.

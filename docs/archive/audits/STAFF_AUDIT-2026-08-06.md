# AwardOS — Staff-Level Audit Report

> **Historical audit snapshot.** Findings reflect the August 6 codebase and
> are not a current open-issues list.
**Phases 1 & 2 — Gap Analysis + Bug Hunting**
*Generated: 2026-08-06 | Reviewer: Senior Full-Stack / Cybersecurity Engineer*

---

## Phase 1 — Gap Analysis & Feature Alignment

### 1.1 Features Present vs. PRD

| PRD Area | PRD Requirement | Status |
|---|---|---|
| Auth (FR-AUTH-01/02) | Email + Google SSO | ✅ Done |
| Auth (FR-AUTH-03) | Session management via Supabase | ✅ Done |
| Auth (FR-AUTH-04) | Password reset flow | ⚠️ Route `/forgot-password` referenced in sign-in page but page/action not found in codebase |
| Auth (FR-AUTH-05) | Guest identity / anonymous vote | ✅ Done (cookie + sessionId) |
| Auth (FR-AUTH-06) | Account deletion + PII removal | ❌ Missing |
| Workspace (FR-WS-01/02) | Personal workspace auto-creation | ✅ Done |
| Workspace (FR-WS-03) | RBAC | ⚠️ Roles stored in DB but **not enforced** on server actions |
| Workspace (FR-WS-04) | Custom roles with permissions | ✅ Partial — UI and DB exist but permission check layer absent |
| Workspace (FR-WS-05) | Invite system | ✅ Done |
| Workspace (FR-WS-06) | Ownership transfer | ❌ Missing |
| Workspace (FR-WS-07) | Member removal | ✅ Done (but uses hard DELETE — see Bug #14) |
| Workspace (FR-WS-08) | Activity audit log | ⚠️ Table exists but nothing writes to it |
| Event (FR-EV-03) | Category CRUD | ✅ Done |
| Event (FR-EV-06) | Event duplication | ❌ Missing — no `duplicateEventAction` anywhere |
| Event (FR-EV-07) | Branding uploads | ✅ Done |
| Event (FR-EV-11) | Soft-delete with 30-day recovery | ⚠️ `deletedAt` field exists but no recovery UI or permanent-delete cron |
| Nomination (FR-NOM-04) | localStorage persistence | ✅ Done |
| Nomination (FR-NOM-07) | Real-time nomination counter | ⚠️ Uses polling, no WebSocket/SSE |
| Nomination (FR-NOM-09) | Eligibility requirements on form | ❌ Missing — DB field exists but form ignores it |
| AI Cleanup (FR-AI-06/07) | Batch approve/reject | ✅ Done |
| AI Cleanup (FR-AI-08) | Merge undo | ✅ Done |
| Voting (FR-VOT-03) | Confirmation page before submit | ✅ Review modal exists (see Bug #4 for UX issue) |
| Voting (FR-VOT-07) | Rate limiting | ⚠️ IP rate limit only in NONE mode — missing in OTP/CODE paths |
| Voting (FR-VOT-08) | Graceful deadline grace window | ❌ Missing |
| Verification (FR-VER-01) | Cookie+localStorage+IP+fingerprint | ⚠️ Fingerprint is IP+UA hash, not a real browser fingerprint |
| Verification (FR-VER-03) | Domain whitelist OTP | ✅ Done |
| Verification (FR-VER-05) | Lock method after first vote | ❌ Missing — organizer can change config after votes cast |
| Live Results (FR-LR-02) | Real-time updates via SSE/WebSocket | ❌ Missing |
| AI Assistant (FR-AA-01 to 06) | Event assistant chat | ❌ Missing — API route dir exists but no UI page |
| Integrity (FR-IM-04) | Bot detection via timing/scroll | ⚠️ Absent — only IP+UA clustering |
| Integrity (FR-IM-08) | Per-category integrity score | ❌ Missing — alerts are event-level only |
| Results (FR-RM-02) | Official results editable layer | ❌ Missing |
| Results (FR-RM-06) | Special awards | ❌ Missing |
| Analytics (FR-AN-03) | Traffic source breakdowns | ❌ Missing — no UTM tracking |
| Analytics (FR-AN-06) | Year-over-year comparison | ❌ Missing |
| Archive (FR-CA-01 to 05) | Community archive index | ❌ Missing |
| Export (FR-EX-01/02) | XLSX/CSV download | ⚠️ Action returns JSON — no file serializer wired |
| Export (FR-EX-03) | PDF report | ❌ Format accepted but payload always returned as JSON |
| Export (FR-EX-05) | Async export for >10k rows | ❌ Exports run synchronously, will timeout |
| Certificates | Certificate generation | ⚠️ Directory exists but no action or UI accessible |

---

### 1.2 "Vibecoded" (Unplanned) Features

| Feature | Current State | Integration Strategy |
|---|---|---|
| **Dev Bypass Cookie** (`awardos_dev_mode`) | Persists 7 days, bypasses all auth | CRITICAL — must be gated behind `NODE_ENV === "development"` only |
| **Frictionless voting mode** (`NONE` method) | Added in Voting Hub; cookie stored in localStorage only | Upgrade to HTTP-only server-set cookie (see Bug #5) |
| **Ballot Settings Modal** | Fully interactive, saves to DB | Good — needs RBAC guard for OWNER/ADMIN only |
| **Public Invite Landing** (`/invite/[token]`) | Works but doesn't redirect unauthenticated users back | Add `?redirect=/invite/[token]` to sign-in redirect |
| **Import action** (`src/actions/import.ts`) | Present but no UI routes to it | Wire to Import page or remove as dead code |
| **Analytics action** (`src/actions/analytics.ts`) | Exists; analytics page exists | Needs verification: real DB data vs. static mock? |

---

## Phase 2 — Bug Hunting & Root Cause Analysis

### BUG #1 — 🔴 Critical: Dev Bypass Cookie Active in Production

**What:** `enableDevBypassAction` sets `awardos_dev_mode=true` cookie, valid 7 days. Middleware skips ALL auth checks when present. No environment guard exists — any HTTP client can trigger this.

**Impact:** Full admin dashboard access without credentials for anyone who discovers the endpoint.

**Fix:**
```typescript
export const enableDevBypassAction = async () => {
  if (process.env.NODE_ENV === "production") {
    return redirect("/sign-in?error=Dev+mode+unavailable");
  }
  // ... rest of function
};
```

---

### BUG #2 — 🔴 Critical: Zero RBAC Enforcement on Server Actions

**What:** Server actions verify user identity and workspace membership, but **never check role**. A `VOLUNTEER` can call `triggerAICleanupAction`, `resolveAlertAction`, `createExportJobAction`, etc.

**Fix:** Reusable guard:
```typescript
// src/actions/_rbac.ts
export async function requireRole(allowedRoles: WorkspaceRole[], workspaceId: string, userId: string) {
  const member = await db.select().from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  if (!member[0] || !allowedRoles.includes(member[0].role)) {
    throw new Error("Unauthorized: insufficient role");
  }
}
```
Call at the top of every sensitive server action.

---

### BUG #3 — 🔴 Critical: IDOR on Integrity & Results Actions

**What:** `resolveAlertAction(alertId)`, `acknowledgeAlertAction(alertId)`, `quarantineSessionsAction`, `restoreSessionsAction`, `approveMergeSuggestionAction`, `rejectMergeSuggestionAction`, `revokeWorkspaceInviteAction` — all accept object IDs with **no workspace ownership validation**. Workspace A can mutate Workspace B's data if UUIDs are guessed.

**Fix (pattern for all affected actions):**
```typescript
const alert = await db.select().from(integrityAlerts)
  .innerJoin(events, eq(integrityAlerts.eventId, events.id))
  .where(and(
    eq(integrityAlerts.id, alertId),
    eq(events.workspaceId, workspace.id) // IDOR guard
  )).limit(1);
if (!alert[0]) throw new Error("Alert not found or unauthorized.");
```

---

### BUG #4 — 🟠 High: Review Modal Leaves User Stranded on Ballot Error

**What:** In `vote/page.tsx` — when `handleCastBallot()` throws an error, `setShowReviewModal(false)` is called, closing the modal. The user now sees the error banner but the "Submit Ballot" button is gone since the review modal was the only way to trigger it. User is forced to refresh and re-select all votes.

**Fix:**
```typescript
catch (err: any) {
  setError(err?.message || "An error occurred.");
  // REMOVE: setShowReviewModal(false);  <-- keep modal open for retry
}
```

---

### BUG #5 — 🔴 Critical: Frictionless Cookie Voting Uses Bypassable localStorage

**What:** When `verificationMethod === "NONE"`, vote deduplication uses `localStorage.setItem(`awardos_voted_${slug}`, ...)`. This is trivially bypassed by clearing localStorage, using incognito mode, or switching browsers. Server-side fingerprint (IP+UA hash) is also spoofable via User-Agent string changes.

**Fix:** Set a server-side HTTP-only cookie in the votes route on success:
```typescript
const response = NextResponse.json({ success: true, ... });
response.cookies.set(`awardos_voted_${slug}`, "1", {
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
});
return response;
```
And check for this cookie server-side on ballot page load.

---

### BUG #6 — 🟠 High: OTP Has No Rate Limit (Email Bomb Vector)

**What:** `sendEmailOtpAction` issues a new OTP every call with no limit per email+event+time. An attacker can spam any email address.

**Fix:**
```typescript
const recentOtps = await db.select().from(voterOtps)
  .where(and(
    eq(voterOtps.eventId, eventId),
    eq(voterOtps.email, cleanEmail),
    gt(voterOtps.expiresAt, new Date())
  ));
if (recentOtps.length >= 3) {
  throw new Error("Too many verification attempts. Please wait before requesting a new code.");
}
```

---

### BUG #7 — 🟠 High: OTP Codes Logged in Plaintext to Console

**What:** `sendEmailOtpAction` contains `console.log(`Sent verification OTP: ${code} to ${cleanEmail}`)`. Vercel production logs expose OTP codes to any team member with log access — and the codes are never actually emailed (no email provider integrated).

**Fix:** Remove the OTP from logs. Integrate a transactional email provider (Resend is recommended — simple API, generous free tier). Log only: `"OTP issued for: ${cleanEmail.split('@')[1]}"`.

---

### BUG #8 — 🟠 High: `hashIP` Uses Non-Cryptographic Hash (Collision-Prone)

**What:** `hashIP` in `src/lib/utils.ts` uses a djb2 bit-shift integer hash. The code itself has a comment saying `// use crypto.subtle in production`. Collisions can cause false "already voted" errors for legitimate users with shared IPs.

**Fix:**
```typescript
export async function hashIP(ip: string, salt: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
```
Note: This makes `hashIP` async — all callers in the votes route need `await`.

---

### BUG #9 — 🟠 High: Invitation Code Race Condition

**What:** The code status is checked (`status === "UNUSED"`) in the pre-ballot verify step, but not atomically locked. Two simultaneous requests with the same code can both pass the check before either marks it `USED`.

**Fix:** Inside the DB transaction in the votes route, use row-level locking when selecting the invitation code:
```typescript
// Drizzle syntax for row locking (when supported):
const codeList = await tx.select().from(invitationCodes)
  .where(and(eq(invitationCodes.code, cleanCode), eq(invitationCodes.status, "UNUSED")))
  .for("update") // Postgres FOR UPDATE — serializes concurrent reads
  .limit(1);
```

---

### BUG #10 — 🟠 High: Exports Generate No Actual Files

**What:** `createExportJobAction` builds a data `payload` array and returns it as JSON. The `format` parameter (`CSV`, `XLSX`, `PDF`) is accepted but completely ignored. No serialization library exists in the codebase. The UI will likely show a "Completed" job but no downloadable file.

**Fix:** Implement a dedicated export API route that:
1. Fetches data (same logic as current action)
2. Uses `xlsx` package (`xlsx.utils.json_to_sheet` → `xlsx.write`) for XLSX/CSV
3. Returns a proper `Content-Disposition: attachment` response for browser download

---

### BUG #11 — 🟡 Medium: N+1 Workspace Lookup on Every Server Action

**What:** Every action calls `getOrCreateWorkspaceAction()` which itself calls `getCurrentUser()` (Supabase auth round-trip) + 2 DB queries. This runs on **every** server action invocation, including those called repeatedly on the same page.

**Fix:** Wrap with Next.js `cache()` for request-scoped memoization:
```typescript
import { cache } from "react";
export const getCurrentUser = cache(async () => { ... });
export const getOrCreateWorkspaceAction = cache(async () => { ... });
```

---

### BUG #12 — 🟡 Medium: Write Operation in a Read Endpoint (Public Ballot Load)

**What:** `getPublicBallotDetailsAction` (called on every public ballot page load) unconditionally calls `ensureNomineesForRawNominationsAction` — which runs a DB transaction that may INSERT new nominees and UPDATE nomination records. This is a write operation in a read path. As nominations grow, this will slow every ballot page load significantly.

**Fix:** Remove the call from the read path. Trigger `ensureNomineesForRawNominationsAction` explicitly:
- After each nomination form submission (in nominations API route)
- When an organizer triggers AI cleanup
- NOT on every public page load

---

### BUG #13 — ✅ Fixed: Modal Overflow Clipping

The Ballot Settings modal no longer clips or requires body scroll. Fixed in prior session with `max-h-[85vh]` internal scrolling and proper sticky header anchoring.

---

### BUG #14 — 🟡 Medium: Member Removal Uses Hard DELETE

**What:** `removeWorkspaceMemberAction` calls `db.delete(workspaceMembers)`. The `memberStatus` enum has a `REMOVED` value for soft-removal. Hard deletes destroy audit trail context.

**Fix:**
```typescript
await db.update(workspaceMembers)
  .set({ status: "REMOVED" })
  .where(eq(workspaceMembers.id, memberId));
```

---

### BUG #15 — 🟡 Medium: IDOR on Invite Revocation

**What:** `revokeWorkspaceInviteAction(inviteId)` deletes by primary key only, with no workspace ownership check.

**Fix:**
```typescript
await db.delete(workspaceInvites)
  .where(and(
    eq(workspaceInvites.id, inviteId),
    eq(workspaceInvites.workspaceId, workspace.id)
  ));
```

---

### BUG #16 — 🟡 Medium: No XSS Sanitization on Nomination Text

**What:** `nomineeText` is stored from the request body with only `.trim()`. If nominee names ever reach `dangerouslySetInnerHTML` or PDF/certificate output, this is an XSS vector.

**Fix:**
```typescript
import { stripHtml } from "string-strip-html";
const cleanText = stripHtml(nom.nomineeText.trim()).result.slice(0, 200);
```

---

### BUG #17 — 🟡 Medium: N+1 Queries in Bulk Approve Action

**What:** `bulkApproveMergeSuggestionsAction` executes a per-suggestion loop of SELECT + SELECT + INSERT/UPDATE + loop-UPDATE + UPDATE = 5+ queries per suggestion. For 50 suggestions × 5 source names = 300+ queries in one transaction.

**Fix:** Batch collect all nominees to upsert → batch-insert → single `inArray()` update for nominations → single `inArray()` update for suggestion statuses.

---

## Summary Priority Matrix

| # | Bug | Severity | Effort |
|---|---|---|---|
| 1 | Dev bypass cookie in production | 🔴 Critical | Low |
| 2 | Zero RBAC on server actions | 🔴 Critical | High |
| 3 | IDOR on 6+ actions | 🔴 Critical | Medium |
| 5 | localStorage-only vote deduplication | 🔴 Critical | Medium |
| 6 | OTP email bomb — no rate limit | 🟠 High | Low |
| 7 | OTP in plaintext logs | 🟠 High | Low |
| 4 | Review modal strands user on error | 🟠 High | Low |
| 8 | Non-cryptographic fingerprint hash | 🟠 High | Low |
| 9 | Invitation code race condition | 🟠 High | Medium |
| 10 | Exports produce no downloadable files | 🟠 High | High |
| 11 | N+1 workspace lookup per action | 🟡 Medium | Low |
| 12 | Write in read path on ballot load | 🟡 Medium | Medium |
| 14 | Hard-delete on member removal | 🟡 Medium | Low |
| 15 | IDOR on invite revocation | 🟡 Medium | Low |
| 16 | No XSS sanitization on nominations | 🟡 Medium | Low |
| 17 | N+1 in bulk approve action | 🟡 Medium | Medium |
| 13 | Modal scroll ✅ Fixed | — | Done |

---

## Missing Feature Priority (Phase 1)

| Feature | PRD Ref | Priority |
|---|---|---|
| Forgot-password page + action | FR-AUTH-04 | 🔴 Must (broken link exists in UI) |
| RBAC enforcement on all actions | FR-WS-03 | 🔴 Must |
| HTTP-only voted cookie (server-set) | FR-VER-01 | 🔴 Must |
| Real email sending for OTP (Resend/SendGrid) | FR-VER-02 | 🔴 Must |
| Account deletion flow | FR-AUTH-06 | 🟠 High |
| Actual XLSX/CSV file download | FR-EX-01/02 | 🟠 High |
| Event duplication | FR-EV-06 | 🟠 High |
| Workspace ownership transfer | FR-WS-06 | 🟠 High |
| Official results management UI | FR-RM-02 | 🟠 High |
| AI Assistant chat UI | FR-AA-01+ | 🟡 Medium |
| Community archive index | FR-CA-03 | 🟡 Medium |
| Live results SSE/polling | FR-LR-02 | 🟡 Medium |
| Per-category integrity scoring | FR-IM-08 | 🟡 Medium |
| Nomination eligibility enforcement | FR-NOM-09 | 🟡 Medium |

---

> **Awaiting your approval to proceed to Phase 3 (UI Standardization & Performance), Phase 4 (full cybersecurity deep-dive), and Phase 5 (Refactoring Execution Plan).**

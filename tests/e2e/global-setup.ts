import postgres from "postgres";
import { randomUUID } from "node:crypto";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

export default async function globalSetup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error("TEST_DATABASE_URL is required for browser tests.");
  if (testUrl === process.env.MAIN_DATABASE_URL) {
    throw new Error("Browser tests refuse to use the main database.");
  }

  const runId = randomUUID().replaceAll("-", "").slice(0, 12);
  const workspaceSlug = `e2e-awardos-${runId}`;
  const nominationSlug = `e2e-${runId}-nominations`;
  const ballotSlug = `e2e-${runId}-ballot`;
  const invitationSlug = `e2e-${runId}-invitation`;
  const otpSlug = `e2e-${runId}-otp`;
  const deletedSlug = `e2e-${runId}-deleted`;
  const desktopInvitationCode = `D${runId.slice(0, 9)}`.toUpperCase();
  const mobileInvitationCode = `M${runId.slice(0, 9)}`.toUpperCase();
  const workspaceInviteToken = `inv_e2e_${runId}`;

  const sql = postgres(testUrl, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into users (id, email, display_name, auth_provider, email_verified)
        values (${DEV_USER_ID}, 'e2e-owner@awardos.test', 'E2E Owner', 'EMAIL', true)
        on conflict (id) do update set email = excluded.email, display_name = excluded.display_name
      `;
      const [workspace] = await tx<{ id: string }[]>`
        insert into workspaces (name, slug, type, created_by)
        values (${`AwardOS browser tests ${runId}`}, ${workspaceSlug}, 'ORGANIZATION', ${DEV_USER_ID})
        returning id
      `;
      await tx`
        insert into workspace_members (workspace_id, user_id, role, status, accepted_at)
        values (${workspace.id}, ${DEV_USER_ID}, 'OWNER', 'ACTIVE', now())
      `;
      await tx`
        insert into workspace_invites (
          workspace_id, role, token, max_uses, uses_count, expires_at, created_by
        ) values (
          ${workspace.id}, 'EVENT_MANAGER', ${workspaceInviteToken}, 2, 0,
          now() + interval '1 day', ${DEV_USER_ID}
        )
      `;

      await seedEvent(tx, workspace.id, {
        slug: nominationSlug,
        name: `E2E Nomination Awards ${runId}`,
        method: "NONE",
        stage: "NOMINATIONS",
      });
      const ballotEvent = await seedEvent(tx, workspace.id, {
        slug: ballotSlug,
        name: `E2E Public Ballot ${runId}`,
        method: "NONE",
        stage: "VOTING",
      });
      const [ballotNominee] = await tx<{ id: string }[]>`
        select id from nominees where event_id = ${ballotEvent} order by display_order asc limit 1
      `;
      const [ballotCategory] = await tx<{ id: string }[]>`
        select id from categories where event_id = ${ballotEvent} order by display_order asc limit 1
      `;
      const [seededSession] = await tx<{ id: string }[]>`
        insert into vote_sessions (
          event_id, session_token, device_fingerprint, ip_address, user_agent,
          verification_method, submitted_at, time_spent_ms, categories_voted,
          categories_skipped, status
        ) values (
          ${ballotEvent}, ${`e2e-seeded-ballot-${runId}`}, ${`e2e-seeded-device-${runId}`},
          '203.0.113.10', 'Mozilla/5.0 (Linux; Android 14) AwardOS-E2E', 'NONE',
          now(), 42000, 1, 0, 'SUBMITTED'
        ) returning id
      `;
      await tx`
        insert into votes (vote_session_id, event_id, category_id, nominee_id, skipped)
        values (${seededSession.id}, ${ballotEvent}, ${ballotCategory.id}, ${ballotNominee.id}, false)
      `;
      await tx`
        insert into archive_configs (event_id, show_nominees, show_winners, is_public, updated_by)
        values (${ballotEvent}, true, false, true, ${DEV_USER_ID})
      `;
      await tx`
        insert into suggested_categories (event_id, suggestion_text, session_id)
        values (${ballotEvent}, 'Community champion', ${`e2e-suggestion-${runId}`})
      `;
      const invitationEvent = await seedEvent(tx, workspace.id, {
        slug: invitationSlug,
        name: `E2E Invitation Ballot ${runId}`,
        method: "INVITATION_CODE",
        stage: "VOTING",
      });
      await tx`
        insert into invitation_codes (event_id, code, status, expires_at)
        values
          (${invitationEvent}, ${desktopInvitationCode}, 'UNUSED', now() + interval '1 day'),
          (${invitationEvent}, ${mobileInvitationCode}, 'UNUSED', now() + interval '1 day')
      `;
      const deletedEvent = await seedEvent(tx, workspace.id, {
        slug: deletedSlug,
        name: `E2E Recoverable Event ${runId}`,
        method: "NONE",
        stage: "NOMINATIONS",
      });
      await tx`update events set deleted_at = now(), updated_at = now() where id = ${deletedEvent}`;
      if (process.env.E2E_OTP_EMAIL) {
        await seedEvent(tx, workspace.id, {
          slug: otpSlug,
          name: `E2E Email OTP Ballot ${runId}`,
          method: "EMAIL_OTP",
          stage: "VOTING",
        });
        process.env.E2E_OTP_SLUG = otpSlug;
      }

      process.env.E2E_WORKSPACE_ID = workspace.id;
      process.env.E2E_WORKSPACE_SLUG = workspaceSlug;
      process.env.E2E_WORKSPACE_INVITE_TOKEN = workspaceInviteToken;
      process.env.E2E_NOMINATION_SLUG = nominationSlug;
      process.env.E2E_BALLOT_SLUG = ballotSlug;
      process.env.E2E_BALLOT_EVENT_ID = ballotEvent;
      process.env.E2E_BALLOT_NOMINEE_ID = ballotNominee.id;
      process.env.E2E_INVITATION_SLUG = invitationSlug;
      process.env.E2E_INVITATION_EVENT_ID = invitationEvent;
      process.env.E2E_DESKTOP_INVITATION_CODE = desktopInvitationCode;
      process.env.E2E_MOBILE_INVITATION_CODE = mobileInvitationCode;
      process.env.E2E_BALLOT_EVENT_NAME = `E2E Public Ballot ${runId}`;
      process.env.E2E_DELETED_EVENT_NAME = `E2E Recoverable Event ${runId}`;
    });
  } finally {
    await sql.end();
  }
}

async function seedEvent(
  tx: postgres.TransactionSql,
  workspaceId: string,
  fixture: {
    slug: string;
    name: string;
    method: "NONE" | "EMAIL_OTP" | "INVITATION_CODE";
    stage: "NOMINATIONS" | "VOTING";
  },
) {
  const [event] = await tx<{ id: string }[]>`
    insert into events (
      workspace_id, name, slug, description, status, visibility,
      verification_config, created_by
    ) values (
      ${workspaceId}, ${fixture.name}, ${fixture.slug},
      'Deterministic release-gate fixture.', 'ACTIVE', 'UNLISTED',
      ${tx.json({ method: fixture.method })}, ${DEV_USER_ID}
    ) returning id
  `;
  await tx`
    insert into workflow_stages (event_id, stage_type, display_name, display_order, status)
    values (${event.id}, ${fixture.stage}, ${fixture.stage === "VOTING" ? "Voting" : "Nominations"}, 1, 'ACTIVE')
  `;
  const [category] = await tx<{ id: string }[]>`
    insert into categories (event_id, name, description, display_order, is_active)
    values (${event.id}, 'Community impact', 'Recognizes measurable service to the community.', 1, true)
    returning id
  `;
  await tx`
    insert into nominees (event_id, category_id, name, normalized_name, bio, display_order, status)
    values
      (${event.id}, ${category.id}, 'Amara Okafor', 'amara okafor', 'Led a year-long community literacy program.', 1, 'ACTIVE'),
      (${event.id}, ${category.id}, 'David Mensah', 'david mensah', 'Organized free weekend technology workshops.', 2, 'ACTIVE')
  `;
  return event.id;
}

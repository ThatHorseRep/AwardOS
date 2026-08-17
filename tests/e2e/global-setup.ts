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
  const invitationCode = `A${runId.slice(0, 9)}`.toUpperCase();

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

      await seedEvent(tx, workspace.id, {
        slug: nominationSlug,
        name: `E2E Nomination Awards ${runId}`,
        method: "NONE",
        stage: "NOMINATIONS",
      });
      await seedEvent(tx, workspace.id, {
        slug: ballotSlug,
        name: `E2E Public Ballot ${runId}`,
        method: "NONE",
        stage: "VOTING",
      });
      const invitationEvent = await seedEvent(tx, workspace.id, {
        slug: invitationSlug,
        name: `E2E Invitation Ballot ${runId}`,
        method: "INVITATION_CODE",
        stage: "VOTING",
      });
      await tx`
        insert into invitation_codes (event_id, code, status, expires_at)
        values (${invitationEvent}, ${invitationCode}, 'UNUSED', now() + interval '1 day')
      `;
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
      process.env.E2E_NOMINATION_SLUG = nominationSlug;
      process.env.E2E_BALLOT_SLUG = ballotSlug;
      process.env.E2E_INVITATION_SLUG = invitationSlug;
      process.env.E2E_INVITATION_CODE = invitationCode;
      process.env.E2E_BALLOT_EVENT_NAME = `E2E Public Ballot ${runId}`;
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

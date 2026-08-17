import postgres from "postgres";

export default async function globalTeardown() {
  const testUrl = process.env.TEST_DATABASE_URL;
  const workspaceSlug = process.env.E2E_WORKSPACE_SLUG;
  if (!testUrl || testUrl === process.env.MAIN_DATABASE_URL || !workspaceSlug) return;

  const sql = postgres(testUrl, { max: 1 });
  try {
    await sql`delete from workspaces where slug = ${workspaceSlug}`;
  } finally {
    await sql.end();
  }
}

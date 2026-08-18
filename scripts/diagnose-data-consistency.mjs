import "dotenv/config";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local", override: false });

const useTestDatabase = process.argv.includes("--test");
const connectionString = useTestDatabase
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(useTestDatabase ? "TEST_DATABASE_URL is not set." : "DATABASE_URL is not set.");
}

const sql = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
});

try {
  const report = await sql.begin(async (tx) => {
    await tx`set transaction read only`;

    const accounting = await tx`
      with session_totals as (
        select
          e.id as event_id,
          e.name as event_name,
          count(vs.id) filter (where vs.status = 'SUBMITTED')::int as submitted_ballots,
          coalesce(sum(vs.categories_voted) filter (where vs.status = 'SUBMITTED'), 0)::int as stored_selected,
          coalesce(sum(vs.categories_skipped) filter (where vs.status = 'SUBMITTED'), 0)::int as stored_skipped
        from events e
        left join vote_sessions vs on vs.event_id = e.id
        where e.deleted_at is null
        group by e.id, e.name
      ), response_totals as (
        select
          e.id as event_id,
          count(v.id) filter (where vs.status = 'SUBMITTED')::int as response_rows,
          count(v.id) filter (
            where vs.status = 'SUBMITTED' and v.skipped is not true and v.nominee_id is not null
          )::int as selected_rows,
          count(v.id) filter (
            where vs.status = 'SUBMITTED' and (v.skipped is true or v.nominee_id is null)
          )::int as skipped_rows
        from events e
        left join vote_sessions vs on vs.event_id = e.id
        left join votes v on v.vote_session_id = vs.id
        where e.deleted_at is null
        group by e.id
      )
      select s.*, r.response_rows, r.selected_rows, r.skipped_rows,
        (r.response_rows - s.submitted_ballots)::int as legacy_vote_count_overstatement,
        (s.stored_selected - r.selected_rows)::int as selected_metadata_delta,
        (s.stored_skipped - r.skipped_rows)::int as skipped_metadata_delta
      from session_totals s
      join response_totals r on r.event_id = s.event_id
      where r.response_rows <> s.submitted_ballots
         or s.stored_selected <> r.selected_rows
         or s.stored_skipped <> r.skipped_rows
      order by abs(r.response_rows - s.submitted_ballots) desc, s.event_name
    `;

    const cleanup = await tx`
      with approved as (
        select id, event_id, category_id, source_nominees, suggested_name
        from ai_merge_suggestions
        where status = 'APPROVED'
      ), resolution as (
        select
          a.id as suggestion_id,
          a.event_id,
          e.name as event_name,
          a.category_id,
          c.name as category_name,
          a.suggested_name,
          count(n.id)::int as matching_nominations,
          count(n.id) filter (where n.resolved_nominee_id is null)::int as unresolved_nominations,
          count(distinct n.resolved_nominee_id) filter (where n.resolved_nominee_id is not null)::int as canonical_targets
        from approved a
        join events e on e.id = a.event_id
        join categories c on c.id = a.category_id
        left join nominations n
          on n.event_id = a.event_id
         and n.category_id = a.category_id
         and n.nominee_text in (select jsonb_array_elements_text(a.source_nominees))
        group by a.id, a.event_id, e.name, a.category_id, c.name, a.suggested_name
      ), count_mismatches as (
        select
          nom.id as nominee_id,
          nom.event_id,
          e.name as event_name,
          nom.category_id,
          c.name as category_name,
          nom.name as nominee_name,
          nom.nomination_count as stored_count,
          count(n.id)::int as resolved_count
        from nominees nom
        join events e on e.id = nom.event_id
        join categories c on c.id = nom.category_id
        left join nominations n on n.resolved_nominee_id = nom.id and n.is_latest is true
        group by nom.id, nom.event_id, e.name, nom.category_id, c.name, nom.name, nom.nomination_count
        having nom.nomination_count <> count(n.id)::int
      )
      select jsonb_build_object(
        'approvedResolutionProblems', coalesce((
          select jsonb_agg(to_jsonb(r) order by r.event_name, r.category_name)
          from resolution r
          where r.matching_nominations = 0
             or r.unresolved_nominations > 0
             or r.canonical_targets <> 1
        ), '[]'::jsonb),
        'nominationCountMismatches', coalesce((
          select jsonb_agg(to_jsonb(m) order by m.event_name, m.category_name, m.nominee_name)
          from count_mismatches m
        ), '[]'::jsonb),
        'mergedNomineesWithoutTarget', coalesce((
          select jsonb_agg(jsonb_build_object(
            'eventId', nom.event_id,
            'eventName', e.name,
            'categoryId', nom.category_id,
            'categoryName', c.name,
            'nomineeId', nom.id,
            'nomineeName', nom.name
          ) order by e.name, c.name, nom.name)
          from nominees nom
          join events e on e.id = nom.event_id
          join categories c on c.id = nom.category_id
          where nom.status = 'MERGED' and nom.merged_into is null
        ), '[]'::jsonb)
      ) as result
    `;

    const results = await tx`
      with eligible_counts as (
        select
          n.event_id,
          n.category_id,
          n.id as nominee_id,
          n.name as nominee_name,
          n.status,
          count(v.id) filter (where vs.status = 'SUBMITTED')::int as canonical_votes
        from nominees n
        left join votes v on v.nominee_id = n.id and v.skipped is not true
        left join vote_sessions vs on vs.id = v.vote_session_id
        group by n.event_id, n.category_id, n.id, n.name, n.status
      ), ranked as (
        select
          ec.*,
          case when ec.status not in ('DISQUALIFIED', 'MERGED', 'REMOVED')
            then rank() over (
              partition by ec.event_id, ec.category_id,
                (ec.status not in ('DISQUALIFIED', 'MERGED', 'REMOVED'))
              order by ec.canonical_votes desc, ec.nominee_id
            )::int
            else null
          end as canonical_rank,
          sum(ec.canonical_votes) filter (
            where ec.status not in ('DISQUALIFIED', 'MERGED', 'REMOVED')
          ) over (partition by ec.event_id, ec.category_id)::int as eligible_denominator
        from eligible_counts ec
      )
      select
        e.id as event_id,
        e.name as event_name,
        e.live_results_mode,
        c.id as category_id,
        c.name as category_name,
        r.nominee_id,
        r.nominee_name,
        r.status as nominee_status,
        o.raw_vote_count,
        o.adjusted_vote_count,
        o.final_rank,
        o.is_winner,
        o.is_disqualified,
        r.canonical_votes,
        r.canonical_rank,
        r.eligible_denominator
      from ranked r
      join events e on e.id = r.event_id
      join categories c on c.id = r.category_id
      join official_results o
        on o.event_id = r.event_id and o.category_id = r.category_id and o.nominee_id = r.nominee_id
      where o.raw_vote_count <> r.canonical_votes
         or (o.override_rank is null and o.final_rank is distinct from r.canonical_rank)
         or o.is_disqualified <> (r.status = 'DISQUALIFIED')
         or (o.override_rank is null and o.is_winner <> (r.canonical_rank = 1))
      order by e.name, c.name, r.canonical_rank nulls last, r.nominee_name
    `;

    const resultCategories = await tx`
      with category_votes as (
        select
          e.id as event_id,
          e.name as event_name,
          e.live_results_mode,
          c.id as category_id,
          c.name as category_name,
          count(v.id) filter (where vs.status = 'SUBMITTED')::int as current_denominator,
          count(v.id) filter (
            where vs.status = 'SUBMITTED'
              and n.status not in ('DISQUALIFIED', 'MERGED', 'REMOVED')
          )::int as eligible_denominator,
          count(v.id) filter (
            where vs.status = 'SUBMITTED'
              and n.status in ('DISQUALIFIED', 'MERGED', 'REMOVED')
          )::int as excluded_votes
        from events e
        join categories c on c.event_id = e.id
        left join nominees n on n.category_id = c.id
        left join votes v on v.nominee_id = n.id and v.skipped is not true
        left join vote_sessions vs on vs.id = v.vote_session_id
        group by e.id, e.name, e.live_results_mode, c.id, c.name
      )
      select *
      from category_votes
      where current_denominator <> eligible_denominator
      order by event_name, category_name
    `;

    const workflow = await tx`
      with stage_summary as (
        select
          e.id as event_id,
          e.name as event_name,
          e.status as event_status,
          count(ws.id) filter (where ws.status = 'ACTIVE')::int as active_stage_count,
          count(ws.id) filter (where ws.starts_at is not null and ws.ends_at is not null and ws.starts_at >= ws.ends_at)::int as invalid_windows,
          jsonb_agg(jsonb_build_object(
            'stageId', ws.id,
            'type', ws.stage_type,
            'status', ws.status,
            'startsAt', ws.starts_at,
            'endsAt', ws.ends_at
          ) order by ws.display_order) filter (where ws.id is not null) as stages
        from events e
        left join workflow_stages ws on ws.event_id = e.id
        where e.deleted_at is null
        group by e.id, e.name, e.status
      ), stage_overlaps as (
        select distinct n.event_id
        from workflow_stages n
        join workflow_stages v on v.event_id = n.event_id and v.stage_type = 'VOTING'
        where n.stage_type = 'NOMINATIONS'
          and n.starts_at is not null and n.ends_at is not null
          and v.starts_at is not null and v.ends_at is not null
          and tstzrange(n.starts_at, n.ends_at, '[]') && tstzrange(v.starts_at, v.ends_at, '[]')
      )
      select s.*,
        exists(select 1 from stage_overlaps o where o.event_id = s.event_id) as nomination_voting_overlap
      from stage_summary s
      where s.active_stage_count > 1
         or (s.event_status = 'ACTIVE' and s.active_stage_count = 0)
         or (s.event_status = 'COMPLETED' and s.active_stage_count > 0)
         or s.invalid_windows > 0
         or exists(select 1 from stage_overlaps o where o.event_id = s.event_id)
      order by s.event_name
    `;

    return {
      generatedAt: new Date().toISOString(),
      database: useTestDatabase ? "test" : "configured-primary",
      accounting,
      cleanup: cleanup[0]?.result ?? {},
      results: {
        officialRowDeltas: results,
        categoryDenominatorChanges: resultCategories,
      },
      workflow,
    };
  });

  console.log(JSON.stringify(report, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}

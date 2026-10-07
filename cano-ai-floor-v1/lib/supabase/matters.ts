import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
  supabaseUpsert,
} from "./rest";

export type DbMatter = {
  id: string;
  monday_item_id: string;
  matter_name: string | null;
  detainee_name: string | null;
  pnc_name: string | null;
  practice_area: string | null;
  matter_type: string | null;
  assigned_attorney: string | null;
  status: string;
  current_route: string | null;
  routed_by: string | null;
  routed_at: string | null;
  latest_case_brain_snapshot_id: string | null;
  monday_data: Record<string, any> | null;
  created_at: string;
  pipeline_status?: string | null;
  pipeline_stage?: string | null;
  pipeline_next_agent?: string | null;
  pipeline_auto_enabled?: boolean | null;
  updated_at: string;
};

export type DbSnapshot = {
  id: string;
  matter_id: string;
  monday_item_id: string;
  schema_version: string;
  trigger_type: string;
  analysis: Record<string, any>;
  recommended_specialist: string | null;
  attorney_review_required: boolean | null;
  ready_for_specialist: boolean | null;
  missing_information_count: number;
  contradictions_count: number;
  created_at: string;
};

export type DbAssignment = {
  id: string;
  matter_id: string;
  monday_item_id: string;
  agent_id: string;
  agent_name: string;
  assignment_type: string | null;
  status: string;
  assigned_by: string;
  notes: string | null;
  assigned_at: string;
  completed_at: string | null;
};

export async function getMatterByMondayId(mondayItemId: string) {
  const rows = await supabaseSelect<DbMatter>("ai_matters", {
    select: "*",
    monday_item_id: `eq.${mondayItemId}`,
    limit: 1,
  });

  return rows[0] || null;
}

export async function getMatterById(id: string) {
  const rows = await supabaseSelect<DbMatter>("ai_matters", {
    select: "*",
    id: `eq.${id}`,
    limit: 1,
  });

  return rows[0] || null;
}

export async function getLatestMatter() {
  const rows = await supabaseSelect<DbMatter>("ai_matters", {
    select: "*",
    order: "updated_at.desc",
    limit: 1,
  });

  return rows[0] || null;
}

export async function getAllMatters(limit = 100) {
  return supabaseSelect<DbMatter>("ai_matters", {
    select: "*",
    order: "updated_at.desc",
    limit,
  });
}

export async function getSnapshotById(id?: string | null) {
  if (!id) return null;

  const rows = await supabaseSelect<DbSnapshot>("case_brain_snapshots", {
    select: "*",
    id: `eq.${id}`,
    limit: 1,
  });

  return rows[0] || null;
}

export async function getLatestAssignment(matterId: string) {
  const rows = await supabaseSelect<DbAssignment>("agent_assignments", {
    select: "*",
    matter_id: `eq.${matterId}`,
    order: "assigned_at.desc",
    limit: 1,
  });

  return rows[0] || null;
}

export async function upsertMatter(payload: Record<string, any>) {
  const rows = await supabaseUpsert<DbMatter>(
    "ai_matters",
    payload,
    "monday_item_id"
  );

  return rows[0] || null;
}

export async function insertSnapshot(payload: Record<string, any>) {
  const rows = await supabaseInsert<DbSnapshot>(
    "case_brain_snapshots",
    payload
  );

  return rows[0] || null;
}

export async function updateMatter(
  matterId: string,
  payload: Record<string, any>
) {
  const rows = await supabaseUpdate<DbMatter>(
    "ai_matters",
    { id: `eq.${matterId}` },
    payload
  );

  return rows[0] || null;
}

export async function insertActivity(payload: Record<string, any>) {
  const rows = await supabaseInsert("matter_activity", payload);
  return rows[0] || null;
}

export async function insertAssignment(payload: Record<string, any>) {
  const rows = await supabaseInsert<DbAssignment>(
    "agent_assignments",
    payload
  );

  return rows[0] || null;
}

export async function insertPipelineEvent(payload: Record<string, any>) {
  const rows = await supabaseInsert(
    "matter_pipeline_events",
    payload
  );

  return rows[0] || null;
}

/*
|--------------------------------------------------------------------------
| RESILIENT MATTER BUILD
|--------------------------------------------------------------------------
|
| Assignment metadata is helpful, but it is not required to open Case Brain,
| Scribe, or specialist workstations.
|
| Previously one failing agent_assignments query caused the entire /api/matters
| response to fail, which cleared the active matter in the browser. Because
| Scribe requires caseBrainMatter, that made Draft Manager look "locked".
|
| Snapshot remains the authoritative Case Brain record.
|--------------------------------------------------------------------------
*/

export async function buildStoredMatter(matter: DbMatter | null) {
  if (!matter) return null;

  let snapshot: DbSnapshot | null = null;
  let assignment: DbAssignment | null = null;

  try {
    snapshot = await getSnapshotById(
      matter.latest_case_brain_snapshot_id
    );
  } catch (error) {
    console.error(
      `Unable to load Case Brain snapshot for matter ${matter.id}:`,
      error
    );
  }

  try {
    assignment = await getLatestAssignment(
      matter.id
    );
  } catch (error) {
    console.error(
      `Unable to load latest assignment for matter ${matter.id}:`,
      error
    );
  }

  return {
    databaseId: matter.id,
    matterId: matter.monday_item_id,
    mondayItemId: matter.monday_item_id,
    caseBrainStatus: matter.status,
    savedAt: snapshot?.created_at || matter.updated_at,

    monday: {
      found: true,
      preview: matter.monday_data?.preview || null,
      raw: matter.monday_data || null,
    },

    caseBrain:
      snapshot?.analysis || {},

    routing: matter.current_route
      ? {
          target:
            matter.current_route,

          routedBy:
            matter.routed_by ||
            "Santiago",

          routedAt:
            matter.routed_at ||
            matter.updated_at,

          assignmentId:
            assignment?.id ||
            null,

          status:
            assignment?.status ||
            "assigned",
        }
      : null,

    pipeline: {
      status:
        matter.pipeline_status ||
        "idle",

      stage:
        matter.pipeline_stage ||
        null,

      nextAgent:
        matter.pipeline_next_agent ||
        null,

      autoEnabled:
        matter.pipeline_auto_enabled !==
        false,
    },
  };
}

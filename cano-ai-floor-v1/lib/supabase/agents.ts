import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "./rest";

export type SpecialistAgentId =
  | "habeas"
  | "bond"
  | "research"
  | "timeline"
  | "qa"
  | "hearing"
  | "synthesis"
  | "drafting";

export type DbAgentRun = {
  id: string;
  matter_id: string;
  monday_item_id: string;
  agent_id: SpecialistAgentId;
  agent_name: string;
  trigger_type: string;
  status: string;
  input_payload: Record<string, any>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

export type DbAgentOutput = {
  id: string;
  run_id: string;
  matter_id: string;
  monday_item_id: string;
  agent_id: SpecialistAgentId;
  schema_version: string;
  output: Record<string, any>;
  created_at: string;
};

export const SPECIALIST_AGENTS: Record<
  SpecialistAgentId,
  {
    name: string;
    routeLabel: string;
  }
> = {
  habeas: { name: "Elena", routeLabel: "Elena · Habeas" },
  bond: { name: "Mateo", routeLabel: "Mateo · Bond" },
  research: { name: "Lex", routeLabel: "Lex · Research" },
  timeline: { name: "Chronos", routeLabel: "Chronos · Timeline" },
  qa: { name: "Veritas", routeLabel: "Veritas · Filing QA" },
  hearing: { name: "Avery", routeLabel: "Avery · Hearing Prep" },
  synthesis: {
    name: "Atlas",
    routeLabel: "Atlas · Matter Intelligence",
  },
  drafting: {
    name: "Scribe",
    routeLabel: "Scribe · Legal Drafting",
  },
};

export function isSpecialistAgentId(value: string): value is SpecialistAgentId {
  return Object.prototype.hasOwnProperty.call(SPECIALIST_AGENTS, value);
}

export async function insertAgentRun(payload: Record<string, any>) {
  const rows = await supabaseInsert<DbAgentRun>("agent_runs", payload);
  return rows[0] || null;
}

export async function updateAgentRun(
  runId: string,
  payload: Record<string, any>
) {
  const rows = await supabaseUpdate<DbAgentRun>(
    "agent_runs",
    { id: `eq.${runId}` },
    payload
  );

  return rows[0] || null;
}

export async function getAgentRun(runId: string) {
  const rows = await supabaseSelect<DbAgentRun>("agent_runs", {
    select: "*",
    id: `eq.${runId}`,
    limit: 1,
  });

  return rows[0] || null;
}

export async function insertAgentOutput(payload: Record<string, any>) {
  const rows = await supabaseInsert<DbAgentOutput>("agent_outputs", payload);
  return rows[0] || null;
}

export async function getOutputForRun(runId: string) {
  const rows = await supabaseSelect<DbAgentOutput>("agent_outputs", {
    select: "*",
    run_id: `eq.${runId}`,
    limit: 1,
  });

  return rows[0] || null;
}

export async function getLatestOutputForAgent(
  matterId: string,
  agentId: SpecialistAgentId
) {
  const rows = await supabaseSelect<DbAgentOutput>("agent_outputs", {
    select: "*",
    matter_id: `eq.${matterId}`,
    agent_id: `eq.${agentId}`,
    order: "created_at.desc",
    limit: 1,
  });

  return rows[0] || null;
}

export async function getLatestRunForAgent(
  matterId: string,
  agentId: SpecialistAgentId
) {
  const rows = await supabaseSelect<DbAgentRun>("agent_runs", {
    select: "*",
    matter_id: `eq.${matterId}`,
    agent_id: `eq.${agentId}`,
    order: "started_at.desc",
    limit: 1,
  });

  return rows[0] || null;
}

/*
|--------------------------------------------------------------------------
| BATCHED SPECIALIST STATE
|--------------------------------------------------------------------------
|
| Old behavior:
|   8 agents x (1 agent_runs query + 1 agent_outputs query)
|   = 16 PostgREST requests PER MATTER.
|
| /api/matters loads many matters at once, so this could explode into hundreds
| or thousands of simultaneous Supabase requests and trigger intermittent
| transaction/connection failures.
|
| New behavior:
|   1 agent_runs query + 1 agent_outputs query PER MATTER.
|
| We sort descending, then take the first row for each agent.
|--------------------------------------------------------------------------
*/

export async function getLatestSpecialistState(matterId: string) {
  const result: Record<string, any> = {};

  for (const agentId of Object.keys(SPECIALIST_AGENTS) as SpecialistAgentId[]) {
    result[agentId] = {
      run: null,
      output: null,
      outputRecord: null,
    };
  }

  let runs: DbAgentRun[] = [];
  let outputs: DbAgentOutput[] = [];

  try {
    [runs, outputs] = await Promise.all([
      supabaseSelect<DbAgentRun>("agent_runs", {
        select: "*",
        matter_id: `eq.${matterId}`,
        order: "started_at.desc",
        limit: 250,
      }),

      supabaseSelect<DbAgentOutput>("agent_outputs", {
        select: "*",
        matter_id: `eq.${matterId}`,
        order: "created_at.desc",
        limit: 250,
      }),
    ]);
  } catch (error) {
    /*
    | Do not let specialist-history failure take down the entire Matter Center.
    | The matter itself is still usable; agents can be refreshed after the
    | database recovers.
    */
    console.error(
      `Unable to load specialist history for matter ${matterId}:`,
      error
    );

    return result;
  }

  for (const run of runs) {
    const agentId = run?.agent_id;

    if (
      isSpecialistAgentId(agentId) &&
      !result[agentId].run
    ) {
      result[agentId].run = run;
    }
  }

  for (const outputRecord of outputs) {
    const agentId = outputRecord?.agent_id;

    if (
      isSpecialistAgentId(agentId) &&
      !result[agentId].outputRecord
    ) {
      result[agentId].outputRecord = outputRecord;
      result[agentId].output = outputRecord?.output || null;
    }
  }

  return result;
}

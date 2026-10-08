import {
  supabaseInsert,
  supabaseRpc,
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
  | "drafting"
  | "rebuttal";

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

type LatestSpecialistStateRow = {
  matter_id: string;
  agent_id: string;
  run: DbAgentRun | null;
  output_record: DbAgentOutput | null;
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
  rebuttal: {
    name: "Rhea",
    routeLabel: "Rhea · Government Response",
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
| LATEST SPECIALIST STATE VIA DATABASE RPC + SAFE BACKFILL
|--------------------------------------------------------------------------
|
| Keep the optimized RPC as the primary path.
|
| If a new specialist ID has not yet been added to the database RPC,
| backfill ONLY the missing agent from agent_runs + agent_outputs.
| This is what lets Rhea ("rebuttal") appear immediately after n8n saves it.
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

  try {
    const rows =
      await supabaseRpc<LatestSpecialistStateRow>(
        "get_latest_specialist_states",
        {
          p_matter_ids: [matterId],
        }
      );

    for (const row of rows) {
      if (!isSpecialistAgentId(String(row.agent_id || ""))) {
        continue;
      }

      const agentId = row.agent_id as SpecialistAgentId;

      result[agentId] = {
        run: row.run || null,
        output: row.output_record?.output || null,
        outputRecord: row.output_record || null,
      };
    }
  } catch (error) {
    console.error(
      `Unable to load specialist state RPC for matter ${matterId}:`,
      error
    );
  }

  const missingAgents =
    (Object.keys(SPECIALIST_AGENTS) as SpecialistAgentId[]).filter(
      (agentId) =>
        !result[agentId]?.run &&
        !result[agentId]?.outputRecord
    );

  if (missingAgents.length) {
    await Promise.all(
      missingAgents.map(async (agentId) => {
        try {
          const [run, outputRecord] =
            await Promise.all([
              getLatestRunForAgent(
                matterId,
                agentId
              ),
              getLatestOutputForAgent(
                matterId,
                agentId
              ),
            ]);

          if (!run && !outputRecord) {
            return;
          }

          result[agentId] = {
            run:
              run || null,

            output:
              outputRecord?.output ||
              null,

            outputRecord:
              outputRecord || null,
          };
        } catch (error) {
          console.error(
            `Unable to backfill specialist state for ${agentId} on matter ${matterId}:`,
            error
          );
        }
      })
    );
  }

  return result;
}

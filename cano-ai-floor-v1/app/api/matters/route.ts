import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getAllMatters,
  type DbAssignment,
  type DbSnapshot,
} from "../../../lib/supabase/matters";

import {
  SPECIALIST_AGENTS,
  isSpecialistAgentId,
  type DbAgentOutput,
  type DbAgentRun,
  type SpecialistAgentId,
} from "../../../lib/supabase/agents";

import {
  supabaseSelect,
} from "../../../lib/supabase/rest";

function postgrestIn(values: string[]) {
  const clean = Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

  if (!clean.length) {
    return "";
  }

  return `in.(${clean.join(",")})`;
}

function emptySpecialistState() {
  const result: Record<string, any> = {};

  for (
    const agentId of Object.keys(
      SPECIALIST_AGENTS
    ) as SpecialistAgentId[]
  ) {
    result[agentId] = {
      run: null,
      output: null,
      outputRecord: null,
    };
  }

  return result;
}

export async function GET(
  request: NextRequest
) {
  const rawLimit =
    Number(
      request.nextUrl.searchParams.get(
        "limit"
      ) || 100
    );

  /*
  | 150 hydrated matters was causing a fan-out explosion.
  | We still allow a large list, but all related records are now fetched
  | in four batched queries instead of several queries PER MATTER.
  */
  const limit =
    Math.max(
      1,
      Math.min(
        rawLimit || 100,
        150
      )
    );

  try {
    const rows =
      await getAllMatters(
        limit
      );

    if (!rows.length) {
      return NextResponse.json({
        ok: true,
        summary: {
          total: 0,
          processing: 0,
          reviewReady: 0,
          errors: 0,
        },
        matters: [],
      });
    }

    const matterIds =
      rows.map((row) => row.id);

    const snapshotIds =
      rows
        .map(
          (row) =>
            row.latest_case_brain_snapshot_id
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        );

    /*
    |--------------------------------------------------------------------------
    | BATCH RELATED DATA
    |--------------------------------------------------------------------------
    |
    | Old route:
    |   For each matter:
    |     snapshot + assignment + runs + outputs
    |
    | With many matters that could become hundreds of simultaneous requests.
    |
    | New route:
    |   1 ai_matters query
    |   1 snapshots query
    |   1 assignments query
    |   1 runs query
    |   1 outputs query
    |
    | Total: 5 database requests for the whole page.
    |--------------------------------------------------------------------------
    */

    const [
      snapshots,
      assignments,
      runs,
      outputs,
    ] =
      await Promise.all([
        snapshotIds.length
          ? supabaseSelect<DbSnapshot>(
              "case_brain_snapshots",
              {
                select: "*",
                id:
                  postgrestIn(
                    snapshotIds
                  ),
              }
            )
          : Promise.resolve(
              [] as DbSnapshot[]
            ),

        supabaseSelect<DbAssignment>(
          "agent_assignments",
          {
            select: "*",
            matter_id:
              postgrestIn(
                matterIds
              ),
            order:
              "assigned_at.desc",
            limit: 1000,
          }
        ),

        supabaseSelect<DbAgentRun>(
          "agent_runs",
          {
            select: "*",
            matter_id:
              postgrestIn(
                matterIds
              ),
            order:
              "started_at.desc",
            limit: 3000,
          }
        ),

        supabaseSelect<DbAgentOutput>(
          "agent_outputs",
          {
            select: "*",
            matter_id:
              postgrestIn(
                matterIds
              ),
            order:
              "created_at.desc",
            limit: 3000,
          }
        ),
      ]);

    const snapshotById =
      new Map(
        snapshots.map(
          (snapshot) => [
            snapshot.id,
            snapshot,
          ]
        )
      );

    const latestAssignmentByMatter =
      new Map<
        string,
        DbAssignment
      >();

    for (
      const assignment of assignments
    ) {
      if (
        !latestAssignmentByMatter.has(
          assignment.matter_id
        )
      ) {
        latestAssignmentByMatter.set(
          assignment.matter_id,
          assignment
        );
      }
    }

    const latestRunByMatterAgent =
      new Map<
        string,
        DbAgentRun
      >();

    for (const run of runs) {
      if (
        !isSpecialistAgentId(
          run.agent_id
        )
      ) {
        continue;
      }

      const key =
        `${run.matter_id}:${run.agent_id}`;

      if (
        !latestRunByMatterAgent.has(
          key
        )
      ) {
        latestRunByMatterAgent.set(
          key,
          run
        );
      }
    }

    const latestOutputByMatterAgent =
      new Map<
        string,
        DbAgentOutput
      >();

    for (
      const outputRecord of outputs
    ) {
      if (
        !isSpecialistAgentId(
          outputRecord.agent_id
        )
      ) {
        continue;
      }

      const key =
        `${outputRecord.matter_id}:${outputRecord.agent_id}`;

      if (
        !latestOutputByMatterAgent.has(
          key
        )
      ) {
        latestOutputByMatterAgent.set(
          key,
          outputRecord
        );
      }
    }

    const matters =
      rows.map((row) => {
        const snapshot =
          row.latest_case_brain_snapshot_id
            ? snapshotById.get(
                row.latest_case_brain_snapshot_id
              ) || null
            : null;

        const assignment =
          latestAssignmentByMatter.get(
            row.id
          ) || null;

        const specialists =
          emptySpecialistState();

        for (
          const agentId of Object.keys(
            SPECIALIST_AGENTS
          ) as SpecialistAgentId[]
        ) {
          const key =
            `${row.id}:${agentId}`;

          const run =
            latestRunByMatterAgent.get(
              key
            ) || null;

          const outputRecord =
            latestOutputByMatterAgent.get(
              key
            ) || null;

          specialists[agentId] = {
            run,
            output:
              outputRecord?.output ||
              null,
            outputRecord,
          };
        }

        return {
          databaseId:
            row.id,

          matterId:
            row.monday_item_id,

          mondayItemId:
            row.monday_item_id,

          caseBrainStatus:
            row.status,

          savedAt:
            snapshot?.created_at ||
            row.updated_at,

          monday: {
            found: true,
            preview:
              row.monday_data
                ?.preview || null,
            raw:
              row.monday_data ||
              null,
          },

          caseBrain:
            snapshot?.analysis ||
            {},

          routing:
            row.current_route
              ? {
                  target:
                    row.current_route,

                  routedBy:
                    row.routed_by ||
                    "Santiago",

                  routedAt:
                    row.routed_at ||
                    row.updated_at,

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
              row.pipeline_status ||
              "idle",

            stage:
              row.pipeline_stage ||
              null,

            nextAgent:
              row.pipeline_next_agent ||
              null,

            autoEnabled:
              row.pipeline_auto_enabled !==
              false,
          },

          record: {
            databaseId:
              row.id,

            matterName:
              row.matter_name,

            detaineeName:
              row.detainee_name,

            pncName:
              row.pnc_name,

            practiceArea:
              row.practice_area,

            matterType:
              row.matter_type,

            assignedAttorney:
              row.assigned_attorney,

            status:
              row.status,

            currentRoute:
              row.current_route,

            updatedAt:
              row.updated_at,

            createdAt:
              row.created_at,
          },

          specialists,
        };
      });

    const summary = {
      total:
        matters.length,

      processing:
        matters.filter(
          (matter) =>
            matter.caseBrainStatus ===
            "case_brain_processing"
        ).length,

      reviewReady:
        matters.filter(
          (matter) =>
            matter.caseBrainStatus ===
            "review_ready"
        ).length,

      errors:
        matters.filter(
          (matter) =>
            matter.caseBrainStatus ===
            "case_brain_error"
        ).length,
    };

    return NextResponse.json({
      ok: true,
      summary,
      matters,
    });
  } catch (error) {
    console.error(
      "/api/matters failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load shared matters.",
      },
      {
        status: 500,
      }
    );
  }
}

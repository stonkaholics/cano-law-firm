import { NextRequest, NextResponse } from "next/server";
import {
  getAgentRun,
  getOutputForRun,
  insertAgentOutput,
  isSpecialistAgentId,
  updateAgentRun,
} from "../../../../lib/supabase/agents";
import {
  getMatterById,
  getMatterByMondayId,
  getSnapshotById,
  insertActivity,
  updateMatter,
} from "../../../../lib/supabase/matters";
import {
  chooseAfterResearch,
  chooseAfterPrimarySpecialist,
  chooseAfterTimeline,
  chooseAfterHearing,
  recordPipelineTransition,
} from "../../../../lib/supabase/pipeline";

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.N8N_SHARED_SECRET;

  if (expectedSecret) {
    const supplied = request.headers.get("x-cano-secret");

    if (!supplied || supplied !== expectedSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized specialist callback.",
        },
        { status: 401 }
      );
    }
  }

  const body = await request.json();

  const runId = String(body?.runId || "");
  const agentId = String(body?.agentId || "");

  if (!runId || !agentId || !isSpecialistAgentId(agentId)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Valid runId and agentId are required.",
      },
      { status: 400 }
    );
  }

  try {
    const run = await getAgentRun(runId);

    if (!run) {
      return NextResponse.json(
        {
          ok: false,
          error: "Agent run not found.",
        },
        { status: 404 }
      );
    }

    const matter = await getMatterById(run.matter_id);

    if (!matter) {
      return NextResponse.json(
        {
          ok: false,
          error: "Matter not found.",
        },
        { status: 404 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | IDEMPOTENT CALLBACK GUARD
    |--------------------------------------------------------------------------
    |
    | n8n can legitimately retry an HTTP Request after a network timeout,
    | manual execution retry, or connection abort.
    |
    | agent_outputs has a UNIQUE constraint on run_id, so a second callback
    | for the same run previously caused:
    |
    |   duplicate key value violates unique constraint
    |   "agent_outputs_run_id_key"
    |
    | If this run already has an output AND the run itself is already in a
    | terminal completion state, acknowledge the retry as success and stop.
    |
    | This prevents:
    | - duplicate output inserts
    | - duplicate completion activities
    | - duplicate Atlas refreshes
    | - duplicate auto-pipeline starts
    |--------------------------------------------------------------------------
    */

    const existingOutput =
      await getOutputForRun(run.id);

    const terminalStatuses =
      new Set([
        "review_ready",
        "needs_review",
      ]);

    if (
      existingOutput &&
      terminalStatuses.has(run.status)
    ) {
      return NextResponse.json({
        ok: true,
        saved: "already_completed",
        duplicateCallback: true,
        runId: run.id,
        outputId: existingOutput.id,
      });
    }

    if (body?.ok === false) {
      const errorMessage =
        body?.error ||
        body?.warning ||
        "Specialist agent reported an error.";

      await updateAgentRun(runId, {
        status: "error",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      });

      await insertActivity({
        matter_id: matter.id,
        monday_item_id: matter.monday_item_id,
        event_type: "specialist_error",
        agent_id: agentId,
        actor: run.agent_name,
        title: `${run.agent_name} encountered an error`,
        detail: errorMessage,
        metadata: {
          run_id: runId,
        },
      });

      return NextResponse.json({
        ok: true,
        saved: "error",
      });
    }

    const output =
      body?.output ||
      body?.result ||
      null;

    if (!output) {
      throw new Error(
        "Specialist callback did not include output."
      );
    }

    /*
    |--------------------------------------------------------------------------
    | PARTIAL-RETRY RECOVERY
    |--------------------------------------------------------------------------
    |
    | If the first callback successfully inserted agent_outputs but failed
    | later before the run was marked review_ready/needs_review, re-use the
    | existing output record rather than trying to insert it again.
    |--------------------------------------------------------------------------
    */

    const outputRecord =
      existingOutput ||
      (await insertAgentOutput({
        run_id: run.id,
        matter_id: matter.id,
        monday_item_id: matter.monday_item_id,
        agent_id: agentId,
        schema_version:
          output?.schema_version ||
          "specialist_output_v1",
        output,
      }));

    await updateAgentRun(run.id, {
      status:
        output?.readiness?.status === "not_ready" ||
        output?.readiness?.status === "needs_information"
          ? "needs_review"
          : "review_ready",
      error_message: null,
      completed_at: new Date().toISOString(),
    });

    await insertActivity({
      matter_id: matter.id,
      monday_item_id: matter.monday_item_id,
      event_type: "specialist_completed",
      agent_id: agentId,
      actor: run.agent_name,
      title: `${run.agent_name} review ready`,
      detail:
        output?.executive_summary ||
        `${run.agent_name} completed the specialist analysis.`,
      metadata: {
        run_id: run.id,
        output_id: outputRecord?.id || null,
        readiness:
          output?.readiness?.status ||
          "review_ready",
        recovered_existing_output:
          Boolean(existingOutput),
      },
    });

    /*
    |--------------------------------------------------------------------------
    | ATLAS REFRESH
    |--------------------------------------------------------------------------
    */

    const atlasRefreshSources =
      new Set([
        "research",
        "habeas",
        "bond",
        "timeline",
        "hearing",
        "qa",
      ]);

    if (
      atlasRefreshSources.has(agentId)
    ) {
      const atlasResponse =
        await fetch(
          new URL(
            "/api/pipeline/start-agent",
            request.nextUrl.origin
          ),
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              mondayItemId:
                matter.monday_item_id,
              agentId:
                "synthesis",
            }),
            cache: "no-store",
          }
        );

      if (!atlasResponse.ok) {
        await insertActivity({
          matter_id: matter.id,
          monday_item_id:
            matter.monday_item_id,
          event_type:
            "intelligence_manager_start_error",
          agent_id:
            "synthesis",
          actor:
            run.agent_name,
          title:
            "Atlas refresh could not start",
          detail:
            await atlasResponse.text(),
          metadata: {
            source_agent:
              agentId,
            source_run_id:
              run.id,
          },
        });
      }
    }

    const latestMatter =
      await getMatterByMondayId(
        matter.monday_item_id
      );

    if (
      agentId !== "synthesis" &&
      latestMatter
        ?.pipeline_auto_enabled !==
        false
    ) {
      const caseBrainSnapshotId =
        latestMatter
          ?.latest_case_brain_snapshot_id;

      const caseBrainSnapshot =
        caseBrainSnapshotId
          ? await getSnapshotById(
              caseBrainSnapshotId
            )
          : null;

      const caseBrain =
        caseBrainSnapshot?.analysis ||
        null;

      const compatibilityRecommendation =
        String(
          caseBrain?.agent_id ||
          ""
        ).toLowerCase();

      const persistedRecommendation =
        String(
          caseBrainSnapshot
            ?.recommended_specialist ||
            caseBrain?.routing
              ?.recommended_specialist ||
            ([
              "habeas",
              "bond",
              "timeline",
            ].includes(
              compatibilityRecommendation
            )
              ? compatibilityRecommendation
              : "")
        )
          .trim()
          .toLowerCase() ||
        null;

      let decision: any =
        null;

      if (
        agentId === "research"
      ) {
        decision =
          chooseAfterResearch(
            caseBrain,
            output,
            persistedRecommendation
          );
      } else if (
        agentId === "habeas" ||
        agentId === "bond"
      ) {
        decision =
          chooseAfterPrimarySpecialist(
            agentId,
            output
          );
      } else if (
        agentId === "timeline"
      ) {
        decision =
          chooseAfterTimeline(
            output
          );
      } else if (
        agentId === "hearing"
      ) {
        decision =
          chooseAfterHearing();
      }

      if (decision) {
        /*
        | Only advance the visible pipeline AFTER the next agent has actually
        | been accepted. This prevents UI state from getting ahead of n8n.
        */
        if (
          decision.nextAgent
        ) {
          const pipelineResponse =
            await fetch(
              new URL(
                "/api/pipeline/start-agent",
                request.nextUrl.origin
              ),
              {
                method:
                  "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    mondayItemId:
                      matter
                        .monday_item_id,
                    agentId:
                      decision.nextAgent,
                  }),
                cache:
                  "no-store",
              }
            );

          const pipelineText =
            await pipelineResponse.text();

          if (
            !pipelineResponse.ok
          ) {
            await updateMatter(
              matter.id,
              {
                pipeline_status:
                  "paused",
                pipeline_stage:
                  agentId,
                pipeline_next_agent:
                  decision.nextAgent,
                current_route:
                  decision.routeLabel,
                routed_by:
                  "Santiago Auto-Pipeline",
                routed_at:
                  new Date()
                    .toISOString(),
              }
            );

            await insertActivity({
              matter_id:
                matter.id,
              monday_item_id:
                matter.monday_item_id,
              event_type:
                "pipeline_start_error",
              agent_id:
                decision.nextAgent,
              actor:
                "Santiago Auto-Pipeline",
              title:
                `${decision.routeLabel} could not start automatically`,
              detail:
                pipelineText ||
                "The next specialist was selected but the run could not be created.",
              metadata: {
                attempted_agent:
                  decision.nextAgent,
                from_agent:
                  agentId,
                retry_available:
                  true,
              },
            });

            return NextResponse.json({
              ok: true,
              saved:
                "output",
              pipeline:
                "paused_start_error",
              retryAgent:
                decision.nextAgent,
              runId:
                run.id,
              outputId:
                outputRecord?.id ||
                null,
            });
          }
        }

        await recordPipelineTransition({
          mondayItemId:
            matter.monday_item_id,
          fromStage:
            agentId,
          decision,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      saved:
        existingOutput
          ? "output_recovered"
          : "output",
      runId:
        run.id,
      outputId:
        outputRecord?.id ||
        null,
      recoveredExistingOutput:
        Boolean(
          existingOutput
        ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save specialist output.",
      },
      {
        status: 500,
      }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  getAgentRun,
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
        { ok: false, error: "Unauthorized specialist callback." },
        { status: 401 }
      );
    }
  }

  const body = await request.json();

  const runId = String(body?.runId || "");
  const agentId = String(body?.agentId || "");

  if (!runId || !agentId || !isSpecialistAgentId(agentId)) {
    return NextResponse.json(
      { ok: false, error: "Valid runId and agentId are required." },
      { status: 400 }
    );
  }

  try {
    const run = await getAgentRun(runId);

    if (!run) {
      return NextResponse.json(
        { ok: false, error: "Agent run not found." },
        { status: 404 }
      );
    }

    const matter = await getMatterById(run.matter_id);

    if (!matter) {
      return NextResponse.json(
        { ok: false, error: "Matter not found." },
        { status: 404 }
      );
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
        metadata: { run_id: runId },
      });

      return NextResponse.json({ ok: true, saved: "error" });
    }

    const output = body?.output || body?.result || null;

    if (!output) {
      throw new Error("Specialist callback did not include output.");
    }

    const outputRecord = await insertAgentOutput({
      run_id: run.id,
      matter_id: matter.id,
      monday_item_id: matter.monday_item_id,
      agent_id: agentId,
      schema_version:
        output?.schema_version || "specialist_output_v1",
      output,
    });

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
        readiness: output?.readiness?.status || "review_ready",
      },
    });

    // Any completed specialist updates Atlas, which maintains the
    // cross-agent intelligence brief without changing the specialist's own output.
    if (agentId !== "synthesis") {
      const atlasResponse = await fetch(
        new URL(
          "/api/pipeline/start-agent",
          request.nextUrl.origin
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mondayItemId: matter.monday_item_id,
            agentId: "synthesis",
          }),
          cache: "no-store",
        }
      );

      if (!atlasResponse.ok) {
        await insertActivity({
          matter_id: matter.id,
          monday_item_id: matter.monday_item_id,
          event_type: "intelligence_manager_start_error",
          agent_id: "synthesis",
          actor: run.agent_name,
          title: "Atlas refresh could not start",
          detail: await atlasResponse.text(),
          metadata: {
            source_agent: agentId,
            source_run_id: run.id,
          },
        });
      }
    }

    const latestMatter = await getMatterByMondayId(
      matter.monday_item_id
    );

    if (
      agentId !== "synthesis" &&
      latestMatter?.pipeline_auto_enabled !== false
    ) {
      const caseBrainSnapshotId =
        latestMatter?.latest_case_brain_snapshot_id;

      const caseBrainSnapshot = caseBrainSnapshotId
        ? await getSnapshotById(caseBrainSnapshotId)
        : null;

      const caseBrain = caseBrainSnapshot?.analysis || null;
      const persistedRecommendation =
        String(caseBrainSnapshot?.recommended_specialist || "")
          .trim()
          .toLowerCase() || null;

      let decision: any = null;

      if (agentId === "research") {
        decision = chooseAfterResearch(
          caseBrain,
          output,
          persistedRecommendation
        );
      } else if (
        agentId === "habeas" ||
        agentId === "bond"
      ) {
        decision = chooseAfterPrimarySpecialist(
          agentId,
          output
        );
      } else if (agentId === "timeline") {
        decision = chooseAfterTimeline(output);
      } else if (agentId === "hearing") {
        decision = chooseAfterHearing();
      }

      if (decision) {
        // Important: only advance the visible pipeline AFTER the next agent
        // has actually been accepted. This prevents the UI from saying
        // "Elena next/running" when no Elena run was created.
        if (decision.nextAgent) {
          const pipelineResponse = await fetch(
            new URL(
              "/api/pipeline/start-agent",
              request.nextUrl.origin
            ),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mondayItemId: matter.monday_item_id,
                agentId: decision.nextAgent,
              }),
              cache: "no-store",
            }
          );

          const pipelineText = await pipelineResponse.text();

          if (!pipelineResponse.ok) {
            await updateMatter(matter.id, {
              pipeline_status: "paused",
              pipeline_stage: agentId,
              pipeline_next_agent: decision.nextAgent,
              current_route: decision.routeLabel,
              routed_by: "Santiago Auto-Pipeline",
              routed_at: new Date().toISOString(),
            });

            await insertActivity({
              matter_id: matter.id,
              monday_item_id: matter.monday_item_id,
              event_type: "pipeline_start_error",
              agent_id: decision.nextAgent,
              actor: "Santiago Auto-Pipeline",
              title: `${decision.routeLabel} could not start automatically`,
              detail:
                pipelineText ||
                "The next specialist was selected but the run could not be created.",
              metadata: {
                attempted_agent: decision.nextAgent,
                from_agent: agentId,
                retry_available: true,
              },
            });

            return NextResponse.json({
              ok: true,
              saved: "output",
              pipeline: "paused_start_error",
              retryAgent: decision.nextAgent,
              runId: run.id,
              outputId: outputRecord?.id || null,
            });
          }
        }

        await recordPipelineTransition({
          mondayItemId: matter.monday_item_id,
          fromStage: agentId,
          decision,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      saved: "output",
      runId: run.id,
      outputId: outputRecord?.id || null,
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
      { status: 500 }
    );
  }
}

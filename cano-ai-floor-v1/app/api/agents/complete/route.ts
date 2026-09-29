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
  insertActivity,
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
        output?.readiness?.status === "not_ready"
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

    const latestMatter = await getMatterByMondayId(
      matter.monday_item_id
    );

    if (latestMatter?.pipeline_auto_enabled !== false) {
      const caseBrainSnapshotId =
        latestMatter?.latest_case_brain_snapshot_id;

      let caseBrain: any = null;

      if (caseBrainSnapshotId) {
        const snapshotRows = await (
          await import("../../../../lib/supabase/rest")
        ).supabaseSelect<any>("case_brain_snapshots", {
          select: "analysis",
          id: `eq.${caseBrainSnapshotId}`,
          limit: 1,
        });

        caseBrain = snapshotRows[0]?.analysis || null;
      }

      let decision: any = null;

      if (agentId === "research") {
        decision = chooseAfterResearch(caseBrain, output);
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
        await recordPipelineTransition({
          mondayItemId: matter.monday_item_id,
          fromStage: agentId,
          decision,
        });

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

          if (!pipelineResponse.ok) {
            await insertActivity({
              matter_id: matter.id,
              monday_item_id: matter.monday_item_id,
              event_type: "pipeline_start_error",
              agent_id: decision.nextAgent,
              actor: "Santiago Auto-Pipeline",
              title: "Automatic specialist start failed",
              detail: await pipelineResponse.text(),
              metadata: {
                attempted_agent: decision.nextAgent,
              },
            });
          }
        }
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

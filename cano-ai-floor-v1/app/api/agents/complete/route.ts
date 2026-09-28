import { NextRequest, NextResponse } from "next/server";
import {
  getAgentRun,
  insertAgentOutput,
  isSpecialistAgentId,
  updateAgentRun,
} from "../../../../lib/supabase/agents";
import {
  getMatterById,
  insertActivity,
} from "../../../../lib/supabase/matters";

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

import { NextRequest, NextResponse } from "next/server";
import {
  buildStoredMatter,
  getMatterByMondayId,
  getSnapshotById,
  insertActivity,
  updateMatter,
} from "../../../lib/supabase/matters";
import {
  chooseAfterCaseBrain,
  recordPipelineTransition,
} from "../../../lib/supabase/pipeline";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const mondayItemId = String(body?.mondayItemId || "");
  const action = String(body?.action || "");

  if (!mondayItemId) {
    return NextResponse.json(
      { ok: false, error: "mondayItemId is required." },
      { status: 400 }
    );
  }

  try {
    const matter = await getMatterByMondayId(mondayItemId);

    if (!matter) {
      return NextResponse.json(
        { ok: false, error: "Matter not found." },
        { status: 404 }
      );
    }

    if (action === "set_auto") {
      const enabled = Boolean(body?.enabled);

      const updated = await updateMatter(matter.id, {
        pipeline_auto_enabled: enabled,
        pipeline_status: enabled
          ? matter.pipeline_status || "idle"
          : "manual",
      });

      await insertActivity({
        matter_id: matter.id,
        monday_item_id: mondayItemId,
        event_type: "pipeline_mode_changed",
        agent_id: "santiago",
        actor: "User",
        title: enabled
          ? "Automatic pipeline enabled"
          : "Automatic pipeline disabled",
        detail: enabled
          ? "Santiago will advance this matter automatically when each specialist completes."
          : "This matter will require manual routing between specialists.",
        metadata: { enabled },
      });

      return NextResponse.json({
        ok: true,
        matter: await buildStoredMatter(updated || matter),
      });
    }


    if (action === "start_workflow") {
      const snapshot = await getSnapshotById(
        matter.latest_case_brain_snapshot_id
      );

      // No saved Case Brain result yet. Re-submit the exact matter to the
      // asynchronous Case Brain job. This is intentionally a recovery path:
      // the final n8n node still MUST POST the completed analysis to
      // /api/case-brain/complete.
      if (!snapshot?.analysis) {
        const retryResponse = await fetch(
          new URL("/api/santiago/start", request.nextUrl.origin),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "refresh_case_brain",
              matterId: mondayItemId,
              mondayItemId,
              preview: matter.monday_data?.preview || null,
            }),
            cache: "no-store",
          }
        );

        const retryData = await retryResponse.json();

        if (!retryResponse.ok || retryData?.ok === false) {
          throw new Error(
            retryData?.error ||
            "Case Brain could not be restarted."
          );
        }

        await insertActivity({
          matter_id: matter.id,
          monday_item_id: mondayItemId,
          event_type: "pipeline_manual_kick_case_brain",
          agent_id: "casebrain",
          actor: "User",
          title: "Workflow manually restarted at Case Brain",
          detail:
            "No saved Case Brain snapshot was available, so the matter was re-submitted to Case Brain.",
          metadata: { source: "case_brain_workstation" },
        });

        const refreshedMatter =
          await getMatterByMondayId(mondayItemId);

        return NextResponse.json({
          ok: true,
          mode: "case_brain_restarted",
          message:
            "No saved Case Brain snapshot was found. Case Brain was restarted. The workflow will continue after n8n posts the completed result back to Cano AI.",
          matter: await buildStoredMatter(
            refreshedMatter || matter
          ),
        });
      }

      const decision = chooseAfterCaseBrain(snapshot.analysis);

      await recordPipelineTransition({
        mondayItemId,
        fromStage:
          matter.pipeline_stage || "case_brain",
        decision,
      });

      if (decision.nextAgent) {
        const agentResponse = await fetch(
          new URL(
            "/api/pipeline/start-agent",
            request.nextUrl.origin
          ),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mondayItemId,
              agentId: decision.nextAgent,
            }),
            cache: "no-store",
          }
        );

        const agentText = await agentResponse.text();

        if (!agentResponse.ok) {
          throw new Error(
            `Pipeline advanced but ${decision.routeLabel} could not start: ${agentText}`
          );
        }
      }

      await insertActivity({
        matter_id: matter.id,
        monday_item_id: mondayItemId,
        event_type: "pipeline_manual_kick",
        agent_id: decision.nextAgent || "attorney_review",
        actor: "User",
        title: decision.nextAgent
          ? `Workflow manually started: ${decision.routeLabel}`
          : "Workflow manually advanced",
        detail: decision.reason,
        metadata: {
          stage: decision.stage,
          next_agent: decision.nextAgent,
        },
      });

      const latest =
        await getMatterByMondayId(mondayItemId);

      return NextResponse.json({
        ok: true,
        mode: "pipeline_started",
        message: decision.nextAgent
          ? `Workflow started. ${decision.routeLabel} is now running.`
          : `Workflow advanced to ${decision.routeLabel}.`,
        matter: await buildStoredMatter(latest || matter),
      });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported pipeline action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update matter pipeline.",
      },
      { status: 500 }
    );
  }
}

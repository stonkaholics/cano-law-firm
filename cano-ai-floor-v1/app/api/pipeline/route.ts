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
import {
  getLatestSpecialistState,
  SpecialistAgentId,
} from "../../../lib/supabase/agents";

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

      if (snapshot?.analysis) {
        const states = await getLatestSpecialistState(matter.id);
        const caseBrain = snapshot.analysis;

        const compatibilityRecommendation = String(
          caseBrain?.agent_id || ""
        ).toLowerCase();

        const recommended = String(
          snapshot.recommended_specialist ||
          caseBrain?.routing?.recommended_specialist ||
          (["habeas", "bond", "timeline"].includes(
            compatibilityRecommendation
          )
            ? compatibilityRecommendation
            : "")
        ).toLowerCase();

        let resumeAgent: SpecialistAgentId | null = null;
        let resumeStage = matter.pipeline_stage || "case_brain";
        let resumeLabel = "Pending Specialist";

        if (!states.research?.output) {
          resumeAgent = "research";
          resumeStage = "research";
          resumeLabel = "Lex · Research";
        } else if (
          recommended === "habeas" &&
          !states.habeas?.output
        ) {
          resumeAgent = "habeas";
          resumeStage = "habeas";
          resumeLabel = "Elena · Habeas";
        } else if (
          recommended === "bond" &&
          !states.bond?.output
        ) {
          resumeAgent = "bond";
          resumeStage = "bond";
          resumeLabel = "Mateo · Bond";
        } else if (!states.timeline?.output) {
          resumeAgent = "timeline";
          resumeStage = "timeline";
          resumeLabel = "Chronos · Timeline";
        } else if (!states.hearing?.output) {
          resumeAgent = "hearing";
          resumeStage = "hearing_prep";
          resumeLabel = "Avery · Hearing Prep";
        }

        if (resumeAgent) {
          const retryResponse = await fetch(
            new URL(
              "/api/pipeline/start-agent",
              request.nextUrl.origin
            ),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mondayItemId,
                agentId: resumeAgent,
              }),
              cache: "no-store",
            }
          );

          const retryText = await retryResponse.text();

          if (!retryResponse.ok) {
            await updateMatter(matter.id, {
              pipeline_status: "paused",
              pipeline_stage: resumeStage,
              pipeline_next_agent: resumeAgent,
              current_route: resumeLabel,
              routed_by: "Santiago Auto-Pipeline",
              routed_at: new Date().toISOString(),
            });

            throw new Error(
              `Could not start ${resumeLabel}: ${retryText}`
            );
          }

          const resumed = await updateMatter(matter.id, {
            pipeline_status: "running",
            pipeline_stage: resumeStage,
            pipeline_next_agent: resumeAgent,
            current_route: resumeLabel,
            routed_by: "Santiago Auto-Pipeline",
            routed_at: new Date().toISOString(),
          });

          await insertActivity({
            matter_id: matter.id,
            monday_item_id: mondayItemId,
            event_type: "pipeline_manual_resume",
            agent_id: resumeAgent,
            actor: "User",
            title: `Workflow resumed at ${resumeLabel}`,
            detail:
              "The recovery control detected completed specialist outputs and started the first missing pipeline stage.",
            metadata: {
              recommended_primary: recommended || null,
              resumed_stage: resumeStage,
              resumed_agent: resumeAgent,
            },
          });

          return NextResponse.json({
            ok: true,
            mode: "pipeline_resumed",
            message: `${resumeLabel} is now running.`,
            matter: await buildStoredMatter(resumed || matter),
          });
        }

        const completeMatter = await updateMatter(matter.id, {
          pipeline_status: "paused",
          pipeline_stage: "attorney_review",
          pipeline_next_agent: null,
          current_route: "Attorney Review",
          routed_by: "Santiago Auto-Pipeline",
          routed_at: new Date().toISOString(),
        });

        return NextResponse.json({
          ok: true,
          mode: "pipeline_complete",
          message:
            "All automated specialist stages already have saved outputs. The matter is ready for attorney review.",
          matter: await buildStoredMatter(
            completeMatter || matter
          ),
        });
      }

      // Recovery path for a handoff that was selected but never actually
      // launched. Example: Lex completed, Elena was chosen, but n8n/Vercel
      // failed before an Elena run was created.
      if (
        snapshot?.analysis &&
        matter.pipeline_status === "paused" &&
        matter.pipeline_next_agent
      ) {
        const retryResponse = await fetch(
          new URL(
            "/api/pipeline/start-agent",
            request.nextUrl.origin
          ),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mondayItemId,
              agentId: matter.pipeline_next_agent,
            }),
            cache: "no-store",
          }
        );

        const retryText = await retryResponse.text();

        if (!retryResponse.ok) {
          throw new Error(
            `Retry could not start ${matter.pipeline_next_agent}: ${retryText}`
          );
        }

        const resumed = await updateMatter(matter.id, {
          pipeline_status: "running",
        });

        await insertActivity({
          matter_id: matter.id,
          monday_item_id: mondayItemId,
          event_type: "pipeline_manual_retry",
          agent_id: matter.pipeline_next_agent,
          actor: "User",
          title: "Automatic handoff manually retried",
          detail:
            `Started the pending ${matter.pipeline_next_agent} specialist without restarting earlier completed work.`,
          metadata: {
            pending_agent: matter.pipeline_next_agent,
          },
        });

        return NextResponse.json({
          ok: true,
          mode: "pending_agent_retried",
          message:
            `Pending specialist ${matter.pipeline_next_agent} has been started.`,
          matter: await buildStoredMatter(resumed || matter),
        });
      }

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

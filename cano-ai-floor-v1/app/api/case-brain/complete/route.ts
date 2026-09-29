import { NextRequest, NextResponse } from "next/server";
import {
  buildStoredMatter,
  getMatterByMondayId,
  insertActivity,
  insertSnapshot,
  updateMatter,
} from "../../../../lib/supabase/matters";
import {
  chooseAfterCaseBrain,
  recordPipelineTransition,
} from "../../../../lib/supabase/pipeline";

function getPersonName(person: any) {
  if (!person || typeof person !== "object") return "";
  return String(
    person.name ||
    person.full_name ||
    person.fullName ||
    ""
  ).trim();
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.N8N_SHARED_SECRET;

  if (expectedSecret) {
    const provided = request.headers.get("x-cano-secret");
    if (!provided || provided !== expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized Case Brain callback." },
        { status: 401 }
      );
    }
  }

  const body = await request.json();

  const mondayItemId = String(
    body?.mondayItemId ||
    body?.matterId ||
    body?.caseBrain?.matter?.monday_item_id ||
    ""
  );

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
        { ok: false, error: "Shared matter not found in Supabase." },
        { status: 404 }
      );
    }

    if (body?.ok === false) {
      const detail =
        body?.error ||
        body?.warning ||
        "Case Brain workflow reported an error.";

      await updateMatter(matter.id, {
        status: "case_brain_error",
      });

      await insertActivity({
        matter_id: matter.id,
        monday_item_id: mondayItemId,
        event_type: "case_brain_error",
        agent_id: "casebrain",
        actor: "n8n",
        title: "Case Brain workflow error",
        detail,
        metadata: body?.metadata || {},
      });

      return NextResponse.json({
        ok: true,
        saved: "error",
      });
    }

    const caseBrain =
      body?.caseBrain ||
      body?.data?.caseBrain ||
      null;

    if (!caseBrain) {
      throw new Error(
        "Callback did not contain a Case Brain analysis."
      );
    }

    const action =
      body?.action === "refresh_case_brain"
        ? "refresh_case_brain"
        : body?.triggerType === "refresh"
        ? "refresh_case_brain"
        : "start_case_brain";

    const status =
      body?.caseBrainStatus ||
      body?.status ||
      "review_ready";

    const preview =
      matter.monday_data?.preview ||
      body?.preview ||
      {};

    const detaineeName =
      getPersonName(caseBrain?.people?.detainee) ||
      preview?.detaineeName ||
      preview?.name ||
      matter.detainee_name ||
      null;

    const pncName =
      getPersonName(caseBrain?.people?.pnc) ||
      preview?.pncName ||
      matter.pnc_name ||
      null;

    const practiceArea =
      caseBrain?.matter?.practice_area ||
      preview?.practiceArea ||
      matter.practice_area ||
      null;

    const matterType =
      caseBrain?.matter?.matter_type ||
      preview?.matterType ||
      matter.matter_type ||
      null;

    const attorney =
      caseBrain?.matter?.assigned_attorney ||
      preview?.attorney ||
      matter.assigned_attorney ||
      null;

    const snapshot = await insertSnapshot({
      matter_id: matter.id,
      monday_item_id: mondayItemId,
      schema_version:
        caseBrain?.schema_version || "case_brain_v1",
      trigger_type:
        action === "refresh_case_brain"
          ? "refresh"
          : "initial",
      analysis: caseBrain,
      recommended_specialist:
        caseBrain?.routing?.recommended_specialist || null,
      attorney_review_required:
        Boolean(
          caseBrain?.review_status?.attorney_review_required
        ),
      ready_for_specialist:
        Boolean(
          caseBrain?.review_status?.ready_for_specialist
        ),
      missing_information_count:
        Array.isArray(caseBrain?.missing_information)
          ? caseBrain.missing_information.length
          : 0,
      contradictions_count:
        Array.isArray(caseBrain?.contradictions)
          ? caseBrain.contradictions.length
          : 0,
    });

    const updated = await updateMatter(matter.id, {
      matter_name:
        preview?.name ||
        detaineeName ||
        matter.matter_name,
      detainee_name: detaineeName,
      pnc_name: pncName,
      practice_area: practiceArea,
      matter_type: matterType,
      assigned_attorney: attorney,
      status,
      latest_case_brain_snapshot_id:
        snapshot?.id || matter.latest_case_brain_snapshot_id,
      monday_data: {
        ...(matter.monday_data || {}),
        monday_response:
          body?.monday ||
          body?.data?.monday ||
          matter.monday_data?.monday_response ||
          null,
      },
    });

    await insertActivity({
      matter_id: matter.id,
      monday_item_id: mondayItemId,
      event_type:
        action === "refresh_case_brain"
          ? "case_brain_refreshed"
          : "case_brain_completed",
      agent_id: "casebrain",
      actor: "Case Brain",
      title:
        action === "refresh_case_brain"
          ? "Case Brain analysis refreshed"
          : "Case Brain review ready",
      detail: `Recommended route: ${
        caseBrain?.routing?.recommended_specialist ||
        "unknown"
      }`,
      metadata: {
        snapshot_id: snapshot?.id || null,
        recommended_specialist:
          caseBrain?.routing?.recommended_specialist || null,
      },
    });

    // Keep Atlas synchronized with the newest factual record.
    // Atlas is a separate synthesis layer; it never overwrites Case Brain.
    const atlasResponse = await fetch(
      new URL("/api/pipeline/start-agent", request.nextUrl.origin),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mondayItemId,
          agentId: "synthesis",
        }),
        cache: "no-store",
      }
    );

    if (!atlasResponse.ok) {
      await insertActivity({
        matter_id: matter.id,
        monday_item_id: mondayItemId,
        event_type: "intelligence_manager_start_error",
        agent_id: "synthesis",
        actor: "Case Brain",
        title: "Atlas refresh could not start",
        detail: await atlasResponse.text(),
        metadata: { source: "case_brain_completion" },
      });
    }

    // Auto-pipeline:
    // Case Brain -> Lex first. Lex then hands off to the primary specialist.
    if (matter.pipeline_auto_enabled !== false) {
      const decision = chooseAfterCaseBrain(caseBrain);

      await recordPipelineTransition({
        mondayItemId,
        fromStage: "case_brain",
        decision,
      });

      if (decision.nextAgent) {
        const pipelineResponse = await fetch(
          new URL("/api/pipeline/start-agent", request.nextUrl.origin),
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

        if (!pipelineResponse.ok) {
          await insertActivity({
            matter_id: matter.id,
            monday_item_id: mondayItemId,
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

    const latestMatter = await getMatterByMondayId(mondayItemId);

    const storedMatter = await buildStoredMatter(
      latestMatter || updated || matter
    );

    return NextResponse.json({
      ok: true,
      saved: "analysis",
      snapshotId: snapshot?.id || null,
      matter: storedMatter,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the Case Brain callback.",
      },
      { status: 500 }
    );
  }
}

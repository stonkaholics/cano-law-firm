import { NextRequest, NextResponse } from "next/server";
import {
  buildStoredMatter,
  getMatterByMondayId,
  insertActivity,
  insertSnapshot,
  updateMatter,
  upsertMatter,
} from "../../../../lib/supabase/matters";

const DEFAULT_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-ai-santiago-assign-matter";

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
  const body = await request.json();

  if (!body?.matterId && !body?.mondayItemId) {
    return NextResponse.json(
      { ok: false, error: "A Monday matter ID is required." },
      { status: 400 }
    );
  }

  const mondayItemId = String(
    body.mondayItemId || body.matterId
  );

  const action =
    body.action === "refresh_case_brain"
      ? "refresh_case_brain"
      : "start_case_brain";

  const webhook =
    process.env.N8N_SANTIAGO_START_WEBHOOK || DEFAULT_WEBHOOK;

  let sharedMatter: any = null;

  try {
    const existing = await getMatterByMondayId(mondayItemId);
    const preview = body.preview || {};
    const existingMondayData = existing?.monday_data || {};

    sharedMatter = await upsertMatter({
      monday_item_id: mondayItemId,
      matter_name:
        preview.name ||
        existing?.matter_name ||
        `Monday Matter ${mondayItemId}`,
      detainee_name:
        preview.detaineeName ||
        existing?.detainee_name ||
        preview.name ||
        null,
      pnc_name:
        preview.pncName ||
        existing?.pnc_name ||
        null,
      practice_area:
        preview.practiceArea ||
        existing?.practice_area ||
        null,
      matter_type:
        preview.matterType ||
        existing?.matter_type ||
        null,
      assigned_attorney:
        preview.attorney ||
        existing?.assigned_attorney ||
        null,
      status: "case_brain_processing",
      monday_data: {
        ...existingMondayData,
        ...(preview && Object.keys(preview).length
          ? { preview }
          : {}),
      },
    });

    if (!sharedMatter) {
      throw new Error("Unable to create or update the shared AI matter.");
    }

    await insertActivity({
      matter_id: sharedMatter.id,
      monday_item_id: mondayItemId,
      event_type:
        action === "refresh_case_brain"
          ? "case_brain_refresh_started"
          : "case_brain_started",
      agent_id: "casebrain",
      actor: "Santiago",
      title:
        action === "refresh_case_brain"
          ? "Case Brain refresh started"
          : "Case Brain analysis started",
      detail:
        action === "refresh_case_brain"
          ? "The latest Monday data is being re-pulled for a fresh Case Brain snapshot."
          : "Santiago sent the selected Monday matter to Case Brain.",
      metadata: {
        action,
      },
    });

    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_SHARED_SECRET
          ? { "x-cano-secret": process.env.N8N_SHARED_SECRET }
          : {}),
      },
      body: JSON.stringify({
        action,
        matterId: body.matterId,
        mondayItemId,
        preview: body.preview ?? null,
      }),
      cache: "no-store",
    });

    const raw = await response.text();

    if (!response.ok) {
      await updateMatter(sharedMatter.id, {
        status: "case_brain_error",
      });

      await insertActivity({
        matter_id: sharedMatter.id,
        monday_item_id: mondayItemId,
        event_type: "case_brain_error",
        agent_id: "casebrain",
        actor: "System",
        title: "Case Brain workflow error",
        detail: raw || `n8n returned ${response.status}`,
        metadata: {
          status: response.status,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: `n8n returned ${response.status}`,
          warning:
            raw || "The assign-matter workflow returned an error.",
        },
        { status: 502 }
      );
    }

    let data: any = {};

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { ok: true, message: raw };
      }
    }

    const caseBrain =
      data?.caseBrain ||
      data?.data?.caseBrain ||
      null;

    if (!caseBrain) {
      throw new Error(
        "n8n completed but did not return a Case Brain analysis."
      );
    }

    const caseBrainStatus =
      data?.caseBrainStatus ||
      data?.status ||
      data?.data?.caseBrainStatus ||
      "review_ready";

    const detaineeName =
      getPersonName(caseBrain?.people?.detainee) ||
      body.preview?.detaineeName ||
      body.preview?.name ||
      sharedMatter.detainee_name ||
      null;

    const pncName =
      getPersonName(caseBrain?.people?.pnc) ||
      body.preview?.pncName ||
      sharedMatter.pnc_name ||
      null;

    const practiceArea =
      caseBrain?.matter?.practice_area ||
      body.preview?.practiceArea ||
      sharedMatter.practice_area ||
      null;

    const matterType =
      caseBrain?.matter?.matter_type ||
      body.preview?.matterType ||
      sharedMatter.matter_type ||
      null;

    const attorney =
      caseBrain?.matter?.assigned_attorney ||
      body.preview?.attorney ||
      sharedMatter.assigned_attorney ||
      null;

    const snapshot = await insertSnapshot({
      matter_id: sharedMatter.id,
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

    const updated = await updateMatter(sharedMatter.id, {
      matter_name:
        body.preview?.name ||
        detaineeName ||
        sharedMatter.matter_name,
      detainee_name: detaineeName,
      pnc_name: pncName,
      practice_area: practiceArea,
      matter_type: matterType,
      assigned_attorney: attorney,
      status: caseBrainStatus,
      latest_case_brain_snapshot_id:
        snapshot?.id || null,
      monday_data: {
        ...(sharedMatter.monday_data || {}),
        ...(body.preview
          ? { preview: body.preview }
          : {}),
        monday_response:
          data?.monday ||
          data?.data?.monday ||
          null,
      },
    });

    await insertActivity({
      matter_id: sharedMatter.id,
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

    const storedMatter = await buildStoredMatter(
      updated || sharedMatter
    );

    return NextResponse.json({
      ok: true,
      matterId: mondayItemId,
      mondayItemId,
      databaseId: storedMatter?.databaseId || sharedMatter.id,
      snapshotId: snapshot?.id || null,
      caseBrainStatus,
      monday:
        data?.monday ||
        data?.data?.monday || {
          found: true,
          fieldsImported:
            data?.fieldsImported ??
            data?.data?.fieldsImported ??
            undefined,
        },
      caseBrain,
      warning: data?.warning || null,
      message:
        data?.message ||
        "Monday matter analyzed by Case Brain and saved to Supabase.",
      savedAt:
        snapshot?.created_at ||
        new Date().toISOString(),
      storedMatter,
    });
  } catch (error) {
    if (sharedMatter?.id) {
      try {
        await updateMatter(sharedMatter.id, {
          status: "case_brain_error",
        });

        await insertActivity({
          matter_id: sharedMatter.id,
          monday_item_id: mondayItemId,
          event_type: "case_brain_error",
          agent_id: "casebrain",
          actor: "System",
          title: "Case Brain persistence error",
          detail:
            error instanceof Error
              ? error.message
              : "Unknown Case Brain persistence error.",
          metadata: {},
        });
      } catch {}
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process the shared Case Brain matter.",
      },
      { status: 500 }
    );
  }
}

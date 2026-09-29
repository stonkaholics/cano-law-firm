import { NextRequest, NextResponse } from "next/server";
import {
  buildStoredMatter,
  getMatterByMondayId,
  insertActivity,
  upsertMatter,
} from "../../../../lib/supabase/matters";

const DEFAULT_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-ai-santiago-assign-matter";

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

  try {
    const existing = await getMatterByMondayId(mondayItemId);
    const preview = body.preview || {};
    const existingMondayData = existing?.monday_data || {};
    const attorneyCaseNotes = String(body.attorneyCaseNotes || "").trim();
    const intakeSource =
      attorneyCaseNotes
        ? "attorney_case_notes"
        : "monday_short_case_summary";

    const matter = await upsertMatter({
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
        intakeSource,
        attorneyCaseNotes: attorneyCaseNotes || null,
        originalMondaySummary:
          preview.originalMondaySummary ||
          existingMondayData?.originalMondaySummary ||
          existingMondayData?.preview?.notesPreview ||
          null,
      },
    });

    if (!matter) {
      throw new Error("Unable to create or update the shared AI matter.");
    }

    await insertActivity({
      matter_id: matter.id,
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
          ? "The latest matter data is being re-pulled for a fresh Case Brain snapshot."
          : attorneyCaseNotes
          ? "Santiago sent the selected matter to Case Brain using attorney-supplied intake notes."
          : "Santiago sent the selected Monday matter to Case Brain using the Monday Short Case Summary.",
      metadata: {
        action,
        intakeSource,
        attorneyCaseNotesProvided: Boolean(attorneyCaseNotes),
      },
    });

    const callbackUrl = new URL(
      "/api/case-brain/complete",
      request.nextUrl.origin
    ).toString();

    // IMPORTANT:
    // This request is expected to return quickly because the n8n Webhook
    // must be configured to "Respond Immediately". n8n continues the
    // Case Brain workflow after acknowledging receipt.
    const n8nResponse = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_SHARED_SECRET
          ? { "x-cano-secret": process.env.N8N_SHARED_SECRET }
          : {}),
      },
      body: JSON.stringify({
        action,
        matterId: mondayItemId,
        mondayItemId,
        preview: body.preview ?? null,
        attorneyCaseNotes: attorneyCaseNotes || null,
        intakeSource,
        callbackUrl,
      }),
      cache: "no-store",
    });

    const ackText = await n8nResponse.text();

    if (!n8nResponse.ok) {
      throw new Error(
        `n8n could not accept the Case Brain job (${n8nResponse.status}): ${
          ackText || n8nResponse.statusText
        }`
      );
    }

    const storedMatter = await buildStoredMatter(matter);

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        matterId: mondayItemId,
        mondayItemId,
        databaseId: matter.id,
        caseBrainStatus: "case_brain_processing",
        message:
          action === "refresh_case_brain"
            ? "Refresh started. Case Brain is analyzing the latest Monday data."
            : "Matter received. Case Brain is analyzing in the background.",
        storedMatter,
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start the Case Brain job.",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  SPECIALIST_AGENTS,
  isSpecialistAgentId,
  insertAgentRun,
  getLatestSpecialistState,
} from "../../../../lib/supabase/agents";
import {
  buildStoredMatter,
  getMatterByMondayId,
  insertActivity,
} from "../../../../lib/supabase/matters";
import { FIRM_HABEAS_DRAFTING_PROFILE } from "../../../../lib/legal/firm-habeas-profile";
import { getFirmDraftingExamplesForMatter } from "../../../../lib/legal/firm-drafting-library";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const mondayItemId = String(body?.mondayItemId || "");
  const agentId = String(body?.agentId || "");
  const triggerType = String(body?.triggerType || "manual");
  const options =
    body?.options && typeof body.options === "object"
      ? body.options
      : {};

  if (!mondayItemId || !agentId) {
    return NextResponse.json(
      { ok: false, error: "mondayItemId and agentId are required." },
      { status: 400 }
    );
  }

  if (!isSpecialistAgentId(agentId)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported specialist agent: ${agentId}` },
      { status: 400 }
    );
  }

  const webhook = process.env.N8N_SPECIALIST_AGENT_WEBHOOK;

  if (!webhook) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing N8N_SPECIALIST_AGENT_WEBHOOK. Add the generic specialist workflow webhook in Vercel.",
      },
      { status: 500 }
    );
  }

  try {
    const matter = await getMatterByMondayId(mondayItemId);

    if (!matter) {
      return NextResponse.json(
        { ok: false, error: "Matter not found in Supabase." },
        { status: 404 }
      );
    }

    const storedMatter = await buildStoredMatter(matter);

    if (!storedMatter?.caseBrain) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Case Brain must be completed before a specialist agent can run.",
        },
        { status: 409 }
      );
    }

    const priorAgents = await getLatestSpecialistState(matter.id);
    const config = SPECIALIST_AGENTS[agentId];

    const existingState = priorAgents[agentId];
    if (existingState?.run?.status === "working") {
      return NextResponse.json(
        {
          ok: true,
          accepted: true,
          deduplicated: true,
          runId: existingState.run.id,
          agentId,
          agentName: config.name,
          status: "working",
        },
        { status: 202 }
      );
    }

    let firmDraftingExamples: any = null;

    if (
      agentId === "drafting" &&
      String((options as any)?.draftType || "").toLowerCase() === "habeas"
    ) {
      try {
        firmDraftingExamples = await getFirmDraftingExamplesForMatter({
          matter: storedMatter,
          priorSpecialists: Object.fromEntries(
            Object.entries(priorAgents).map(([id, state]: [string, any]) => [
              id,
              state?.output || null,
            ])
          ),
          draftType: "habeas",
        });
      } catch (error) {
        console.warn(
          "Firm drafting exemplar retrieval unavailable; continuing with static Cano drafting profile.",
          error
        );
      }
    }

    const draftingRequest =
      agentId === "drafting" &&
      String((options as any)?.draftType || "").toLowerCase() === "habeas"
        ? {
            ...options,
            firmDraftingProfile: FIRM_HABEAS_DRAFTING_PROFILE,
            firmDraftingExamples,
            firmTemplateStatus:
              firmDraftingExamples?.chunks?.length
                ? "cano_habeas_rag_v1"
                : "cano_habeas_exemplars_v1",
          }
        : options;

    const inputPayload = {
      matter: storedMatter,
      request: draftingRequest,
      prior_specialists: Object.fromEntries(
        Object.entries(priorAgents).map(([id, state]: [string, any]) => [
          id,
          state?.output || null,
        ])
      ),
    };

    const run = await insertAgentRun({
      matter_id: matter.id,
      monday_item_id: mondayItemId,
      agent_id: agentId,
      agent_name: config.name,
      trigger_type: triggerType,
      status: "working",
      input_payload: inputPayload,
      started_at: new Date().toISOString(),
    });

    if (!run) {
      throw new Error("Unable to create specialist agent run.");
    }

    await insertActivity({
      matter_id: matter.id,
      monday_item_id: mondayItemId,
      event_type: "specialist_started",
      agent_id: agentId,
      actor: "Santiago",
      title: `${config.name} started`,
      detail: `${config.routeLabel} is analyzing the active matter.`,
      metadata: {
        run_id: run.id,
        trigger_type: triggerType,
      },
    });

    const callbackUrl = new URL(
      "/api/agents/complete",
      request.nextUrl.origin
    ).toString();

    // Send the legal-authority endpoint explicitly with every specialist job.
    // n8n should not have to reconstruct the Vercel origin.
    const authorityResearchUrl = new URL(
      "/api/legal-authorities/research",
      request.nextUrl.origin
    ).toString();

    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_SHARED_SECRET
          ? { "x-cano-secret": process.env.N8N_SHARED_SECRET }
          : {}),
      },
      body: JSON.stringify({
        action: "run_specialist_agent",
        runId: run.id,
        agentId,
        agentName: config.name,
        mondayItemId,
        databaseMatterId: matter.id,
        triggerType,
        callbackUrl,
        authorityResearchUrl,
        input: inputPayload,
      }),
      cache: "no-store",
    });

    const ack = await response.text();

    if (!response.ok) {
      throw new Error(
        `n8n could not accept ${config.name} (${response.status}): ${
          ack || response.statusText
        }`
      );
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        runId: run.id,
        agentId,
        agentName: config.name,
        status: "working",
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
            : "Unable to start specialist agent.",
      },
      { status: 500 }
    );
  }
}

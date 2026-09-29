import { NextRequest, NextResponse } from "next/server";
import {
  buildStoredMatter,
  getMatterByMondayId,
  insertActivity,
  insertAssignment,
  updateMatter,
} from "../../../lib/supabase/matters";

const ROUTES: Record<
  string,
  { agentId: string; agentName: string; assignmentType: string }
> = {
  "Elena · Habeas": {
    agentId: "habeas",
    agentName: "Elena",
    assignmentType: "habeas",
  },
  "Mateo · Bond": {
    agentId: "bond",
    agentName: "Mateo",
    assignmentType: "bond",
  },
  "Lex · Research": {
    agentId: "research",
    agentName: "Lex",
    assignmentType: "research",
  },
  "Docket · Documents": {
    agentId: "documents",
    agentName: "Docket",
    assignmentType: "documents",
  },
  "Chronos · Timeline": {
    agentId: "timeline",
    agentName: "Chronos",
    assignmentType: "timeline",
  },
  "Veritas · Filing QA": {
    agentId: "qa",
    agentName: "Veritas",
    assignmentType: "qa",
  },
  "Avery · Hearing Prep": {
    agentId: "hearing",
    agentName: "Avery",
    assignmentType: "hearing",
  },
  "Atlas · Matter Intelligence": {
    agentId: "synthesis",
    agentName: "Atlas",
    assignmentType: "synthesis",
  },
  "Attorney Review": {
    agentId: "attorney_review",
    agentName: "Attorney Review",
    assignmentType: "attorney_review",
  },
};

export async function POST(request: NextRequest) {
  const body = await request.json();

  const mondayItemId = String(body?.mondayItemId || "");
  const target = String(body?.target || "");

  if (!mondayItemId || !target) {
    return NextResponse.json(
      { ok: false, error: "mondayItemId and target are required." },
      { status: 400 }
    );
  }

  const route = ROUTES[target];

  if (!route) {
    return NextResponse.json(
      { ok: false, error: `Unsupported route: ${target}` },
      { status: 400 }
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

    const routedAt = new Date().toISOString();

    await updateMatter(matter.id, {
      current_route: target,
      routed_by: body.routedBy || "Santiago",
      routed_at: routedAt,
    });

    const assignment = await insertAssignment({
      matter_id: matter.id,
      monday_item_id: matter.monday_item_id,
      agent_id: route.agentId,
      agent_name: route.agentName,
      assignment_type: route.assignmentType,
      status: "assigned",
      assigned_by: body.routedBy || "Santiago",
      notes: body.notes || null,
      assigned_at: routedAt,
    });

    await insertActivity({
      matter_id: matter.id,
      monday_item_id: matter.monday_item_id,
      event_type: "routing_selected",
      agent_id: route.agentId,
      actor: body.routedBy || "Santiago",
      title: `Routed to: ${target}`,
      detail: "Routing decision recorded in the shared Cano AI matter history.",
      metadata: {
        assignment_id: assignment?.id || null,
        target,
      },
    });

    const updatedMatter = await getMatterByMondayId(mondayItemId);
    const storedMatter = await buildStoredMatter(updatedMatter);

    return NextResponse.json({
      ok: true,
      matter: storedMatter,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to route the matter.",
      },
      { status: 500 }
    );
  }
}

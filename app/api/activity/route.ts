import { NextRequest, NextResponse } from "next/server";
import {
  getMatterByMondayId,
  insertActivity,
} from "../../../lib/supabase/matters";
import { supabaseSelect } from "../../../lib/supabase/rest";

export async function GET(request: NextRequest) {
  const mondayItemId =
    request.nextUrl.searchParams.get("mondayItemId") || "";

  if (!mondayItemId) {
    return NextResponse.json(
      { ok: false, error: "mondayItemId is required." },
      { status: 400 }
    );
  }

  try {
    const matter = await getMatterByMondayId(mondayItemId);

    if (!matter) {
      return NextResponse.json({
        ok: true,
        activity: [],
      });
    }

    const rows = await supabaseSelect("matter_activity", {
      select: "*",
      matter_id: `eq.${matter.id}`,
      order: "created_at.desc",
      limit: 100,
    });

    return NextResponse.json({
      ok: true,
      activity: rows.map((row: any) => ({
        id: row.id,
        type: row.event_type,
        title: row.title,
        detail: row.detail,
        timestamp: row.created_at,
        matterId: row.monday_item_id,
        agentId: row.agent_id,
        actor: row.actor,
        metadata: row.metadata,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load matter activity.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body?.mondayItemId || !body?.eventType || !body?.title) {
    return NextResponse.json(
      {
        ok: false,
        error: "mondayItemId, eventType, and title are required.",
      },
      { status: 400 }
    );
  }

  try {
    const matter = await getMatterByMondayId(
      String(body.mondayItemId)
    );

    if (!matter) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The matter must exist in Supabase before activity can be attached.",
        },
        { status: 404 }
      );
    }

    const activity = await insertActivity({
      matter_id: matter.id,
      monday_item_id: matter.monday_item_id,
      event_type: String(body.eventType),
      agent_id: body.agentId || "santiago",
      actor: body.actor || "Santiago",
      title: String(body.title),
      detail: body.detail || null,
      metadata: body.metadata || {},
    });

    return NextResponse.json({
      ok: true,
      activity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save matter activity.",
      },
      { status: 500 }
    );
  }
}

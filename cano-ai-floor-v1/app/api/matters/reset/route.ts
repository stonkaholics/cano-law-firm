import { NextRequest, NextResponse } from "next/server";
import {
  supabaseDelete,
  supabaseUpdate,
} from "../../../../lib/supabase/rest";
import {
  getMatterByMondayId,
} from "../../../../lib/supabase/matters";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const mondayItemId = String(body?.mondayItemId || "").trim();
  const mode = String(body?.mode || "all_ai").trim();

  if (!mondayItemId) {
    return NextResponse.json(
      { ok: false, error: "mondayItemId is required." },
      { status: 400 }
    );
  }

  if (!["all_ai", "case_brain_only", "remove_from_workspace"].includes(mode)) {
    return NextResponse.json(
      { ok: false, error: "Unsupported reset mode." },
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

    const matterId = matter.id;

    if (mode === "all_ai" || mode === "remove_from_workspace") {
      // Delete child records in FK-safe order.
      await supabaseDelete("agent_outputs", {
        matter_id: `eq.${matterId}`,
      });

      await supabaseDelete("agent_runs", {
        matter_id: `eq.${matterId}`,
      });

      await supabaseDelete("agent_assignments", {
        matter_id: `eq.${matterId}`,
      });

      await supabaseDelete("matter_activity", {
        matter_id: `eq.${matterId}`,
      });

      // This table was added with the pipeline migration. If it does not exist
      // in an older environment, allow the reset to continue.
      try {
        await supabaseDelete("matter_pipeline_events", {
          matter_id: `eq.${matterId}`,
        });
      } catch {}

      await supabaseDelete("case_brain_snapshots", {
        matter_id: `eq.${matterId}`,
      });
    } else {
      await supabaseDelete("case_brain_snapshots", {
        matter_id: `eq.${matterId}`,
      });
    }

    if (mode === "remove_from_workspace") {
      await supabaseDelete("ai_matters", {
        id: `eq.${matterId}`,
      });

      return NextResponse.json({
        ok: true,
        mode,
        mondayItemId,
        matterId,
        removed: true,
        preserved: [
          "Monday.com source item",
          "Monday intake/source data outside Cano AI",
        ],
      });
    }

    const rows = await supabaseUpdate(
      "ai_matters",
      { id: `eq.${matterId}` },
      {
        status: "ready",
        latest_case_brain_snapshot_id: null,

        ...(mode === "all_ai"
          ? {
              current_route: null,
              routed_by: null,
              routed_at: null,
              pipeline_status: "idle",
              pipeline_stage: null,
              pipeline_next_agent: null,
              pipeline_auto_enabled: true,
            }
          : {}),

        updated_at: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      ok: true,
      mode,
      mondayItemId,
      matterId,
      matter: rows?.[0] || null,
      preserved: [
        "ai_matters row",
        "monday_item_id",
        "monday_data",
        "matter / detainee / PNC metadata",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset matter.",
      },
      { status: 500 }
    );
  }
}

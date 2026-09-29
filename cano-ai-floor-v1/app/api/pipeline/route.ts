import { NextRequest, NextResponse } from "next/server";
import {
  buildStoredMatter,
  getMatterByMondayId,
  insertActivity,
  updateMatter,
} from "../../../lib/supabase/matters";

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

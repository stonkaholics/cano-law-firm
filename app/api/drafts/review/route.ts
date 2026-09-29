import { NextRequest, NextResponse } from "next/server";
import {
  getLatestRunForAgent,
  getOutputForRun,
} from "../../../../lib/supabase/agents";
import {
  getMatterByMondayId,
  insertActivity,
} from "../../../../lib/supabase/matters";
import { supabaseUpdate } from "../../../../lib/supabase/rest";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const mondayItemId = String(body?.mondayItemId || "");
  const decision = String(body?.decision || "");

  if (!mondayItemId || !["approved", "needs_changes"].includes(decision)) {
    return NextResponse.json(
      { ok: false, error: "mondayItemId and a valid decision are required." },
      { status: 400 }
    );
  }

  try {
    const matter = await getMatterByMondayId(mondayItemId);
    if (!matter) {
      return NextResponse.json({ ok: false, error: "Matter not found." }, { status: 404 });
    }

    const run = await getLatestRunForAgent(matter.id, "drafting");
    if (!run) {
      return NextResponse.json({ ok: false, error: "No Scribe draft exists for this matter." }, { status: 404 });
    }

    const outputRecord = await getOutputForRun(run.id);
    if (!outputRecord) {
      return NextResponse.json({ ok: false, error: "Draft output record not found." }, { status: 404 });
    }

    const nextOutput = {
      ...(outputRecord.output || {}),
      draft: {
        ...((outputRecord.output || {}).draft || {}),
        approval_status: decision,
        reviewed_at: new Date().toISOString(),
      },
    };

    const rows = await supabaseUpdate<any>(
      "agent_outputs",
      { id: `eq.${outputRecord.id}` },
      { output: nextOutput }
    );

    await insertActivity({
      matter_id: matter.id,
      monday_item_id: mondayItemId,
      event_type: "draft_reviewed",
      agent_id: "drafting",
      actor: "Attorney Review",
      title: decision === "approved" ? "Draft approved" : "Draft needs changes",
      detail: `Scribe draft marked ${decision.replaceAll("_", " ")}.`,
      metadata: { run_id: run.id, output_id: outputRecord.id, decision },
    });

    return NextResponse.json({ ok: true, decision, output: rows?.[0]?.output || nextOutput });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to review draft." },
      { status: 500 }
    );
  }
}

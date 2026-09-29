import { NextRequest, NextResponse } from "next/server";
import {
  getMatterById,
  buildStoredMatter,
} from "../../../../lib/supabase/matters";
import {
  isSpecialistAgentId,
} from "../../../../lib/supabase/agents";
import { supabaseSelect } from "../../../../lib/supabase/rest";

export async function GET(request: NextRequest) {
  const agentId =
    request.nextUrl.searchParams.get("agentId") || "";

  if (!isSpecialistAgentId(agentId)) {
    return NextResponse.json(
      { ok: false, error: "A valid agentId is required." },
      { status: 400 }
    );
  }

  try {
    const runs = await supabaseSelect<any>("agent_runs", {
      select: "*",
      agent_id: `eq.${agentId}`,
      order: "started_at.desc",
      limit: 100,
    });

    const seen = new Set<string>();
    const queue: any[] = [];

    for (const run of runs) {
      if (seen.has(run.matter_id)) continue;
      seen.add(run.matter_id);

      const dbMatter = await getMatterById(run.matter_id);
      if (!dbMatter) continue;

      const matter = await buildStoredMatter(dbMatter);

      queue.push({
        run,
        matter,
        name:
          dbMatter.detainee_name ||
          dbMatter.matter_name ||
          `Matter ${dbMatter.monday_item_id}`,
        pncName: dbMatter.pnc_name,
        practiceArea: dbMatter.practice_area,
        route: dbMatter.current_route,
      });
    }

    return NextResponse.json({
      ok: true,
      agentId,
      queue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load agent queue.",
      },
      { status: 500 }
    );
  }
}

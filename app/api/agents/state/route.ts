import { NextRequest, NextResponse } from "next/server";
import { getMatterByMondayId } from "../../../../lib/supabase/matters";
import { getLatestSpecialistState } from "../../../../lib/supabase/agents";

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
      return NextResponse.json(
        { ok: false, error: "Matter not found." },
        { status: 404 }
      );
    }

    const agents = await getLatestSpecialistState(matter.id);

    return NextResponse.json({
      ok: true,
      matterId: matter.id,
      mondayItemId,
      agents,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load specialist agent state.",
      },
      { status: 500 }
    );
  }
}

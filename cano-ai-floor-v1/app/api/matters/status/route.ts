import { NextRequest, NextResponse } from "next/server";
import {
  buildStoredMatter,
  getMatterByMondayId,
} from "../../../../lib/supabase/matters";

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

    const storedMatter = await buildStoredMatter(matter);

    return NextResponse.json({
      ok: true,
      status: matter.status,
      matter: storedMatter,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load matter status.",
      },
      { status: 500 }
    );
  }
}

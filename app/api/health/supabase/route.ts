import { NextResponse } from "next/server";
import { supabaseSelect } from "../../../../lib/supabase/rest";

export async function GET() {
  const hasUrl = Boolean(process.env.SUPABASE_URL);
  const hasSecret = Boolean(process.env.SUPABASE_SECRET_KEY);

  if (!hasUrl || !hasSecret) {
    return NextResponse.json(
      {
        ok: false,
        stage: "environment",
        hasUrl,
        hasSecret,
        error:
          "Supabase environment variables are missing from this Vercel deployment.",
      },
      { status: 500 }
    );
  }

  try {
    const rows = await supabaseSelect("ai_matters", {
      select: "id,monday_item_id,status",
      limit: 1,
    });

    return NextResponse.json({
      ok: true,
      stage: "database",
      message: "Supabase connection is working.",
      sampleRowCount: rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "database",
        hasUrl,
        hasSecret,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Supabase connection error.",
      },
      { status: 500 }
    );
  }
}

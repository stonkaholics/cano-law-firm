import {
  NextResponse,
} from "next/server";

import {
  getSupabaseServerKeyInfo,
  supabaseSelect,
} from "../../../../lib/supabase/rest";

export async function GET() {
  const hasUrl =
    Boolean(
      process.env
        .SUPABASE_URL ||
      process.env
        .NEXT_PUBLIC_SUPABASE_URL
    );

  const keyInfo =
    getSupabaseServerKeyInfo();

  if (
    !hasUrl ||
    !keyInfo.configured
  ) {
    return NextResponse.json(
      {
        ok: false,
        stage:
          "environment",
        hasUrl,
        keyInfo,
        error:
          "Supabase server environment variables are missing.",
      },
      {
        status: 500,
      }
    );
  }

  try {
    const rows =
      await supabaseSelect(
        "ai_matters",
        {
          select:
            "id,monday_item_id,status",
          order:
            "updated_at.desc",
          limit: 5,
        }
      );

    return NextResponse.json({
      ok: true,
      stage:
        "database",
      keyInfo,
      sampleRowCount:
        rows.length,
      sampleMatterIds:
        rows.map(
          (row: any) =>
            row.monday_item_id
        ),
      message:
        rows.length
          ? "Supabase server connection is working and ai_matters is visible."
          : "Supabase connection succeeded but ai_matters returned zero visible rows.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage:
          "database",
        hasUrl,
        keyInfo,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Supabase connection error.",
      },
      {
        status: 500,
      }
    );
  }
}

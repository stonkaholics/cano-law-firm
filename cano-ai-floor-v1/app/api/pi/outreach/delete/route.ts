import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseDelete,
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

type OutreachEvent = {
  id: string;
  status?: string;
  metadata?: Record<string, any>;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const outreachEventId =
      clean(
        body?.outreachEventId ||
        body?.outreach_event_id
      );

    if (!outreachEventId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "outreachEventId is required.",
        },
        { status: 400 }
      );
    }

    const rows =
      await supabaseSelect<OutreachEvent>(
        "pi_outreach_events",
        {
          select:
            "id,status,metadata",

          id:
            `eq.${outreachEventId}`,

          limit: 1,
        }
      );

    const draft =
      rows[0] || null;

    if (!draft) {
      return NextResponse.json({
        ok: true,
        alreadyDeleted:
          true,
      });
    }

    const status =
      clean(
        draft.status
      ).toLowerCase();

    if (
      status === "sent" ||
      clean(
        draft.metadata
          ?.send_status
      ).toLowerCase() ===
        "sent"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sent outreach is preserved for audit history and cannot be deleted from Reach.",
        },
        { status: 409 }
      );
    }

    await supabaseDelete(
      "pi_compliance_reviews",
      {
        subject_type:
          "eq.outreach_event",

        subject_id:
          `eq.${outreachEventId}`,
      }
    );

    await supabaseDelete(
      "pi_outreach_events",
      {
        id:
          `eq.${outreachEventId}`,
      }
    );

    return NextResponse.json({
      ok: true,
      deleted:
        outreachEventId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete Reach draft.",
      },
      { status: 500 }
    );
  }
}

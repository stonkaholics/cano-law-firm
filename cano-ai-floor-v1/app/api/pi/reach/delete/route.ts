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
  status: string;
  channel: string;
  metadata: Record<string, any>;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function eq(value: string) {
  return `eq.${value}`;
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
            "id,status,channel,metadata",
          id:
            eq(outreachEventId),
          limit:
            1,
        }
      );

    const draft =
      rows[0] || null;

    if (!draft) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Reach draft was not found.",
        },
        { status: 404 }
      );
    }

    const status =
      clean(
        draft.status
      ).toLowerCase();

    const channel =
      clean(
        draft.channel
      ).toLowerCase();

    const agent =
      clean(
        draft.metadata?.agent
      ).toLowerCase();

    const isReachDraft =
      status === "draft" &&
      channel === "email" &&
      (
        !agent ||
        agent === "reach"
      );

    if (!isReachDraft) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only unsent Reach email drafts can be deleted.",
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
          eq(outreachEventId),
      }
    );

    const deleted =
      await supabaseDelete<OutreachEvent>(
        "pi_outreach_events",
        {
          id:
            eq(outreachEventId),
          status:
            "eq.draft",
        }
      );

    if (!deleted.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The Reach draft could not be deleted or is no longer a draft.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
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

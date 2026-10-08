import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "../../../../../lib/supabase/rest";

type Draft = {
  id: string;
  status: string;
  metadata: Record<string, any>;
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

    const decision =
      clean(
        body?.decision
      ).toLowerCase();

    if (
      !outreachEventId ||
      ![
        "approved",
        "rejected",
      ].includes(decision)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "outreachEventId and an approved/rejected decision are required.",
        },
        { status: 400 }
      );
    }

    const drafts =
      await supabaseSelect<Draft>(
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
      drafts[0] || null;

    if (!draft) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Reach draft not found.",
        },
        { status: 404 }
      );
    }

    if (
      clean(
        draft.status
      ).toLowerCase() !==
      "draft"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `This draft is already ${draft.status}.`,
        },
        { status: 409 }
      );
    }

    const reviewedAt =
      new Date().toISOString();

    const reviewer =
      "Cano Law Firm Human Reviewer";

    const metadata = {
      ...(draft.metadata &&
      typeof draft.metadata ===
        "object"
        ? draft.metadata
        : {}),
      human_review: {
        decision,
        reviewed_at:
          reviewedAt,
        reviewed_by:
          reviewer,
      },
      send_status:
        decision === "approved"
          ? "approved_not_sent"
          : "rejected",
    };

    const updated =
      await supabaseUpdate(
        "pi_outreach_events",
        {
          id:
            `eq.${outreachEventId}`,
        },
        {
          status:
            decision,
          approved_by:
            decision === "approved"
              ? reviewer
              : "",
          approved_at:
            decision === "approved"
              ? reviewedAt
              : null,
          metadata,
        }
      );

    await supabaseInsert(
      "pi_compliance_reviews",
      {
        review_type:
          "professional_referral_outreach_human_decision",
        subject_type:
          "outreach_event",
        subject_id:
          outreachEventId,
        status:
          decision,
        notes:
          decision === "approved"
            ? "Human reviewer approved the Reach draft. It is now Ready to Send in Reach; external delivery still requires a separate explicit Send Email action."
            : "Human reviewer rejected the Reach draft.",
        reviewed_by:
          reviewer,
        reviewed_at:
          reviewedAt,
        metadata: {
          agent:
            "human_guard",
          decision,
          external_send_enabled:
            decision === "approved",
        },
      }
    );

    return NextResponse.json({
      ok: true,
      decision,
      row:
        updated[0] || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save Guard decision.",
      },
      { status: 500 }
    );
  }
}

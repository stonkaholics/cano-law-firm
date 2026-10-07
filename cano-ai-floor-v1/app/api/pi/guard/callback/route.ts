import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseInsert,
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

type Draft = {
  id: string;
  referral_prospect_id: string | null;
  channel: string;
  direction: string;
  status: string;
  subject: string;
  message_summary: string;
  created_at: string;
  metadata: Record<string, any>;
};

type Prospect = {
  id: string;
  organization_name: string;
  category: string;
  practice_area: string;
  city: string;
  state: string;
  website: string;
  why_fit: string;
  score: number;
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
  const expectedSecret =
    process.env.N8N_SHARED_SECRET;

  if (expectedSecret) {
    const supplied =
      request.headers.get(
        "x-cano-secret"
      );

    if (
      !supplied ||
      supplied !== expectedSecret
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unauthorized Guard callback.",
        },
        { status: 401 }
      );
    }
  }

  try {
    const body =
      await request.json();

    const action =
      clean(
        body?.action
      );

    if (
      action ===
      "get_guard_outreach_context"
    ) {
      const outreachEventId =
        clean(
          body?.outreach_event_id ||
          body?.outreachEventId
        );

      if (!outreachEventId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "outreach_event_id is required.",
          },
          { status: 400 }
        );
      }

      const drafts =
        await supabaseSelect<Draft>(
          "pi_outreach_events",
          {
            select: "*",
            id:
              eq(
                outreachEventId
              ),
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
              "Outreach event not found.",
          },
          { status: 404 }
        );
      }

      const prospectId =
        clean(
          draft.referral_prospect_id
        );

      const prospects =
        prospectId
          ? await supabaseSelect<Prospect>(
              "pi_referral_prospects",
              {
                select: "*",
                id:
                  eq(
                    prospectId
                  ),
                limit: 1,
              }
            )
          : [];

      return NextResponse.json({
        ok: true,
        draft,
        prospect:
          prospects[0] || null,
      });
    }

    if (
      action ===
      "save_guard_review"
    ) {
      const outreachEventId =
        clean(
          body?.outreach_event_id ||
          body?.outreachEventId
        );

      const review =
        body?.review &&
        typeof body.review === "object" &&
        !Array.isArray(body.review)
          ? body.review
          : {};

      if (!outreachEventId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "outreach_event_id is required.",
          },
          { status: 400 }
        );
      }

      const recommendation =
        clean(
          review.recommendation ||
          "needs_review"
        ).toLowerCase();

      const normalizedRecommendation =
        recommendation === "approve" ||
        recommendation === "block" ||
        recommendation === "needs_review"
          ? recommendation
          : "needs_review";

      const generatedAt =
        new Date().toISOString();

      /*
      |--------------------------------------------------------------------------
      | IMPORTANT: COMPLIANCE REVIEW STATUS
      |--------------------------------------------------------------------------
      |
      | pi_compliance_reviews has a database CHECK constraint on status.
      | The prior version attempted to save custom values like:
      |
      |   ai_review_approve
      |   ai_review_block
      |   ai_review_needs_review
      |
      | Those values are NOT part of the table's allowed status set, so
      | Supabase correctly rejected the insert.
      |
      | Guard AI is advisory only. Therefore every AI review is stored using
      | the existing valid workflow status:
      |
      |   needs_review
      |
      | The AI's actual recommendation is preserved separately in metadata:
      |   approve | needs_review | block
      |
      | Human Approve/Reject remains a separate action.
      |--------------------------------------------------------------------------
      */

      const rows =
        await supabaseInsert(
          "pi_compliance_reviews",
          {
            review_type:
              "professional_referral_outreach",
            subject_type:
              "outreach_event",
            subject_id:
              outreachEventId,

            status:
              "needs_review",

            notes:
              clean(
                review.summary ||
                review.notes
              ),

            reviewed_by:
              "Guard AI",

            reviewed_at:
              generatedAt,

            metadata: {
              agent:
                "guard",

              recommendation:
                normalizedRecommendation,

              confidence:
                Number(
                  review.confidence || 0
                ),

              flags:
                Array.isArray(
                  review.flags
                )
                  ? review.flags
                  : [],

              required_edits:
                Array.isArray(
                  review.required_edits
                )
                  ? review.required_edits
                  : [],

              checks:
                review.checks &&
                typeof review.checks ===
                  "object"
                  ? review.checks
                  : {},

              summary:
                clean(
                  review.summary ||
                  review.notes
                ),

              generated_at:
                generatedAt,

              human_approval_required:
                true,

              ai_review_status:
                "complete",
            },
          }
        );

      return NextResponse.json({
        ok: true,
        row:
          rows[0] || null,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          `Unsupported Guard callback action: ${action}`,
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process Guard callback.",
      },
      { status: 500 }
    );
  }
}

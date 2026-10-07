import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
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
  approved_by: string;
  approved_at: string | null;
  occurred_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  metadata: Record<string, any>;
};

type Prospect = {
  id: string;
  organization_name: string;
  practice_area: string;
  city: string;
  state: string;
};

type Review = {
  id: string;
  review_type: string;
  subject_type: string;
  subject_id: string;
  status: string;
  notes: string;
  reviewed_by: string;
  reviewed_at: string | null;
  metadata: Record<string, any>;
};

export async function GET(
  _request: NextRequest
) {
  try {
    const [drafts, reviews] =
      await Promise.all([
        supabaseSelect<Draft>(
          "pi_outreach_events",
          {
            select: "*",
            direction: "eq.outbound",
            channel: "eq.email",
            order: "created_at.desc",
            limit: 200,
          }
        ),

        supabaseSelect<Review>(
          "pi_compliance_reviews",
          {
            select: "*",
            subject_type:
              "eq.outreach_event",
            order: "reviewed_at.desc",
            limit: 300,
          }
        ),
      ]);

    const reachDrafts =
      drafts.filter((draft) => {
        const agent =
          String(
            draft.metadata?.agent ||
            ""
          )
            .trim()
            .toLowerCase();

        const status =
          String(
            draft.status ||
            ""
          )
            .trim()
            .toLowerCase();

        return (
          agent === "reach" &&
          [
            "draft",
            "approved",
            "rejected",
          ].includes(status)
        );
      });

    const prospectIds =
      Array.from(
        new Set(
          reachDrafts
            .map(
              (draft) =>
                String(
                  draft.referral_prospect_id ||
                  ""
                ).trim()
            )
            .filter(Boolean)
        )
      );

    const prospects =
      prospectIds.length
        ? await supabaseSelect<Prospect>(
            "pi_referral_prospects",
            {
              select:
                "id,organization_name,practice_area,city,state",
              id:
                `in.(${prospectIds.join(",")})`,
              limit: 500,
            }
          )
        : [];

    const prospectById =
      new Map(
        prospects.map(
          (prospect) => [
            prospect.id,
            prospect,
          ]
        )
      );

    return NextResponse.json({
      ok: true,
      drafts:
        reachDrafts.map(
          (draft) => ({
            ...draft,
            prospect:
              draft.referral_prospect_id
                ? prospectById.get(
                    draft.referral_prospect_id
                  ) || null
                : null,
          })
        ),
      reviews,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Guard state.",
      },
      { status: 500 }
    );
  }
}

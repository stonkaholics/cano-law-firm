import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseDelete,
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

type Prospect = {
  id: string;
  organization_name?: string;
};

type OutreachEvent = {
  id: string;
  status?: string;
  subject?: string;
};

type Meeting = {
  id: string;
  status?: string;
};

function clean(
  value:
    unknown
) {
  return String(
    value || ""
  ).trim();
}

function eq(
  value:
    string
) {
  return `eq.${value}`;
}

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request:
    NextRequest
) {
  try {
    const body =
      await request.json();

    const prospectId =
      clean(
        body?.prospectId ||
        body?.prospect_id
      );

    if (
      !prospectId
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "prospectId is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const prospects =
      await supabaseSelect<Prospect>(
        "pi_referral_prospects",
        {
          select:
            "id,organization_name",

          id:
            eq(
              prospectId
            ),

          limit:
            1,
        }
      );

    const prospect =
      prospects[0] ||
      null;

    if (
      !prospect
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Scout prospect was not found. It may already have been removed.",
        },
        {
          status:
            404,
        }
      );
    }

    const [
      outreach,
      meetings,
    ] =
      await Promise.all([
        supabaseSelect<OutreachEvent>(
          "pi_outreach_events",
          {
            select:
              "id,status,subject",

            referral_prospect_id:
              eq(
                prospectId
              ),

            limit:
              250,
          }
        ),

        supabaseSelect<Meeting>(
          "pi_referral_meetings",
          {
            select:
              "id,status",

            referral_prospect_id:
              eq(
                prospectId
              ),

            limit:
              100,
          }
        ),
      ]);

    /*
    |--------------------------------------------------------------------------
    | PROTECT REAL RELATIONSHIP HISTORY
    |--------------------------------------------------------------------------
    |
    | Remove is intended for bad Scout imports / incomplete research / tests so
    | the firm can be rediscovered cleanly.
    |
    | Once an email was actually sent or a referral meeting exists, the record
    | becomes relationship history and should not be hard-deleted from Scout.
    |--------------------------------------------------------------------------
    */
    const sentOutreach =
      outreach.filter(
        (row) =>
          clean(
            row.status
          ).toLowerCase() ===
          "sent"
      );

    if (
      sentOutreach.length
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          protected:
            true,

          error:
            "This firm has sent outreach history, so Scout will not hard-delete it. Use the relationship status instead so the communication audit trail is preserved.",
        },
        {
          status:
            409,
        }
      );
    }

    if (
      meetings.length
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          protected:
            true,

          error:
            "This firm has a referral meeting record, so Scout will not hard-delete it. The meeting history should be preserved.",
        },
        {
          status:
            409,
        }
      );
    }

    const outreachIds =
      outreach
        .map(
          (row) =>
            clean(
              row.id
            )
        )
        .filter(
          Boolean
        );

    /*
    | Delete Guard / compliance rows for draft-only outreach before deleting
    | the draft outreach records themselves.
    */
    if (
      outreachIds.length
    ) {
      await supabaseDelete(
        "pi_compliance_reviews",
        {
          subject_type:
            "eq.outreach_event",

          subject_id:
            `in.(${outreachIds.join(",")})`,
        }
      );

      await supabaseDelete(
        "pi_outreach_events",
        {
          referral_prospect_id:
            eq(
              prospectId
            ),
        }
      );
    }

    /*
    | Remove Scout's contact enrichment rows. This is important: leaving old
    | Apollo / contact rows around would make a "fresh" rediscovery look stale.
    */
    const deletedContacts =
      await supabaseDelete(
        "pi_referral_contacts",
        {
          prospect_id:
            eq(
              prospectId
            ),
        }
      );

    const deletedProspects =
      await supabaseDelete(
        "pi_referral_prospects",
        {
          id:
            eq(
              prospectId
            ),
        }
      );

    return NextResponse.json({
      ok:
        true,

      prospectId,

      organization_name:
        prospect
          .organization_name ||
        "",

      deleted: {
        prospects:
          deletedProspects.length,

        contacts:
          deletedContacts.length,

        draft_outreach:
          outreachIds.length,
      },

      rediscovery_eligible:
        true,

      message:
        "Scout prospect removed. Because the prospect/contact rows no longer exist, a future Scout run with excludeExisting enabled can discover the firm again using current research.",
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unable to remove Scout prospect.",
      },
      {
        status:
          500,
      }
    );
  }
}

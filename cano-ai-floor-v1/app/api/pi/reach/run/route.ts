import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

type Prospect = {
  id: string;
  organization_name: string;
  website: string;
  relationship_status: string;
};

type Contact = {
  id: string;
  prospect_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  priority: number;
  selected_for_outreach: boolean;
};

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

function normalizeUrl(
  value: string
) {
  return clean(value)
    .replace(
      /^https?:\/\//i,
      ""
    )
    .replace(
      /^www\./i,
      ""
    )
    .replace(
      /\/+$/,
      ""
    )
    .toLowerCase();
}

function eq(
  value: string
) {
  return `eq.${value}`;
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const requestedProspectId =
      clean(
        body?.prospectId ||
        body?.prospect_id
      );

    const requestedContactId =
      clean(
        body?.contactId ||
        body?.contact_id
      );

    const organizationName =
      clean(
        body?.organizationName
      );

    const website =
      clean(
        body?.website
      );

    let prospect:
      | Prospect
      | null =
      null;

    /*
    |--------------------------------------------------------------------------
    | PRIMARY LOOKUP: DATABASE ID
    |--------------------------------------------------------------------------
    |
    | The dedicated Reach Workstation sends the exact Scout prospect ID.
    | Keep organization-name fallback for compatibility with the earlier
    | Draft Outreach bridge.
    |--------------------------------------------------------------------------
    */

    if (
      requestedProspectId
    ) {
      const rows =
        await supabaseSelect<Prospect>(
          "pi_referral_prospects",
          {
            select:
              "id,organization_name,website,relationship_status",
            id:
              eq(
                requestedProspectId
              ),
            limit:
              1,
          }
        );

      prospect =
        rows[0] ||
        null;
    }

    if (
      !prospect &&
      organizationName
    ) {
      const prospects =
        await supabaseSelect<Prospect>(
          "pi_referral_prospects",
          {
            select:
              "id,organization_name,website,relationship_status",
            organization_name:
              eq(
                organizationName
              ),
            limit:
              20,
          }
        );

      const normalizedWebsite =
        normalizeUrl(
          website
        );

      prospect =
        prospects.find(
          (candidate) =>
            normalizedWebsite &&
            normalizeUrl(
              candidate.website
            ) ===
              normalizedWebsite
        ) ||
        prospects[0] ||
        null;
    }

    if (!prospect) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No saved Scout referral prospect matched this Reach request.",
        },
        {
          status: 404,
        }
      );
    }

    const contacts =
      await supabaseSelect<Contact>(
        "pi_referral_contacts",
        {
          select:
            "id,prospect_id,full_name,first_name,last_name,email,priority,selected_for_outreach",
          prospect_id:
            eq(
              prospect.id
            ),
          order:
            "priority.asc",
          limit:
            25,
        }
      );

    let contact:
      | Contact
      | null =
      null;

    if (
      requestedContactId
    ) {
      contact =
        contacts.find(
          (candidate) =>
            candidate.id ===
            requestedContactId
        ) ||
        null;
    }

    if (!contact) {
      const selected =
        contacts
          .filter(
            (candidate) =>
              candidate
                .selected_for_outreach
          )
          .sort(
            (a, b) =>
              Number(
                a.priority ||
                99
              ) -
              Number(
                b.priority ||
                99
              )
          );

      const candidates =
        selected.length
          ? selected
          : contacts;

      contact =
        candidates.find(
          (candidate) =>
            clean(
              candidate.email
            )
        ) ||
        candidates[0] ||
        null;
    }

    if (!contact) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This Scout prospect does not have an enriched contact yet.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !clean(
        contact.email
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The selected referral contact does not have an enriched email address yet.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedStages =
      new Set([
        "approved",
        "contacted",
        "replied",
        "meeting",
        "partner",
      ]);

    if (
      !allowedStages.has(
        clean(
          prospect.relationship_status
        ).toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Move ${prospect.organization_name} to Approved before Reach drafts external outreach.`,
        },
        {
          status: 400,
        }
      );
    }

    const startedAt =
      new Date()
        .toISOString();

    const callbackUrl =
      new URL(
        "/api/pi/reach/callback",
        request.nextUrl.origin
      ).toString();

    const payload = {
      action:
        "run_pi_agent",

      floor:
        "personal_injury",

      workflowVersion:
        "pi_growth_v3",

      agentId:
        "reach",

      request: {
        mode:
          "draft_referral_outreach",

        prospectId:
          prospect.id,

        contactId:
          contact.id,

        humanApprovalRequired:
          true,

        sendEmail:
          false,
      },

      callbackUrl,

      requestedAt:
        startedAt,

      source: {
        application:
          "cano_ai_floor",
        floor:
          "02",
        route:
          "/api/pi/reach/run",
      },
    };

    const response =
      await fetch(
        PI_N8N_WEBHOOK,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...(process.env
              .N8N_SHARED_SECRET
              ? {
                  "x-cano-secret":
                    process.env
                      .N8N_SHARED_SECRET,
                }
              : {}),
          },

          body:
            JSON.stringify(
              payload
            ),

          cache:
            "no-store",
        }
      );

    const text =
      await response.text();

    if (!response.ok) {
      throw new Error(
        `Reach n8n workflow could not accept the draft request (${response.status}): ${
          text ||
          response.statusText
        }`
      );
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: true,

        prospectId:
          prospect.id,

        contactId:
          contact.id,

        organizationName:
          prospect
            .organization_name,

        recipientName:
          clean(
            contact.full_name
          ) ||
          [
            clean(
              contact.first_name
            ),
            clean(
              contact.last_name
            ),
          ]
            .filter(Boolean)
            .join(" "),

        recipientEmail:
          contact.email,

        startedAt,

        message:
          "Reach accepted the referral prospect and is drafting the outreach email.",
      },
      {
        status: 202,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Reach.",
      },
      {
        status: 500,
      }
    );
  }
}

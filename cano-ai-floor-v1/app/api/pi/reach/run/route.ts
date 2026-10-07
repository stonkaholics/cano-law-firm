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

function escEq(
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

    const organizationName =
      clean(
        body
          ?.organizationName
      );

    const website =
      clean(
        body?.website
      );

    if (!organizationName) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "organizationName is required.",
        },
        {
          status: 400,
        }
      );
    }

    const prospects =
      await supabaseSelect<Prospect>(
        "pi_referral_prospects",
        {
          select:
            "id,organization_name,website,relationship_status",
          organization_name:
            escEq(
              organizationName
            ),
          limit: 20,
        }
      );

    if (!prospects.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `No saved Scout prospect was found for ${organizationName}.`,
        },
        {
          status: 404,
        }
      );
    }

    const normalizedWebsite =
      normalizeUrl(
        website
      );

    const prospect =
      prospects.find(
        (candidate) =>
          normalizedWebsite &&
          normalizeUrl(
            candidate.website
          ) ===
            normalizedWebsite
      ) ||
      prospects[0];

    const contacts =
      await supabaseSelect<Contact>(
        "pi_referral_contacts",
        {
          select:
            "id,prospect_id,full_name,first_name,last_name,email,priority,selected_for_outreach",
          prospect_id:
            escEq(
              prospect.id
            ),
          order:
            "priority.asc",
          limit: 20,
        }
      );

    const selected =
      contacts
        .filter(
          (contact) =>
            contact
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

    const contact =
      candidates.find(
        (candidate) =>
          clean(
            candidate.email
          )
      ) ||
      candidates[0] ||
      null;

    if (!contact) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This firm does not have an enriched referral contact yet.",
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

    if (
      !response.ok
    ) {
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
          "Reach accepted the prospect and is drafting referral outreach.",
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

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

const VERIFIED_GUARD_CONTEXT = {
  sender: {
    name:
      "Erik Quisenberry",
    title:
      "Chief Operating Officer",
    titleShort:
      "COO",
    email:
      process.env.CANO_REFERRAL_FROM_EMAIL ||
      "intake@canolawfirm.com",
    phone:
      "(786) 673-0958",
    address:
      "9100 Coral Way, Suite 1, Miami, FL 33165",
    website:
      "https://www.canolawfirm.com/",
    calendlyUrl:
      process.env.CANO_REFERRAL_CALENDLY_URL ||
      "https://calendly.com/eqtrades/discovery-call",
  },

  firm: {
    name:
      "CANO LAW FIRM, P.A.",
    verifiedPracticeAreas: [
      "Personal Injury",
      "Property Damage",
      "Immigration",
    ],
  },

  reviewRules: [
    "Erik Quisenberry is the verified human sender for this referral-development workflow.",
    "Chief Operating Officer / COO is the verified sender title.",
    "Personal Injury, Property Damage, and Immigration are verified Cano Law Firm practice-area statements for this workflow.",
    "The approved Calendly URL is an allowed scheduling CTA.",
    "Do not flag the verified sender identity, verified firm practice areas, or approved Calendly CTA as unsupported.",
    "Do flag any additional Cano capability claim that is not supported by supplied verified context.",
    "Do flag invented recipient facts, invented referral history, fee-split language, economics/case-value threshold language, promises of referrals, or claims that Cano is Florida referral counsel unless separately verified.",
    "Do flag any external-facing reference to Reach, Scout, Guard, AI, agents, automation, scoring, or internal systems.",
    "A stylistic preference alone is not a material compliance issue. Recommend needs_review only for a concrete material issue that should be fixed before external sending.",
  ],
};

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
    const body = await request.json();

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
      rows[0] || null;

    if (!draft) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Reach outreach draft was not found.",
        },
        { status: 404 }
      );
    }

    if (
      clean(
        draft.metadata?.agent
      ).toLowerCase() !==
      "reach"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Guard can only review Reach referral outreach in this workflow.",
        },
        { status: 400 }
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
            `This outreach is already ${draft.status}.`,
        },
        { status: 400 }
      );
    }

    const startedAt =
      new Date().toISOString();

    const callbackUrl =
      new URL(
        "/api/pi/guard/callback",
        request.nextUrl.origin
      ).toString();

    const payload = {
      action:
        "run_pi_agent",

      floor:
        "personal_injury",

      workflowVersion:
        "pi_growth_v6",

      agentId:
        "guard",

      request: {
        mode:
          "review_referral_outreach",

        outreachEventId,

        verifiedContext:
          VERIFIED_GUARD_CONTEXT,

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
          "/api/pi/guard/run",
      },
    };

    const response =
      await fetch(
        PI_N8N_WEBHOOK,
        {
          method: "POST",

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
        `Guard n8n workflow could not accept the review (${response.status}): ${
          text || response.statusText
        }`
      );
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        outreachEventId,
        startedAt,
        message:
          "Guard accepted the Reach draft for review.",
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Guard.",
      },
      { status: 500 }
    );
  }
}

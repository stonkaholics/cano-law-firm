import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

const CANO_REFERRAL_SENDER = {
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
  phoneHref:
    "+17866730958",
  address:
    "9100 Coral Way, Suite 1, Miami, FL 33165",
  website:
    "https://www.canolawfirm.com/",
  logoUrl:
    "https://canolawfirm.com/wp-content/uploads/2026/01/CANO-2-e1769891371191.png",
  calendlyUrl:
    process.env.CANO_REFERRAL_CALENDLY_URL ||
    "https://calendly.com/eqtrades/discovery-call",
};

const VERIFIED_CANO_PROFILE = {
  firmName:
    "CANO LAW FIRM, P.A.",
  practiceAreas: [
    "Personal Injury",
    "Property Damage",
    "Immigration",
  ],
  sender:
    CANO_REFERRAL_SENDER,
};

const REACH_DRAFTING_POLICY = {
  senderPerspective:
    "Write as Erik Quisenberry, Chief Operating Officer of Cano Law Firm.",
  humanTone:
    true,
  noInternalAgentIdentity:
    true,
  noAiLanguage:
    true,
  noDashSeparators:
    true,
  noEmDash:
    true,
  maxBodyWordsBeforeSignature:
    170,
  approvedCallToAction:
    "Invite the recipient to a brief 15-minute introductory call using senderProfile.calendlyUrl.",
  prohibitedClaims: [
    "Do not say Cano commonly serves as Florida referral counsel unless separately verified.",
    "Do not state economics, case-value thresholds, profitability, capacity, or internal acceptance criteria.",
    "Do not discuss referral fees, fee splits, percentages, or compensation.",
    "Do not promise referrals, outcomes, co-counsel work, or reciprocity.",
    "Do not identify Reach, Scout, Guard, AI, automation, scoring, or internal systems.",
  ],
};

type Draft = {
  id: string;
  referral_prospect_id: string | null;
  status: string;
  subject: string;
  message_summary: string;
  metadata: Record<string, any>;
};

type Review = {
  id: string;
  subject_id: string;
  status: string;
  notes: string;
  reviewed_at: string | null;
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

    const drafts =
      await supabaseSelect<Draft>(
        "pi_outreach_events",
        {
          select:
            "id,referral_prospect_id,status,subject,message_summary,metadata",
          id:
            `eq.${outreachEventId}`,
          limit:
            1,
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
        draft.metadata?.agent
      ).toLowerCase() !==
      "reach"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only Reach referral drafts can be regenerated through this Guard workflow.",
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
            `This draft is already ${draft.status}; only pending drafts can be revised.`,
        },
        { status: 409 }
      );
    }

    const reviews =
      await supabaseSelect<Review>(
        "pi_compliance_reviews",
        {
          select: "*",
          subject_type:
            "eq.outreach_event",
          subject_id:
            `eq.${outreachEventId}`,
          reviewed_by:
            "eq.Guard AI",
          order:
            "reviewed_at.desc",
          limit: 1,
        }
      );

    const review =
      reviews[0] || null;

    if (!review) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Run Guard Review before asking Reach to regenerate the draft.",
        },
        { status: 400 }
      );
    }

    const prospectId =
      clean(
        draft.referral_prospect_id
      );

    const contactId =
      clean(
        draft.metadata?.contact_id
      );

    if (!prospectId || !contactId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The original Reach draft is missing its prospect/contact linkage.",
        },
        { status: 400 }
      );
    }

    const startedAt =
      new Date().toISOString();

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
        "pi_growth_v6",

      agentId:
        "reach",

      request: {
        mode:
          "regenerate_referral_outreach",

        prospectId,

        contactId,

        sourceOutreachEventId:
          draft.id,

        originalDraft: {
          subject:
            clean(
              draft.subject ||
              draft.metadata?.subject
            ),

          body:
            clean(
              draft.metadata?.body ||
              draft.message_summary
            ),
        },

        guardReview: {
          recommendation:
            clean(
              review.metadata
                ?.recommendation ||
              ""
            ),

          confidence:
            Number(
              review.metadata
                ?.confidence ||
              0
            ),

          summary:
            clean(
              review.metadata
                ?.summary ||
              review.notes ||
              ""
            ),

          flags:
            Array.isArray(
              review.metadata
                ?.flags
            )
              ? review.metadata.flags
              : [],

          requiredEdits:
            Array.isArray(
              review.metadata
                ?.required_edits
            )
              ? review.metadata
                  .required_edits
              : [],
        },

        senderProfile:
          CANO_REFERRAL_SENDER,

        verifiedFirmProfile:
          VERIFIED_CANO_PROFILE,

        draftingPolicy:
          REACH_DRAFTING_POLICY,

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
          "/api/pi/guard/regenerate",
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
        `Reach n8n workflow could not accept the Guard revision request (${response.status}): ${
          text ||
          response.statusText
        }`
      );
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        sourceOutreachEventId:
          outreachEventId,
        prospectId,
        contactId,
        startedAt,
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
            : "Unable to regenerate Reach outreach.",
      },
      { status: 500 }
    );
  }
}

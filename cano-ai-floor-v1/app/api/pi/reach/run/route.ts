import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

/*
|--------------------------------------------------------------------------
| CANO REFERRAL OUTREACH PROFILE
|--------------------------------------------------------------------------
|
| This is the verified human sender identity used by Reach.
|
| Reach is an internal drafting agent only. External email copy must always
| be written from Erik's perspective and must never identify Reach, Scout,
| Guard, AI, an agent, or an automated system as the sender.
|--------------------------------------------------------------------------
*/

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

  /*
  | Do not let Reach infer additional firm capabilities from a prospect's
  | referral-fit analysis. These are the only standing Cano capabilities
  | this outreach workflow may state without additional verified context.
  */
  capabilityRule:
    "Only state Cano Law Firm capabilities listed in verifiedFirmProfile.practiceAreas unless the request includes additional verified firm facts.",
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

  preferredBodyWordsBeforeSignature:
    "95-150",

  approvedCallToAction:
    "Invite the recipient to a brief 15-minute introductory call. Use the approved Calendly URL supplied in senderProfile.calendlyUrl.",

  prohibitedClaims: [
    "Do not say Cano commonly serves as Florida referral counsel unless that exact capability is separately verified in the request.",
    "Do not state that Cano accepts cases another firm rejects because of economics, case value, thresholds, capacity, or profitability.",
    "Do not discuss referral fees, fee splits, percentages, settlement economics, or compensation in a first-touch email.",
    "Do not promise referrals, case volume, outcomes, co-counsel work, or a reciprocal arrangement.",
    "Do not invent the recipient firm's practice areas, locations, results, awards, capabilities, or preferences.",
    "Do not describe Scout, Reach, Guard, AI, automation, research systems, databases, scoring, or internal workflow.",
  ],

  styleRules: [
    "Use the recipient's first name when known.",
    "Use short natural paragraphs.",
    "Use first-person singular from Erik's perspective.",
    "Mention one or two verified prospect-specific facts at most.",
    "Use plain professional language. Avoid marketing jargon, hype, synergy, mutually beneficial, strategic partnership, and similar canned phrases.",
    "Do not use em dashes or en dashes. Prefer periods, commas, or parentheses.",
    "Do not use horizontal-rule-style dash lines or decorative separators.",
    "Do not use bullet points in the actual first-touch email body.",
    "Do not use phrases such as I hope this email finds you well.",
    "Keep the subject concise and human. Do not use a formula like reciprocal referral opportunity between Firm A and Firm B.",
    "The email should feel like Erik personally reviewed the firm and wrote a short introduction.",
  ],

  evidenceRule:
    "Recipient-specific statements must be supported by the saved Scout prospect, verified_location, practice_evidence, practice_source_urls, or other supplied verified professional context.",

  approvalRule:
    "Human approval remains required before external sending.",
};

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
        "pi_growth_v6",

      agentId:
        "reach",

      request: {
        mode:
          "draft_referral_outreach",

        prospectId:
          prospect.id,

        contactId:
          contact.id,

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

        senderProfile:
          CANO_REFERRAL_SENDER,

        startedAt,

        message:
          "Reach accepted the referral prospect and is drafting the outreach email from Erik Quisenberry's perspective.",
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

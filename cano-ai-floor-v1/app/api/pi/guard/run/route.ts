import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

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
        "pi_growth_v4",
      agentId:
        "guard",
      request: {
        mode:
          "review_referral_outreach",
        outreachEventId,
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

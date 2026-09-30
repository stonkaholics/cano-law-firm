import { NextRequest, NextResponse } from "next/server";

/*
|--------------------------------------------------------------------------
| CANO LAW FIRM — PERSONAL INJURY AGENT ROUTER
|--------------------------------------------------------------------------
|
| This is the single backend brain-entry point for Floor 02.
|
| Every PI manager/specialist button can use the SAME n8n workflow:
|
| https://epiq.app.n8n.cloud/webhook/cano-pi-agent
|
| n8n branches on agentId:
|
| scout   → referral discovery
| pulse   → inbound lead sync / qualification
| beacon  → market + campaign intelligence
| guard   → compliance review
|
| Future agents can be added to SUPPORTED_AGENTS and handled by the same
| n8n Switch node without changing the frontend architecture.
|
*/

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

const SUPPORTED_AGENTS = new Set([
  "scout",
  "pulse",
  "beacon",
  "guard",

  // Reserved for the next PI build.
  "catalyst",
  "bridge",
  "reach",
  "orbit",
  "radar",
  "launch",
  "intake",
  "ledger",
]);

function cleanObject(value: any) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const agentId = String(body?.agentId || "")
      .trim()
      .toLowerCase();

    const requestPayload = cleanObject(body?.request);

    if (!agentId) {
      return NextResponse.json(
        {
          ok: false,
          error: "agentId is required.",
        },
        { status: 400 }
      );
    }

    if (!SUPPORTED_AGENTS.has(agentId)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported PI agent: ${agentId}`,
        },
        { status: 400 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | CALLBACK
    |--------------------------------------------------------------------------
    |
    | n8n writes results back to Cano through this route.
    |
    | Scout:
    |   bulk_upsert_referrals
    |
    | Pulse:
    |   create_lead / future bulk lead actions
    |
    | Beacon:
    |   upsert_campaigns
    |
    | Guard:
    |   create_compliance_review
    |
    */

    const callbackUrl = new URL(
      "/api/pi/workspace",
      request.nextUrl.origin
    ).toString();

    const payload = {
      action: "run_pi_agent",

      floor: "personal_injury",

      workflowVersion: "pi_growth_v1",

      agentId,

      request: requestPayload,

      callbackUrl,

      requestedAt: new Date().toISOString(),

      source: {
        application: "cano_ai_floor",
        floor: "02",
        route: "/api/pi/agents/run",
      },
    };

    const response = await fetch(PI_N8N_WEBHOOK, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        /*
        | If N8N_SHARED_SECRET already exists in Vercel, it will still be sent.
        | If it does not exist, the webhook still works without this header.
        */
        ...(process.env.N8N_SHARED_SECRET
          ? {
              "x-cano-secret":
                process.env.N8N_SHARED_SECRET,
            }
          : {}),
      },

      body: JSON.stringify(payload),

      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `PI n8n workflow could not accept ${agentId} (${response.status}): ${
          text || response.statusText
        }`
      );
    }

    let ack: any = null;

    try {
      ack = text ? JSON.parse(text) : null;
    } catch {
      ack = text || null;
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: true,

        agentId,

        webhook:
          "cano-pi-agent",

        callbackUrl,

        ack,

        message:
          `${agentId} accepted the job. The PI n8n brain is now processing it.`,
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
            : "Unable to start PI agent.",
      },
      {
        status: 500,
      }
    );
  }
}

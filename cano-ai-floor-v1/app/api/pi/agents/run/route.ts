import { NextRequest, NextResponse } from "next/server";

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

const SUPPORTED_AGENTS =
  new Set([
    "scout",
    "pulse",
    "beacon",
    "guard",
    "catalyst",
    "bridge",
    "reach",
    "orbit",
    "radar",
    "launch",
    "intake",
    "ledger",
  ]);

function cleanObject(
  value: any
) {
  return value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
    ? value
    : {};
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const agentId =
      String(
        body?.agentId || ""
      )
        .trim()
        .toLowerCase();

    const requestPayload =
      cleanObject(
        body?.request
      );

    if (!agentId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "agentId is required.",
        },
        { status: 400 }
      );
    }

    if (
      !SUPPORTED_AGENTS.has(
        agentId
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Unsupported PI agent: ${agentId}`,
        },
        { status: 400 }
      );
    }

    const callbackUrl =
      new URL(
        "/api/pi/workspace",
        request.nextUrl.origin
      ).toString();

    /*
    |--------------------------------------------------------------------------
    | APOLLO TEST MODE
    |--------------------------------------------------------------------------
    |
    | Scout gets an intentionally small budget.
    |
    | The actual hard enforcement happens through:
    | POST callbackUrl
    | action = reserve_apollo_call
    |
    | n8n must reserve a call immediately BEFORE every Apollo HTTP node.
    | Supabase atomically refuses reservations after 10 calls in the prior hour.
    |
    */

    const normalizedRequest =
      agentId === "scout"
        ? {
            ...requestPayload,

            maxResults:
              Math.max(
                1,
                Math.min(
                  10,
                  Number(
                    requestPayload
                      ?.maxResults ||
                    10
                  )
                )
              ),

            apollo: {
              mode: "test",

              maxCallsPerHour:
                10,

              maxSearchCallsThisRun:
                Math.max(
                  1,
                  Math.min(
                    2,
                    Number(
                      requestPayload
                        ?.apollo
                        ?.maxSearchCallsThisRun ||
                      2
                    )
                  )
                ),

              maxEnrichmentCallsThisRun:
                Math.max(
                  0,
                  Math.min(
                    1,
                    Number(
                      requestPayload
                        ?.apollo
                        ?.maxEnrichmentCallsThisRun ??
                      1
                    )
                  )
                ),

              peoplePerSearch:
                Math.max(
                  1,
                  Math.min(
                    10,
                    Number(
                      requestPayload
                        ?.apollo
                        ?.peoplePerSearch ||
                      10
                    )
                  )
                ),

              maxContactsPerFirm:
                Math.max(
                  1,
                  Math.min(
                    3,
                    Number(
                      requestPayload
                        ?.apollo
                        ?.maxContactsPerFirm ||
                      3
                    )
                  )
                ),
            },
          }
        : requestPayload;

    const payload = {
      action:
        "run_pi_agent",

      floor:
        "personal_injury",

      workflowVersion:
        "pi_growth_v2",

      agentId,

      request:
        normalizedRequest,

      callbackUrl,

      requestedAt:
        new Date()
          .toISOString(),

      source: {
        application:
          "cano_ai_floor",
        floor: "02",
        route:
          "/api/pi/agents/run",
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
        `PI n8n workflow could not accept ${agentId} (${response.status}): ${
          text ||
          response.statusText
        }`
      );
    }

    let ack: any =
      null;

    try {
      ack =
        text
          ? JSON.parse(text)
          : null;
    } catch {
      ack =
        text || null;
    }

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        agentId,
        webhook:
          "cano-pi-agent",
        callbackUrl,
        request:
          normalizedRequest,
        ack,

        message:
          agentId === "scout"
            ? "Scout accepted the job in Apollo test mode. The workflow is capped at 10 reserved Apollo calls per rolling hour."
            : `${agentId} accepted the job. The PI n8n brain is now processing it.`,
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
            : "Unable to start PI agent.",
      },
      { status: 500 }
    );
  }
}

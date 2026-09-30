import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_AGENTS = new Set([
  "scout",
  "pulse",
  "beacon",
  "guard",
]);

function webhookUrl() {
  const url = process.env.N8N_PI_AGENT_WEBHOOK;

  if (!url) {
    throw new Error(
      "Missing N8N_PI_AGENT_WEBHOOK in Vercel. Add one generic PI agent webhook and branch inside n8n by agentId."
    );
  }

  return url;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const agentId = String(body?.agentId || "").trim();
    const requestPayload =
      body?.request && typeof body.request === "object"
        ? body.request
        : {};

    if (!SUPPORTED_AGENTS.has(agentId)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported PI agent: ${agentId}`,
        },
        { status: 400 }
      );
    }

    const callbackUrl = new URL(
      "/api/pi/workspace",
      request.nextUrl.origin
    ).toString();

    const response = await fetch(webhookUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_SHARED_SECRET
          ? {
              "x-cano-secret": process.env.N8N_SHARED_SECRET,
            }
          : {}),
      },
      body: JSON.stringify({
        action: "run_pi_agent",
        agentId,
        request: requestPayload,
        callbackUrl,
        requestedAt: new Date().toISOString(),
      }),
      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `n8n could not accept ${agentId} (${response.status}): ${
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
        ack,
        message:
          `${agentId} accepted the job. n8n can write results back through the PI workspace callback.`,
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

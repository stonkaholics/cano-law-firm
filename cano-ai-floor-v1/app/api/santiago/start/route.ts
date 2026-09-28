import { NextRequest, NextResponse } from "next/server";

const DEFAULT_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-ai-santiago-assign-matter";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body?.matterId && !body?.mondayItemId) {
    return NextResponse.json(
      { ok: false, error: "A Monday matter ID is required." },
      { status: 400 }
    );
  }

  const webhook =
    process.env.N8N_SANTIAGO_START_WEBHOOK || DEFAULT_WEBHOOK;

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_SHARED_SECRET
          ? { "x-cano-secret": process.env.N8N_SHARED_SECRET }
          : {}),
      },
      body: JSON.stringify({
        action: "start_case_brain",
        matterId: body.matterId,
        mondayItemId: body.mondayItemId,
        preview: body.preview ?? null,
      }),
      cache: "no-store",
    });

    const raw = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `n8n returned ${response.status}`,
          warning: raw || "The assign-matter workflow returned an error.",
        },
        { status: 502 }
      );
    }

    let data: any = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { ok: true, message: raw };
      }
    }

    // Pass the Case Brain object through untouched.
    return NextResponse.json({
      ok: data?.ok !== false,
      matterId:
        data?.matterId ||
        data?.aiMatterId ||
        data?.data?.matterId ||
        String(body.mondayItemId || body.matterId),
      mondayItemId:
        data?.mondayItemId ||
        data?.data?.mondayItemId ||
        String(body.mondayItemId || body.matterId),
      caseBrainStatus:
        data?.caseBrainStatus ||
        data?.status ||
        data?.data?.caseBrainStatus ||
        "received",
      monday:
        data?.monday ||
        data?.data?.monday || {
          found: true,
          fieldsImported:
            data?.fieldsImported ??
            data?.data?.fieldsImported ??
            undefined,
        },
      caseBrain:
        data?.caseBrain ||
        data?.data?.caseBrain ||
        null,
      warning: data?.warning || null,
      message:
        data?.message ||
        "Monday matter analyzed by Case Brain.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach the assign-matter workflow.",
      },
      { status: 502 }
    );
  }
}

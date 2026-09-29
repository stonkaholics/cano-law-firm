import { NextRequest, NextResponse } from "next/server";

const DEFAULT_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-ai-santiago-matters";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const webhook =
    process.env.N8N_SANTIAGO_MATTERS_WEBHOOK || DEFAULT_WEBHOOK;

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
        action: "search_matters",
        query: q,
      }),
      cache: "no-store",
    });

    const raw = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { matters: [], error: `n8n returned ${response.status}: ${raw || "Unknown error"}` },
        { status: 502 }
      );
    }

    let data: any;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json(
        { matters: [], error: "The n8n Monday workflow response was not valid JSON." },
        { status: 502 }
      );
    }

    const matters = Array.isArray(data)
      ? data
      : Array.isArray(data?.matters)
      ? data.matters
      : Array.isArray(data?.data?.matters)
      ? data.data.matters
      : [];

    return NextResponse.json({
      ok: true,
      source: "n8n",
      count: matters.length,
      matters,
    });
  } catch (error) {
    return NextResponse.json(
      {
        matters: [],
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach the Monday client-list workflow.",
      },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body?.matterId && !body?.mondayItemId) {
    return NextResponse.json({ ok: false, warning: "A matter ID is required." }, { status: 400 });
  }

  const webhook = process.env.N8N_SANTIAGO_START_WEBHOOK;

  if (!webhook) {
    return NextResponse.json({
      ok: true,
      matterId: `AI-DEMO-${body.mondayItemId || body.matterId}`,
      caseBrainStatus: "documents_pending",
      monday: { found: true, fieldsImported: 18 },
      dropbox: { found: false, fileCount: 0, folder: null },
      warning: "Demo mode: no Dropbox folder was connected, so this matter is marked Documents Pending.",
      message: "Demo matter created and queued for Case Brain"
    });
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.N8N_SHARED_SECRET ? { "x-cano-secret": process.env.N8N_SHARED_SECRET } : {})
    },
    body: JSON.stringify({
      action: "start_case_brain",
      matterId: body.matterId,
      mondayItemId: body.mondayItemId
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ ok: false, warning: text || "The n8n intake workflow returned an error." }, { status: 502 });
  }

  return NextResponse.json(await response.json());
}

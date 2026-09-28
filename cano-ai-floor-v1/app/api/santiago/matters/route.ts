import { NextRequest, NextResponse } from "next/server";

const demoMatters = [
  {
    id: "demo-001",
    mondayItemId: "10001",
    name: "Jose Garcia",
    practiceArea: "Immigration",
    matterType: "Habeas",
    attorney: "Mariela",
    status: "Active",
    pncName: "Maria Garcia",
    detaineeName: "Jose Garcia",
    aNumber: "A000000001",
    detentionFacility: "Krome",
    notesPreview: "Client consultation completed. Awaiting final supporting documents before research.",
    dropboxFolder: null
  },
  {
    id: "demo-002",
    mondayItemId: "10002",
    name: "Carlos Rivera",
    practiceArea: "Immigration",
    matterType: "Bond",
    attorney: "Mariela",
    status: "Active",
    pncName: "Ana Rivera",
    detaineeName: "Carlos Rivera",
    aNumber: "A000000002",
    detentionFacility: "Baker",
    notesPreview: "Bond consultation notes available. Family and sponsor information collected.",
    dropboxFolder: null
  }
];

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const webhook = process.env.N8N_SANTIAGO_MATTERS_WEBHOOK;

  if (!webhook) {
    const matters = demoMatters.filter((m) =>
      JSON.stringify(m).toLowerCase().includes(q.toLowerCase())
    );
    return NextResponse.json({ source: "demo", matters });
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.N8N_SHARED_SECRET ? { "x-cano-secret": process.env.N8N_SHARED_SECRET } : {})
    },
    body: JSON.stringify({ action: "search_matters", query: q }),
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json({ matters: [], error: "Unable to load Monday matters." }, { status: 502 });
  }

  const data = await response.json();
  return NextResponse.json({ source: "n8n", matters: Array.isArray(data) ? data : data.matters ?? [] });
}

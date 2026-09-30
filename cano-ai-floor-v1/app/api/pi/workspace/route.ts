import { NextRequest, NextResponse } from "next/server";

type TableName =
  | "pi_referral_prospects"
  | "pi_leads"
  | "pi_campaigns";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in Vercel."
    );
  }

  return { url, key };
}

async function supabaseRequest(
  path: string,
  init: RequestInit = {}
) {
  const { url, key } = config();

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase PI request failed (${response.status}): ${
        text || response.statusText
      }`
    );
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readTable(table: TableName, order: string) {
  return (
    (await supabaseRequest(
      `${table}?select=*&order=${encodeURIComponent(order)}`
    )) || []
  );
}

export async function GET() {
  try {
    const [referrals, leads, campaigns] = await Promise.all([
      readTable("pi_referral_prospects", "score.desc,created_at.desc"),
      readTable("pi_leads", "created_at.desc"),
      readTable("pi_campaigns", "created_at.desc"),
    ]);

    return NextResponse.json({
      ok: true,
      referrals,
      leads,
      campaigns,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load PI workspace.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "update_referral_status") {
      const id = String(body?.id || "");
      const status = String(body?.status || "");

      if (!id || !status) {
        return NextResponse.json(
          { ok: false, error: "id and status are required." },
          { status: 400 }
        );
      }

      await supabaseRequest(
        `pi_referral_prospects?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            relationship_status: status,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      return NextResponse.json({ ok: true });
    }

    if (action === "update_lead_status") {
      const id = String(body?.id || "");
      const status = String(body?.status || "");

      if (!id || !status) {
        return NextResponse.json(
          { ok: false, error: "id and status are required." },
          { status: 400 }
        );
      }

      await supabaseRequest(
        `pi_leads?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      return NextResponse.json({ ok: true });
    }

    if (action === "create_referral") {
      const payload = body?.payload || {};

      const row = await supabaseRequest("pi_referral_prospects", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          organization_name: String(payload.organization_name || ""),
          contact_name: String(payload.contact_name || ""),
          category: String(payload.category || ""),
          city: String(payload.city || ""),
          state: String(payload.state || "FL"),
          website: String(payload.website || ""),
          email: String(payload.email || ""),
          phone: String(payload.phone || ""),
          why_fit: String(payload.why_fit || ""),
          source_url: String(payload.source_url || ""),
          relationship_status: String(
            payload.relationship_status || "new"
          ),
          score: Number(payload.score || 0),
          metadata:
            payload.metadata && typeof payload.metadata === "object"
              ? payload.metadata
              : {},
        }),
      });

      return NextResponse.json({ ok: true, row });
    }

    if (action === "create_lead") {
      const payload = body?.payload || {};

      const row = await supabaseRequest("pi_leads", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          name: String(payload.name || ""),
          source: String(payload.source || ""),
          accident_type: String(payload.accident_type || ""),
          city: String(payload.city || ""),
          state: String(payload.state || "FL"),
          phone: String(payload.phone || ""),
          email: String(payload.email || ""),
          summary: String(payload.summary || ""),
          urgency: String(payload.urgency || "medium"),
          status: String(payload.status || "new"),
          metadata:
            payload.metadata && typeof payload.metadata === "object"
              ? payload.metadata
              : {},
        }),
      });

      return NextResponse.json({ ok: true, row });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported PI workspace action: ${action}`,
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update PI workspace.",
      },
      { status: 500 }
    );
  }
}

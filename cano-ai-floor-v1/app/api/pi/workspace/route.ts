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

    if (action === "bulk_upsert_referrals") {
      const rows = Array.isArray(body?.rows) ? body.rows : [];

      if (!rows.length) {
        return NextResponse.json(
          { ok: false, error: "rows are required." },
          { status: 400 }
        );
      }

      const normalized = rows.map((payload: any) => ({
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
        updated_at: new Date().toISOString(),
      }));

      const result = await supabaseRequest(
        "pi_referral_prospects?on_conflict=organization_name,city,state",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(normalized),
        }
      );

      return NextResponse.json({ ok: true, rows: result });
    }

    if (action === "create_outreach_event") {
      const payload = body?.payload || {};

      const row = await supabaseRequest("pi_outreach_events", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          referral_prospect_id:
            payload.referral_prospect_id || null,
          channel: String(payload.channel || ""),
          direction: String(payload.direction || "outbound"),
          status: String(payload.status || "draft"),
          subject: String(payload.subject || ""),
          message_summary: String(payload.message_summary || ""),
          approved_by: String(payload.approved_by || ""),
          approved_at: payload.approved_at || null,
          occurred_at: payload.occurred_at || null,
          next_follow_up_at: payload.next_follow_up_at || null,
          metadata:
            payload.metadata && typeof payload.metadata === "object"
              ? payload.metadata
              : {},
        }),
      });

      return NextResponse.json({ ok: true, row });
    }

    if (action === "create_compliance_review") {
      const payload = body?.payload || {};

      const row = await supabaseRequest("pi_compliance_reviews", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          review_type: String(payload.review_type || ""),
          subject_type: String(payload.subject_type || ""),
          subject_id: String(payload.subject_id || ""),
          status: String(payload.status || "needs_review"),
          notes: String(payload.notes || ""),
          reviewed_by: String(payload.reviewed_by || ""),
          reviewed_at: payload.reviewed_at || null,
          metadata:
            payload.metadata && typeof payload.metadata === "object"
              ? payload.metadata
              : {},
        }),
      });

      return NextResponse.json({ ok: true, row });
    }

    if (action === "upsert_campaigns") {
      const rows = Array.isArray(body?.rows) ? body.rows : [];

      if (!rows.length) {
        return NextResponse.json(
          { ok: false, error: "rows are required." },
          { status: 400 }
        );
      }

      const normalized = rows.map((payload: any) => ({
        name: String(payload.name || ""),
        channel: String(payload.channel || ""),
        status: String(payload.status || "draft"),
        leads: Number(payload.leads || 0),
        consults: Number(payload.consults || 0),
        signed: Number(payload.signed || 0),
        spend: Number(payload.spend || 0),
        notes: String(payload.notes || ""),
        metadata:
          payload.metadata && typeof payload.metadata === "object"
            ? payload.metadata
            : {},
        updated_at: new Date().toISOString(),
      }));

      const result = await supabaseRequest(
        "pi_campaigns?on_conflict=name,channel",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(normalized),
        }
      );

      return NextResponse.json({ ok: true, rows: result });
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

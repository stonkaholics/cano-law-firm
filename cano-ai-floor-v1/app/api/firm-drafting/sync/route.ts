import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUCKET = "firm-drafting-examples";
const DEFAULT_INGEST_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/ingest-firm-drafting-example";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY");
  return { url, secret };
}

async function listStorageFiles(prefix: string) {
  const { url, secret } = getSupabaseConfig();

  const response = await fetch(
    `${url}/storage/v1/object/list/${BUCKET}`,
    {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefix,
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      }),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `Supabase storage list failed (${response.status}): ${raw || response.statusText}`
    );
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isFile(row: any) {
  return Boolean(row?.name) && !row?.metadata?.mimetype?.includes("folder");
}

async function sendToIngestWebhook(payload: Record<string, any>) {
  const webhook =
    process.env.N8N_FIRM_DRAFTING_INGEST_WEBHOOK ||
    DEFAULT_INGEST_WEBHOOK;

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.N8N_SHARED_SECRET
        ? { "x-cano-secret": process.env.N8N_SHARED_SECRET }
        : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `n8n ingest webhook failed (${response.status}): ${text || response.statusText}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const onlyPath = String(body?.storagePath || "").trim();

    const items: Array<Record<string, any>> = [];

    if (onlyPath) {
      const isOrder = onlyPath.includes("/orders/");
      items.push({
        storagePath: onlyPath,
        documentType: isOrder ? "order" : "petition",
        sourceRole: isOrder ? "outcome_reference" : "style_exemplar",
      });
    } else {
      const [petitions, orders] = await Promise.all([
        listStorageFiles("habeas/petitions"),
        listStorageFiles("habeas/orders"),
      ]);

      for (const row of petitions.filter(isFile)) {
        items.push({
          storagePath: `habeas/petitions/${row.name}`,
          documentType: "petition",
          sourceRole: "style_exemplar",
        });
      }

      for (const row of orders.filter(isFile)) {
        items.push({
          storagePath: `habeas/orders/${row.name}`,
          documentType: "order",
          sourceRole: "outcome_reference",
        });
      }
    }

    if (!items.length) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        message: "No files found in firm-drafting-examples/habeas.",
      });
    }

    const results = [];
    for (const item of items) {
      try {
        const ack = await sendToIngestWebhook({
          action: "ingest_firm_drafting_example",
          bucket: BUCKET,
          documentFamily: "habeas",
          practiceArea: "immigration",
          storagePath: item.storagePath,
          documentType: item.documentType,
          sourceRole: item.sourceRole,
        });

        results.push({
          ok: true,
          ...item,
          ack,
        });
      } catch (error) {
        results.push({
          ok: false,
          ...item,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: results.every((row) => row.ok),
      sent: results.length,
      succeeded: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to sync firm drafting examples.",
      },
      { status: 500 }
    );
  }
}

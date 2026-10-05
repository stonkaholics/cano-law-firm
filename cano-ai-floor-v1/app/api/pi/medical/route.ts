import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = process.env.MEDINTEL_STORAGE_BUCKET || "pi-medical-records";
const MAX_FILE_BYTES = 100 * 1024 * 1024;

function config() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const hipaaEnabled = process.env.MEDINTEL_HIPAA_ENABLED === "true";
  const n8nWebhook = process.env.MEDINTEL_N8N_WEBHOOK || "";
  const n8nSecret = process.env.MEDINTEL_N8N_SECRET || "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY.");
  }

  return {
    supabaseUrl,
    serviceKey,
    hipaaEnabled,
    n8nWebhook,
    n8nSecret,
  };
}

function safeMatterId(value: unknown) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{6,100}$/.test(id)) {
    throw new Error("matter_id must be an opaque internal identifier.");
  }
  return id;
}

function safeFilename(value: unknown) {
  const raw = String(value || "medical-records.pdf").trim();
  const basename = raw.split(/[\\/]/).pop() || "medical-records.pdf";
  return basename
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 140);
}

async function sb(path: string, init: RequestInit = {}) {
  const { supabaseUrl, serviceKey } = config();
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Protected data request failed (${response.status}).`);
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function requireHipaaGate() {
  const { hipaaEnabled } = config();
  if (!hipaaEnabled) {
    throw new Error(
      "MedIntel is locked. Complete BAAs/security configuration, then set MEDINTEL_HIPAA_ENABLED=true."
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { hipaaEnabled } = config();
    const matterIdRaw = request.nextUrl.searchParams.get("matter_id");
    const filter = matterIdRaw
      ? `&matter_id=eq.${encodeURIComponent(safeMatterId(matterIdRaw))}`
      : "";

    const [records, reviews] = await Promise.all([
      sb(`/rest/v1/pi_medical_records?select=id,matter_id,original_filename,storage_path,mime_type,size_bytes,status,page_count,created_at,updated_at${filter}&order=created_at.desc`),
      sb(`/rest/v1/pi_medical_reviews?select=*&order=created_at.desc${filter}`),
    ]);

    return NextResponse.json({
      ok: true,
      hipaa_ready: hipaaEnabled,
      records: records || [],
      reviews: reviews || [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load MedIntel." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || "");
    requireHipaaGate();

    if (action === "create_upload") {
      const matterId = safeMatterId(body?.matter_id);
      const filename = safeFilename(body?.filename);
      const mimeType = String(body?.mime_type || "");

      if (mimeType !== "application/pdf") {
        return NextResponse.json({ ok: false, error: "Only PDF medical records are enabled." }, { status: 400 });
      }

      const sizeBytes = Number(body?.size_bytes || 0);
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_BYTES) {
        return NextResponse.json({ ok: false, error: "PDF must be between 1 byte and 100 MB." }, { status: 400 });
      }

      const recordId = crypto.randomUUID();
      const storagePath = `${matterId}/${recordId}/${filename}`;

      const signed = await sb(
        `/storage/v1/object/upload/sign/${encodeURIComponent(BUCKET)}/${storagePath.split("/").map(encodeURIComponent).join("/")}`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const signedPath = signed?.url || signed?.signedURL || signed?.signedUrl;
      if (!signedPath) throw new Error("Protected storage did not return a signed upload URL.");

      await sb("/rest/v1/pi_medical_records", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          id: recordId,
          matter_id: matterId,
          original_filename: filename,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          status: "upload_pending",
          metadata: {
            source: "medintel_secure_intake",
            raw_phi_in_app_api: false,
          },
        }),
      });

      const { supabaseUrl } = config();
      const signedUploadUrl = signedPath.startsWith("http")
        ? signedPath
        : `${supabaseUrl}/storage/v1${signedPath.startsWith("/") ? "" : "/"}${signedPath}`;

      return NextResponse.json({
        ok: true,
        record_id: recordId,
        storage_path: storagePath,
        signed_upload_url: signedUploadUrl,
      });
    }

    if (action === "finalize_upload") {
      const recordId = String(body?.record_id || "").trim();
      const matterId = safeMatterId(body?.matter_id);
      if (!recordId) throw new Error("record_id is required.");

      const rows = await sb(
        `/rest/v1/pi_medical_records?id=eq.${encodeURIComponent(recordId)}&matter_id=eq.${encodeURIComponent(matterId)}&select=id,storage_path`
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) throw new Error("Medical record row was not found.");

      await sb(`/rest/v1/pi_medical_records?id=eq.${encodeURIComponent(recordId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "uploaded",
          uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });

      return NextResponse.json({ ok: true, record_id: recordId });
    }

    if (action === "start_review") {
      const matterId = safeMatterId(body?.matter_id);

      const records = await sb(
        `/rest/v1/pi_medical_records?matter_id=eq.${encodeURIComponent(matterId)}&status=in.(uploaded,ready)&select=id,storage_bucket,storage_path,original_filename,mime_type,size_bytes&order=created_at.asc`
      );

      if (!Array.isArray(records) || !records.length) {
        return NextResponse.json(
          { ok: false, error: "No uploaded medical records are available for this matter." },
          { status: 400 }
        );
      }

      const reviewId = crypto.randomUUID();

      await sb("/rest/v1/pi_medical_reviews", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          id: reviewId,
          matter_id: matterId,
          status: "queued",
          record_count: records.length,
          source_record_ids: records.map((row: any) => row.id),
          result: {},
        }),
      });

      const { n8nWebhook, n8nSecret } = config();
      if (!n8nWebhook) {
        throw new Error("MEDINTEL_N8N_WEBHOOK is not configured.");
      }

      const webhookResponse = await fetch(n8nWebhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(n8nSecret ? { "x-cano-secret": n8nSecret } : {}),
        },
        body: JSON.stringify({
          agentId: "medintel",
          request: {
            mode: "review_medical_records",
            reviewId,
            matterId,
            records: records.map((row: any) => ({
              recordId: row.id,
              storageBucket: row.storage_bucket,
              storagePath: row.storage_path,
              filename: row.original_filename,
              mimeType: row.mime_type,
              sizeBytes: row.size_bytes,
            })),
            requestedFrom: "medintel_workstation",
          },
        }),
      });

      if (!webhookResponse.ok) {
        await sb(`/rest/v1/pi_medical_reviews?id=eq.${encodeURIComponent(reviewId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            status: "error",
            error_message: "Protected processing workflow did not accept the job.",
            updated_at: new Date().toISOString(),
          }),
        });
        throw new Error("MedIntel processing workflow did not accept the job.");
      }

      return NextResponse.json({
        ok: true,
        review_id: reviewId,
        message: "MedIntel medical-record review queued.",
      });
    }

    if (action === "save_review_result") {
      const reviewId = String(body?.review_id || "").trim();
      const matterId = safeMatterId(body?.matter_id);
      if (!reviewId) throw new Error("review_id is required.");

      const result = body?.result && typeof body.result === "object" ? body.result : {};
      const inventory = result?.record_inventory || {};

      await sb(
        `/rest/v1/pi_medical_reviews?id=eq.${encodeURIComponent(reviewId)}&matter_id=eq.${encodeURIComponent(matterId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: "review_ready",
            page_count: Number(inventory?.pages || body?.page_count || 0),
            provider_count: Array.isArray(result?.providers) ? result.providers.length : 0,
            date_from: inventory?.date_range?.from || null,
            date_to: inventory?.date_range?.to || null,
            documented_charges: result?.medical_expenses?.documented_total ?? null,
            treatment_gap_count: Array.isArray(result?.treatment_gaps) ? result.treatment_gaps.length : 0,
            prior_condition_count: Array.isArray(result?.prior_conditions) ? result.prior_conditions.length : 0,
            attorney_flag_count: Array.isArray(result?.attorney_attention) ? result.attorney_attention.length : 0,
            summary: String(result?.executive_summary || ""),
            result,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        }
      );

      return NextResponse.json({ ok: true, review_id: reviewId });
    }

    return NextResponse.json({ ok: false, error: "Unsupported medical action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "MedIntel request failed." },
      { status: 500 }
    );
  }
}

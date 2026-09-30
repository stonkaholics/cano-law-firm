type FirmDraftingChunk = {
  chunk_id?: string;
  example_id?: string;
  title?: string;
  document_type?: string;
  source_role?: string;
  section_type?: string;
  heading?: string;
  content?: string;
  metadata?: Record<string, any>;
  similarity?: number;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY");
  return { url, secret };
}

function getOpenAIConfig() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return { key };
}

export async function createFirmDraftingEmbedding(input: string) {
  const { key } = getOpenAIConfig();
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: String(input || "").slice(0, 24000),
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `OpenAI embedding failed (${response.status}): ${body?.error?.message || response.statusText}`
    );
  }

  const embedding = body?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI embedding response did not include an embedding.");
  }
  return embedding as number[];
}

export async function searchFirmDraftingChunks(options: {
  query: string;
  matchCount?: number;
  documentFamily?: string;
  sourceRole?: string | null;
}) {
  const { url, secret } = getSupabaseConfig();
  const embedding = await createFirmDraftingEmbedding(options.query);

  const response = await fetch(
    `${url}/rest/v1/rpc/match_firm_drafting_chunks`,
    {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: options.matchCount ?? 8,
        filter_document_family: options.documentFamily ?? "habeas",
        filter_source_role: options.sourceRole ?? "style_exemplar",
      }),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `Supabase firm drafting search failed (${response.status}): ${raw || response.statusText}`
    );
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FirmDraftingChunk[]) : [];
  } catch {
    return [];
  }
}

function compact(value: any, max = 5000) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? {});
  return text.length > max ? text.slice(0, max) : text;
}

export function buildFirmDraftingSearchQuery(args: {
  matter: any;
  priorSpecialists?: Record<string, any>;
  draftType?: string;
}) {
  const caseBrain = args?.matter?.caseBrain || {};
  const summary =
    caseBrain?.summary?.detailed ||
    caseBrain?.summary?.brief ||
    args?.matter?.monday?.notesPreview ||
    "";

  const routing =
    caseBrain?.routing?.recommended_specialist ||
    caseBrain?.routing ||
    "";

  const issues = caseBrain?.issues || [];
  const timeline = caseBrain?.timeline || [];
  const prior = args.priorSpecialists || {};

  return [
    "Cano Law Firm habeas corpus drafting exemplar retrieval.",
    `Draft type: ${args.draftType || "habeas"}`,
    `Matter summary: ${compact(summary, 6000)}`,
    `Routing / posture: ${compact(routing, 1200)}`,
    `Issues: ${compact(issues, 3500)}`,
    `Timeline: ${compact(timeline, 3500)}`,
    `Lex research: ${compact(prior.research, 4500)}`,
    `Habeas analysis: ${compact(prior.habeas, 4500)}`,
    "Retrieve Cano-authored petition sections that are structurally and fact-pattern similar. Examples control style and organization only, never active-client facts or law.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function getFirmDraftingExamplesForMatter(args: {
  matter: any;
  priorSpecialists?: Record<string, any>;
  draftType?: string;
}) {
  const query = buildFirmDraftingSearchQuery(args);

  const chunks = await searchFirmDraftingChunks({
    query,
    matchCount: 10,
    documentFamily: "habeas",
    sourceRole: "style_exemplar",
  });

  return {
    query,
    retrievedAt: new Date().toISOString(),
    instructions: [
      "These are Cano Law Firm drafting exemplars for style, organization, tone, section sequencing, and level of detail only.",
      "Do not copy exemplar client facts into the active matter.",
      "Case Brain controls facts.",
      "Verified legal authority controls law and quotations.",
      "If an exemplar conflicts with the active matter or verified authority, ignore the exemplar.",
    ],
    chunks: chunks.map((chunk) => ({
      title: chunk.title || "",
      document_type: chunk.document_type || "",
      source_role: chunk.source_role || "",
      section_type: chunk.section_type || "",
      heading: chunk.heading || "",
      content: String(chunk.content || "").slice(0, 9000),
      similarity:
        typeof chunk.similarity === "number"
          ? Number(chunk.similarity.toFixed(4))
          : null,
      metadata: chunk.metadata || {},
    })),
  };
}

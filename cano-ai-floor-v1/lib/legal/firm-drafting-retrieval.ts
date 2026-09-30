type FirmDraftingSource = {
  id: string;
  exampleId: string;
  sectionOrder: number;
  sectionType: string;
  heading: string;
  content: string;
  similarity: number;
  title: string;
  originalFilename: string;
  documentType: string;
  sourceRole: string;
  storagePath: string;
  metadata: Record<string, any>;
};

function cleanText(value: any, max = 5000) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > max
    ? `${text.slice(0, max)}…`
    : text;
}

function jsonText(value: any, max = 6000) {
  if (!value) return "";

  try {
    return cleanText(JSON.stringify(value), max);
  } catch {
    return "";
  }
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL for firm drafting retrieval."
    );
  }

  if (!secret) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY for firm drafting retrieval."
    );
  }

  return {
    url,
    secret,
  };
}

async function createEmbedding(input: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY for firm drafting retrieval."
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input,
      }),
      cache: "no-store",
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `OpenAI embedding failed (${response.status}): ${
        text || response.statusText
      }`
    );
  }

  const data = JSON.parse(text);

  const embedding =
    data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error(
      "OpenAI embedding response did not contain an embedding."
    );
  }

  return embedding as number[];
}

function getSpecialistSummary(
  priorAgents: Record<string, any>,
  agentId: string
) {
  const output =
    priorAgents?.[agentId]?.output || null;

  if (!output) return "";

  return cleanText(
    output.executive_summary ||
      output.summary ||
      "",
    2500
  );
}

export function buildFirmDraftingRetrievalQuery({
  matter,
  priorAgents,
  draftType,
}: {
  matter: any;
  priorAgents: Record<string, any>;
  draftType: string;
}) {
  const caseBrain =
    matter?.caseBrain || {};

  const matterName =
    caseBrain?.people?.detainee?.name ||
    caseBrain?.people?.detainee?.full_name ||
    matter?.monday?.preview?.detaineeName ||
    matter?.monday?.preview?.name ||
    "";

  const sections = [
    `Draft requested: ${draftType}`,

    matterName
      ? `Active matter: ${matterName}`
      : "",

    caseBrain?.summary?.brief
      ? `Case summary: ${cleanText(
          caseBrain.summary.brief,
          2500
        )}`
      : "",

    caseBrain?.summary?.detailed
      ? `Detailed posture: ${cleanText(
          caseBrain.summary.detailed,
          3500
        )}`
      : "",

    caseBrain?.routing?.recommended_specialist
      ? `Case Brain route: ${
          caseBrain.routing.recommended_specialist
        }`
      : "",

    caseBrain?.routing?.reason
      ? `Routing reason: ${cleanText(
          caseBrain.routing.reason,
          1200
        )}`
      : "",

    Array.isArray(caseBrain?.issues)
      ? `Issues: ${jsonText(
          caseBrain.issues,
          3000
        )}`
      : "",

    Array.isArray(caseBrain?.key_facts)
      ? `Key facts: ${jsonText(
          caseBrain.key_facts,
          3500
        )}`
      : "",

    Array.isArray(caseBrain?.missing_information)
      ? `Missing information: ${jsonText(
          caseBrain.missing_information,
          2000
        )}`
      : "",

    getSpecialistSummary(
      priorAgents,
      "research"
    )
      ? `Lex research: ${getSpecialistSummary(
          priorAgents,
          "research"
        )}`
      : "",

    getSpecialistSummary(
      priorAgents,
      "habeas"
    )
      ? `Elena habeas analysis: ${getSpecialistSummary(
          priorAgents,
          "habeas"
        )}`
      : "",

    getSpecialistSummary(
      priorAgents,
      "bond"
    )
      ? `Mateo bond analysis: ${getSpecialistSummary(
          priorAgents,
          "bond"
        )}`
      : "",

    getSpecialistSummary(
      priorAgents,
      "timeline"
    )
      ? `Chronos timeline analysis: ${getSpecialistSummary(
          priorAgents,
          "timeline"
        )}`
      : "",
  ].filter(Boolean);

  return sections.join("\n\n").slice(0, 18000);
}

async function callFirmDraftingRpc({
  embedding,
  documentFamily,
  sourceRole,
  matchCount,
}: {
  embedding: number[];
  documentFamily: string;
  sourceRole: string;
  matchCount: number;
}) {
  const { url, secret } =
    getSupabaseConfig();

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
        p_query_embedding: embedding,
        p_document_family:
          documentFamily,
        p_source_role:
          sourceRole,
        p_match_count:
          matchCount,
      }),
      cache: "no-store",
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Firm drafting search failed (${response.status}): ${
        text || response.statusText
      }`
    );
  }

  if (!text) return [];

  const parsed = JSON.parse(text);

  return Array.isArray(parsed)
    ? parsed
    : [];
}

function diversifySources(
  rows: any[],
  maxSources = 10
) {
  const selected: any[] = [];

  const perExample = new Map<
    string,
    number
  >();

  for (const row of rows) {
    if (!row?.content) continue;

    const exampleId =
      String(row.example_id || "");

    const current =
      perExample.get(exampleId) || 0;

    // Avoid one petition completely dominating
    // the retrieval context.
    if (current >= 3) continue;

    selected.push(row);

    perExample.set(
      exampleId,
      current + 1
    );

    if (
      selected.length >= maxSources
    ) {
      break;
    }
  }

  return selected;
}

export async function retrieveFirmDraftingSources({
  matter,
  priorAgents,
  draftType,
}: {
  matter: any;
  priorAgents: Record<string, any>;
  draftType: string;
}): Promise<{
  query: string;
  sources: FirmDraftingSource[];
}> {
  const normalizedDraftType =
    String(draftType || "")
      .toLowerCase();

  const documentFamily =
    normalizedDraftType === "bond_motion"
      ? "bond"
      : "habeas";

  const query =
    buildFirmDraftingRetrievalQuery({
      matter,
      priorAgents,
      draftType,
    });

  const embedding =
    await createEmbedding(query);

  // Retrieve extra rows first so we can
  // diversify across multiple examples.
  const rows =
    await callFirmDraftingRpc({
      embedding,
      documentFamily,
      sourceRole: "style_exemplar",
      matchCount: 20,
    });

  const diversified =
    diversifySources(rows, 10);

  const sources: FirmDraftingSource[] =
    diversified.map((row: any) => ({
      id: String(row.id || ""),
      exampleId: String(
        row.example_id || ""
      ),

      sectionOrder:
        Number(
          row.section_order || 0
        ),

      sectionType:
        String(
          row.section_type ||
            "other"
        ),

      heading:
        String(row.heading || ""),

      content:
        String(row.content || "")
          .slice(0, 7000),

      similarity:
        Number(
          Number(
            row.similarity || 0
          ).toFixed(4)
        ),

      title:
        String(row.title || ""),

      originalFilename:
        String(
          row.original_filename ||
            ""
        ),

      documentType:
        String(
          row.document_type ||
            ""
        ),

      sourceRole:
        String(
          row.source_role ||
            ""
        ),

      storagePath:
        String(
          row.storage_path ||
            ""
        ),

      metadata:
        row.metadata &&
        typeof row.metadata ===
          "object"
          ? row.metadata
          : {},
    }));

  return {
    query,
    sources,
  };
}

export type {
  FirmDraftingSource,
};

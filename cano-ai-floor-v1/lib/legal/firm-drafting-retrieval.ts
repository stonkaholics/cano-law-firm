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
  const embedding = data?.data?.[0]?.embedding;

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
  const output = priorAgents?.[agentId]?.output || null;

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
  const caseBrain = matter?.caseBrain || {};

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

    getSpecialistSummary(priorAgents, "research")
      ? `Lex research: ${getSpecialistSummary(
          priorAgents,
          "research"
        )}`
      : "",

    getSpecialistSummary(priorAgents, "habeas")
      ? `Elena habeas analysis: ${getSpecialistSummary(
          priorAgents,
          "habeas"
        )}`
      : "",

    getSpecialistSummary(priorAgents, "bond")
      ? `Mateo bond analysis: ${getSpecialistSummary(
          priorAgents,
          "bond"
        )}`
      : "",

    getSpecialistSummary(priorAgents, "timeline")
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
  const { url, secret } = getSupabaseConfig();

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
        p_document_family: documentFamily,
        p_source_role: sourceRole,
        p_match_count: matchCount,
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

function rowSimilarity(row: any) {
  const n = Number(row?.similarity || 0);
  return Number.isFinite(n) ? n : 0;
}

function rowExampleKey(row: any) {
  return String(
    row?.example_id ||
      row?.storage_path ||
      row?.original_filename ||
      ""
  );
}

function rowSectionKey(row: any) {
  return String(
    row?.section_type ||
      row?.heading ||
      "other"
  )
    .trim()
    .toLowerCase();
}

/*
|--------------------------------------------------------------------------
| DIVERSIFIED RETRIEVAL
|--------------------------------------------------------------------------
|
| Goals:
| 1. Do not let one petition consume all top slots.
| 2. Prefer at least one strong chunk from several different firm examples.
| 3. Prefer different section types where possible.
| 4. Still preserve semantic relevance.
| 5. Allow a second chunk from the same exemplar only after cross-document
|    coverage has been attempted.
|
*/

function diversifySources(
  rows: any[],
  {
    maxSources = 8,
    maxPerExample = 2,
    maxPerSectionType = 2,
    relativeSimilarityWindow = 0.12,
    absoluteSimilarityFloor = 0.35,
  }: {
    maxSources?: number;
    maxPerExample?: number;
    maxPerSectionType?: number;
    relativeSimilarityWindow?: number;
    absoluteSimilarityFloor?: number;
  } = {}
) {
  const cleaned = rows
    .filter((row) => row?.content)
    .sort(
      (a, b) =>
        rowSimilarity(b) -
        rowSimilarity(a)
    );

  if (!cleaned.length) {
    return [];
  }

  const topSimilarity =
    rowSimilarity(cleaned[0]);

  const eligible = cleaned.filter(
    (row) => {
      const similarity =
        rowSimilarity(row);

      const withinRelativeWindow =
        topSimilarity <= 0 ||
        similarity >=
          topSimilarity -
            relativeSimilarityWindow;

      const aboveAbsoluteFloor =
        similarity >=
        absoluteSimilarityFloor;

      return (
        withinRelativeWindow ||
        aboveAbsoluteFloor
      );
    }
  );

  // If thresholding somehow eliminates everything,
  // fall back to the original ranked result set.
  const pool =
    eligible.length
      ? eligible
      : cleaned;

  const selected: any[] = [];
  const selectedIds = new Set<string>();
  const perExample =
    new Map<string, number>();
  const perSectionType =
    new Map<string, number>();

  const addRow = (row: any) => {
    const rowId = String(
      row?.id ||
        `${rowExampleKey(row)}:${row?.section_order}:${rowSectionKey(row)}`
    );

    if (selectedIds.has(rowId)) {
      return false;
    }

    const exampleKey =
      rowExampleKey(row);

    const sectionKey =
      rowSectionKey(row);

    const exampleCount =
      perExample.get(exampleKey) || 0;

    const sectionCount =
      perSectionType.get(sectionKey) ||
      0;

    if (
      exampleCount >=
      maxPerExample
    ) {
      return false;
    }

    if (
      sectionCount >=
      maxPerSectionType
    ) {
      return false;
    }

    selected.push(row);
    selectedIds.add(rowId);

    perExample.set(
      exampleKey,
      exampleCount + 1
    );

    perSectionType.set(
      sectionKey,
      sectionCount + 1
    );

    return true;
  };

  /*
  |--------------------------------------------------------------------------
  | PASS 1 — BEST CHUNK FROM EACH UNIQUE EXAMPLE
  |--------------------------------------------------------------------------
  */

  const seenExamples =
    new Set<string>();

  for (const row of pool) {
    const exampleKey =
      rowExampleKey(row);

    if (
      !exampleKey ||
      seenExamples.has(exampleKey)
    ) {
      continue;
    }

    if (addRow(row)) {
      seenExamples.add(
        exampleKey
      );
    }

    if (
      selected.length >=
      maxSources
    ) {
      break;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | PASS 2 — ADD SECTION-TYPE VARIETY
  |--------------------------------------------------------------------------
  |
  | Prefer chunks whose section type is not already represented heavily.
  |
  */

  if (
    selected.length <
    maxSources
  ) {
    const bySectionNovelty = [
      ...pool,
    ].sort((a, b) => {
      const aCount =
        perSectionType.get(
          rowSectionKey(a)
        ) || 0;

      const bCount =
        perSectionType.get(
          rowSectionKey(b)
        ) || 0;

      if (aCount !== bCount) {
        return aCount - bCount;
      }

      return (
        rowSimilarity(b) -
        rowSimilarity(a)
      );
    });

    for (
      const row of
      bySectionNovelty
    ) {
      addRow(row);

      if (
        selected.length >=
        maxSources
      ) {
        break;
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | PASS 3 — RELEVANCE FALLBACK
  |--------------------------------------------------------------------------
  |
  | If strict section caps left open slots, fill them with the strongest
  | remaining chunks while still enforcing maxPerExample.
  |
  */

  if (
    selected.length <
    maxSources
  ) {
    for (const row of pool) {
      const rowId = String(
        row?.id ||
          `${rowExampleKey(row)}:${row?.section_order}:${rowSectionKey(row)}`
      );

      if (
        selectedIds.has(rowId)
      ) {
        continue;
      }

      const exampleKey =
        rowExampleKey(row);

      const exampleCount =
        perExample.get(
          exampleKey
        ) || 0;

      if (
        exampleCount >=
        maxPerExample
      ) {
        continue;
      }

      selected.push(row);
      selectedIds.add(rowId);

      perExample.set(
        exampleKey,
        exampleCount + 1
      );

      if (
        selected.length >=
        maxSources
      ) {
        break;
      }
    }
  }

  // Keep final output ordered by semantic similarity
  // so match percentages still read naturally in the UI.
  return selected.sort(
    (a, b) =>
      rowSimilarity(b) -
      rowSimilarity(a)
  );
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
  retrievalStats: {
    candidateCount: number;
    uniqueCandidateDocuments: number;
    selectedCount: number;
    uniqueSelectedDocuments: number;
  };
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

  /*
  |--------------------------------------------------------------------------
  | RETRIEVE A LARGE CANDIDATE POOL
  |--------------------------------------------------------------------------
  |
  | We intentionally ask for more than we send to Scribe.
  | If we only retrieve the top 10-20 rows, a single petition can occupy
  | almost the entire candidate set before diversification even begins.
  |
  */

  const rows =
    await callFirmDraftingRpc({
      embedding,
      documentFamily,
      sourceRole:
        "style_exemplar",
      matchCount: 50,
    });

  const diversified =
    diversifySources(rows, {
      maxSources: 8,
      maxPerExample: 2,
      maxPerSectionType: 2,
      relativeSimilarityWindow:
        0.12,
      absoluteSimilarityFloor:
        0.35,
    });

  const sources: FirmDraftingSource[] =
    diversified.map(
      (row: any) => ({
        id: String(
          row.id || ""
        ),

        exampleId: String(
          row.example_id ||
            ""
        ),

        sectionOrder:
          Number(
            row.section_order ||
              0
          ),

        sectionType:
          String(
            row.section_type ||
              "other"
          ),

        heading:
          String(
            row.heading || ""
          ),

        content:
          String(
            row.content || ""
          ).slice(0, 7000),

        similarity:
          Number(
            Number(
              row.similarity ||
                0
            ).toFixed(4)
          ),

        title:
          String(
            row.title || ""
          ),

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
      })
    );

  const uniqueCandidateDocuments =
    new Set(
      rows.map((row: any) =>
        rowExampleKey(row)
      )
    ).size;

  const uniqueSelectedDocuments =
    new Set(
      diversified.map(
        (row: any) =>
          rowExampleKey(row)
      )
    ).size;

  return {
    query,
    sources,

    retrievalStats: {
      candidateCount:
        rows.length,

      uniqueCandidateDocuments,

      selectedCount:
        sources.length,

      uniqueSelectedDocuments,
    },
  };
}

export type {
  FirmDraftingSource,
};

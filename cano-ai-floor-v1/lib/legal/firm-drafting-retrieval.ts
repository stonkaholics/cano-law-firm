const FIRM_DRAFTING_BUCKET = "firm-drafting-examples";

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


type FirmDraftingExampleRow = {
  id: string;
  practice_area?: string | null;
  document_family?: string | null;
  document_type?: string | null;
  source_role?: string | null;
  title?: string | null;
  original_filename?: string | null;
  storage_path?: string | null;
  parsed_markdown?: string | null;
  extracted_structure?: Record<string, any> | null;
};

type IngestedSection = {
  sectionOrder: number;
  sectionType: string;
  heading: string;
  content: string;
};

function encodeStoragePath(value: string) {
  return String(value || "")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function normalizeSourceText(value: string) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeLegalHeading(value: string) {
  const text = String(value || "").trim();

  if (!text || text.length > 180) {
    return false;
  }

  if (
    /^(introduction|argument|arguments|conclusion|certificate of service|certificate of compliance|respectfully submitted|statement of facts|factual background|procedural history|jurisdiction|venue|parties|background|reply|response)$/i.test(
      text
    )
  ) {
    return true;
  }

  if (
    /^(?:[IVXLCDM]+|[A-Z]|\d+)\.\s+\S+/i.test(text)
  ) {
    return true;
  }

  const letters = text.replace(/[^A-Za-z]/g, "");

  if (letters.length < 5) {
    return false;
  }

  const upper =
    letters.replace(/[^A-Z]/g, "").length;

  return upper / letters.length >= 0.78;
}

function inferSectionType(
  heading: string,
  content: string,
  index: number
) {
  const text = `${heading}\n${content}`.toLowerCase();

  if (index === 0 && /united states district court/.test(text)) {
    return "caption";
  }

  if (/certificate of service/.test(text)) {
    return "certificate_of_service";
  }

  if (/certificate of compliance/.test(text)) {
    return "certificate_of_compliance";
  }

  if (/respectfully submitted|signature/.test(text)) {
    return "signature";
  }

  if (/conclusion/.test(text)) {
    return "conclusion";
  }

  if (/introduction/.test(text)) {
    return "introduction";
  }

  if (
    /jurisdiction|custodian|warden|venue/.test(text) &&
    /dismiss|respondent|motion/.test(text)
  ) {
    return "jurisdictional_response";
  }

  if (
    /government|respondent|federal respondent/.test(text) &&
    /argu|contend|position|assert/.test(text)
  ) {
    return "government_position";
  }

  if (
    /case|authority|supreme court|circuit|district court|u\.s\.c\.|§/.test(
      text
    )
  ) {
    return "response_to_government_authority";
  }

  if (/argument|motion to dismiss|reply|response/.test(text)) {
    return "argument";
  }

  return index === 0 ? "caption" : "other";
}

function splitLongSection(
  heading: string,
  sectionType: string,
  content: string,
  startOrder: number,
  maxChars = 4800
) {
  const normalized = normalizeSourceText(content);

  if (!normalized) {
    return [] as IngestedSection[];
  }

  if (normalized.length <= maxChars) {
    return [
      {
        sectionOrder: startOrder,
        sectionType,
        heading: heading || sectionType,
        content: normalized,
      },
    ];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const parts: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate =
      current
        ? `${current}\n\n${paragraph}`
        : paragraph;

    if (
      candidate.length > maxChars &&
      current
    ) {
      parts.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts.map((part, index) => ({
    sectionOrder:
      startOrder + index,
    sectionType,
    heading:
      parts.length > 1
        ? `${heading || sectionType} - Part ${index + 1}`
        : heading || sectionType,
    content: part,
  }));
}

function splitLegalDocumentIntoSections(
  rawText: string
) {
  const text =
    normalizeSourceText(rawText);

  const paragraphs =
    text
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);

  const grouped: Array<{
    heading: string;
    body: string[];
  }> = [];

  let current = {
    heading: "Caption",
    body: [] as string[],
  };

  for (const paragraph of paragraphs) {
    const compact =
      paragraph.replace(/\n+/g, " ").trim();

    if (
      looksLikeLegalHeading(compact) &&
      current.body.length
    ) {
      grouped.push(current);
      current = {
        heading: compact,
        body: [],
      };
      continue;
    }

    current.body.push(paragraph);
  }

  if (current.body.length) {
    grouped.push(current);
  }

  const sections: IngestedSection[] = [];
  let order = 1;

  grouped.forEach((group, index) => {
    const content =
      group.body.join("\n\n");

    const sectionType =
      inferSectionType(
        group.heading,
        content,
        index
      );

    const split =
      splitLongSection(
        group.heading,
        sectionType,
        content,
        order
      );

    sections.push(...split);
    order += split.length;
  });

  if (!sections.length && text) {
    const split =
      splitLongSection(
        "Document",
        "other",
        text,
        1
      );

    sections.push(...split);
  }

  return sections;
}

async function getPreferredExamples({
  documentFamily,
  preferredDocumentKind,
  intendedAgent,
}: {
  documentFamily: string;
  preferredDocumentKind: string;
  intendedAgent?: string;
}) {
  const { url, secret } =
    getSupabaseConfig();

  const params =
    new URLSearchParams({
      select:
        "id,practice_area,document_family,document_type,source_role,title,original_filename,storage_path,parsed_markdown,extracted_structure",
      active: "eq.true",
      document_family:
        `eq.${documentFamily}`,
      source_role:
        "eq.style_exemplar",
    });

  const response =
    await fetch(
      `${url}/rest/v1/firm_drafting_examples?${params.toString()}`,
      {
        headers: {
          apikey: secret,
          Authorization:
            `Bearer ${secret}`,
        },
        cache: "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Unable to load firm drafting exemplars (${response.status}): ${
        text || response.statusText
      }`
    );
  }

  const rows =
    text ? JSON.parse(text) : [];

  return (
    Array.isArray(rows)
      ? rows
      : []
  ).filter(
    (row: FirmDraftingExampleRow) => {
      const structure =
        row?.extracted_structure &&
        typeof row.extracted_structure ===
          "object"
          ? row.extracted_structure
          : {};

      const documentKind =
        String(
          structure?.document_kind ||
            structure?.documentKind ||
            ""
        ).trim();

      const assignedAgent =
        String(
          structure?.intended_agent ||
            structure?.intendedAgent ||
            ""
        ).trim();

      return (
        documentKind ===
          preferredDocumentKind &&
        (
          !intendedAgent ||
          !assignedAgent ||
          assignedAgent ===
            intendedAgent
        )
      );
    }
  ) as FirmDraftingExampleRow[];
}

async function exampleHasChunks(
  exampleId: string
) {
  const { url, secret } =
    getSupabaseConfig();

  const params =
    new URLSearchParams({
      select: "id",
      example_id:
        `eq.${exampleId}`,
      limit: "1",
    });

  const response =
    await fetch(
      `${url}/rest/v1/firm_drafting_chunks?${params.toString()}`,
      {
        headers: {
          apikey: secret,
          Authorization:
            `Bearer ${secret}`,
        },
        cache: "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Unable to inspect firm drafting chunks (${response.status}): ${
        text || response.statusText
      }`
    );
  }

  const rows =
    text ? JSON.parse(text) : [];

  return (
    Array.isArray(rows) &&
    rows.length > 0
  );
}

async function readStoredExampleText(
  example: FirmDraftingExampleRow
) {
  const existing =
    normalizeSourceText(
      String(
        example.parsed_markdown ||
          ""
      )
    );

  if (existing) {
    return existing;
  }

  const storagePath =
    String(
      example.storage_path || ""
    ).trim();

  if (!storagePath) {
    throw new Error(
      `Drafting exemplar ${example.id} has no storage_path.`
    );
  }

  const { url, secret } =
    getSupabaseConfig();

  const response =
    await fetch(
      `${url}/storage/v1/object/authenticated/${FIRM_DRAFTING_BUCKET}/${encodeStoragePath(
        storagePath
      )}`,
      {
        headers: {
          apikey: secret,
          Authorization:
            `Bearer ${secret}`,
        },
        cache: "no-store",
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Unable to download drafting exemplar (${response.status}): ${
        text || response.statusText
      }`
    );
  }

  const filename =
    String(
      example.original_filename ||
        storagePath
    ).toLowerCase();

  if (filename.endsWith(".docx")) {
    const module =
      await import("mammoth");

    const mammoth =
      (module as any).default ||
      module;

    const arrayBuffer =
      await response.arrayBuffer();

    const parsed =
      await mammoth.extractRawText({
        buffer:
          Buffer.from(
            arrayBuffer
          ),
      });

    return normalizeSourceText(
      parsed?.value || ""
    );
  }

  return normalizeSourceText(
    await response.text()
  );
}

async function saveExampleChunks({
  example,
  rawText,
  sections,
  intendedAgent,
  preferredDocumentKind,
}: {
  example: FirmDraftingExampleRow;
  rawText: string;
  sections: IngestedSection[];
  intendedAgent?: string;
  preferredDocumentKind: string;
}) {
  const { url, secret } =
    getSupabaseConfig();

  const rows = [];

  for (const section of sections) {
    const embedding =
      await createEmbedding(
        `${section.heading}\n\n${section.content}`
      );

    rows.push({
      example_id:
        example.id,
      section_order:
        section.sectionOrder,
      section_type:
        section.sectionType,
      heading:
        section.heading,
      content:
        section.content,
      metadata: {
        source_role:
          example.source_role ||
          "style_exemplar",
        document_type:
          example.document_type ||
          "other",
        document_kind:
          preferredDocumentKind,
        intended_agent:
          intendedAgent || null,
        title:
          example.title || "",
        original_filename:
          example.original_filename ||
          "",
        storage_path:
          example.storage_path || "",
        auto_ingested:
          true,
        ingestion_version:
          "rhea_response_exemplar_v1",
      },
      embedding,
    });
  }

  /*
  | Re-check after embeddings are created so two near-simultaneous
  | first runs do not normally create duplicate chunks.
  */
  if (
    await exampleHasChunks(
      example.id
    )
  ) {
    return 0;
  }

  const insertResponse =
    await fetch(
      `${url}/rest/v1/firm_drafting_chunks`,
      {
        method: "POST",
        headers: {
          apikey: secret,
          Authorization:
            `Bearer ${secret}`,
          "Content-Type":
            "application/json",
          Prefer:
            "return=minimal",
        },
        body:
          JSON.stringify(rows),
        cache: "no-store",
      }
    );

  const insertText =
    await insertResponse.text();

  if (!insertResponse.ok) {
    throw new Error(
      `Unable to save drafting exemplar chunks (${insertResponse.status}): ${
        insertText ||
        insertResponse.statusText
      }`
    );
  }

  const structure =
    example.extracted_structure &&
    typeof example.extracted_structure ===
      "object"
      ? example.extracted_structure
      : {};

  const updateResponse =
    await fetch(
      `${url}/rest/v1/firm_drafting_examples?id=eq.${encodeURIComponent(
        example.id
      )}`,
      {
        method: "PATCH",
        headers: {
          apikey: secret,
          Authorization:
            `Bearer ${secret}`,
          "Content-Type":
            "application/json",
          Prefer:
            "return=minimal",
        },
        body:
          JSON.stringify({
            parsed_markdown:
              rawText,
            extracted_structure: {
              ...structure,
              ingestion: {
                status:
                  "embedded",
                version:
                  "rhea_response_exemplar_v1",
                chunk_count:
                  rows.length,
                ingested_at:
                  new Date()
                    .toISOString(),
              },
            },
            updated_at:
              new Date()
                .toISOString(),
          }),
        cache: "no-store",
      }
    );

  if (!updateResponse.ok) {
    const updateText =
      await updateResponse.text();

    console.error(
      "Firm drafting exemplar parent update failed after chunk insert:",
      updateText ||
        updateResponse.statusText
    );
  }

  return rows.length;
}

async function ensurePreferredExamplesIngested({
  documentFamily,
  preferredDocumentKind,
  intendedAgent,
}: {
  documentFamily: string;
  preferredDocumentKind: string;
  intendedAgent?: string;
}) {
  const examples =
    await getPreferredExamples({
      documentFamily,
      preferredDocumentKind,
      intendedAgent,
    });

  let ingestedChunks = 0;

  for (const example of examples) {
    if (
      await exampleHasChunks(
        example.id
      )
    ) {
      continue;
    }

    const rawText =
      await readStoredExampleText(
        example
      );

    if (!rawText) {
      throw new Error(
        `Drafting exemplar ${example.id} did not contain extractable text.`
      );
    }

    const sections =
      splitLegalDocumentIntoSections(
        rawText
      );

    if (!sections.length) {
      throw new Error(
        `Drafting exemplar ${example.id} could not be split into reusable sections.`
      );
    }

    ingestedChunks +=
      await saveExampleChunks({
        example,
        rawText,
        sections,
        intendedAgent,
        preferredDocumentKind,
      });
  }

  return {
    matchedExamples:
      examples.length,
    ingestedChunks,
  };
}

function rowMetadata(
  row: any
) {
  return (
    row?.metadata &&
    typeof row.metadata === "object"
      ? row.metadata
      : {}
  );
}

function matchesPreferredRow(
  row: any,
  preferredDocumentKind?: string,
  intendedAgent?: string
) {
  if (!preferredDocumentKind) {
    return false;
  }

  const metadata =
    rowMetadata(row);

  const kind =
    String(
      metadata.document_kind ||
        metadata.documentKind ||
        ""
    ).trim();

  const assignedAgent =
    String(
      metadata.intended_agent ||
        metadata.intendedAgent ||
        ""
    ).trim();

  return (
    kind ===
      preferredDocumentKind &&
    (
      !intendedAgent ||
      !assignedAgent ||
      assignedAgent ===
        intendedAgent
    )
  );
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
  preferredDocumentKind,
  intendedAgent,
}: {
  matter: any;
  priorAgents: Record<string, any>;
  draftType: string;
  preferredDocumentKind?: string;
  intendedAgent?: string;
}): Promise<{
  query: string;
  sources: FirmDraftingSource[];
  warnings: string[];
  ingestion: {
    matchedExamples: number;
    ingestedChunks: number;
  } | null;
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

  const warnings: string[] = [];
  let ingestion: {
    matchedExamples: number;
    ingestedChunks: number;
  } | null = null;

  /*
  |--------------------------------------------------------------------------
  | RHEA RESPONSE-EXEMPLAR AUTO-INGEST
  |--------------------------------------------------------------------------
  |
  | Existing Scribe vector retrieval remains unchanged.
  | When Rhea asks for a specifically tagged response exemplar, ensure any
  | matching DOCX that was registered in firm_drafting_examples has reusable
  | chunks + embeddings before the semantic search runs.
  |
  */

  if (preferredDocumentKind) {
    try {
      ingestion =
        await ensurePreferredExamplesIngested({
          documentFamily,
          preferredDocumentKind,
          intendedAgent,
        });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Preferred firm drafting exemplar ingestion failed.";

      warnings.push(message);

      console.error(
        "Preferred firm drafting exemplar ingestion:",
        error
      );
    }
  }

  const baseQuery =
    buildFirmDraftingRetrievalQuery({
      matter,
      priorAgents,
      draftType,
    });

  const query =
    [
      preferredDocumentKind
        ? `Preferred Cano exemplar kind: ${preferredDocumentKind}`
        : "",
      intendedAgent
        ? `Assigned drafting agent: ${intendedAgent}`
        : "",
      baseQuery,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 18000);

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

  let diversified: any[] = [];

  if (preferredDocumentKind) {
    const preferredRows =
      rows.filter((row: any) =>
        matchesPreferredRow(
          row,
          preferredDocumentKind,
          intendedAgent
        )
      );

    const preferred =
      diversifySources(
        preferredRows,
        {
          maxSources: 6,
          maxPerExample: 6,
          maxPerSectionType: 3,
          relativeSimilarityWindow:
            0.25,
          absoluteSimilarityFloor:
            0.2,
        }
      );

    const selectedIds =
      new Set(
        preferred.map(
          (row: any) =>
            String(
              row?.id ||
                `${rowExampleKey(row)}:${row?.section_order}:${rowSectionKey(row)}`
            )
        )
      );

    const remainingSlots =
      Math.max(
        0,
        8 - preferred.length
      );

    const remaining =
      remainingSlots
        ? diversifySources(
            rows.filter(
              (row: any) => {
                const id =
                  String(
                    row?.id ||
                      `${rowExampleKey(row)}:${row?.section_order}:${rowSectionKey(row)}`
                  );

                return !selectedIds.has(
                  id
                );
              }
            ),
            {
              maxSources:
                remainingSlots,
              maxPerExample: 2,
              maxPerSectionType: 2,
              relativeSimilarityWindow:
                0.12,
              absoluteSimilarityFloor:
                0.35,
            }
          )
        : [];

    diversified = [
      ...preferred,
      ...remaining,
    ].slice(0, 8);

    if (!preferred.length) {
      warnings.push(
        `No embedded ${preferredDocumentKind} firm exemplar chunks were retrieved.`
      );
    }
  } else {
    diversified =
      diversifySources(rows, {
        maxSources: 8,
        maxPerExample: 2,
        maxPerSectionType: 2,
        relativeSimilarityWindow:
          0.12,
        absoluteSimilarityFloor:
          0.35,
      });
  }

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
    warnings,
    ingestion,

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

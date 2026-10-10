export type ScribeAuthorityRecord = {
  case_name: string;
  citation: string;
  full_citation: string;
  citation_complete: boolean;
  court: string;
  date: string;
  source_url: string;
  source_provider: string;
  source_agent: string;
  proposition: string;
  relevance: string;
  binding_status: string;
  quote_status: string;
  citator_status: string;
};

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value: unknown): any[] {
  return Array.isArray(value)
    ? value
    : [];
}

function authorityFrom(
  raw: any,
  sourceAgent: string
): ScribeAuthorityRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const caseName =
    clean(
      raw.case_name ||
      raw.caseName ||
      raw.title ||
      raw.authority
    );

  const citation =
    clean(
      raw.citation ||
      raw.reporter_citation ||
      raw.reporterCitation
    );

  const suppliedFull =
    clean(
      raw.full_citation ||
      raw.fullCitation
    );

  const fullCitation =
    suppliedFull ||
    (
      caseName &&
      citation
        ? `${caseName}, ${citation}`
        : ""
    ) ||
    "CITATION INCOMPLETE";

  if (
    !caseName &&
    !citation &&
    fullCitation ===
      "CITATION INCOMPLETE"
  ) {
    return null;
  }

  return {
    case_name:
      caseName ||
      fullCitation,

    citation,

    full_citation:
      fullCitation,

    citation_complete:
      raw.citation_complete ===
        true ||
      raw.citationComplete ===
        true ||
      Boolean(
        caseName &&
        citation
      ),

    court:
      clean(
        raw.court
      ),

    date:
      clean(
        raw.date ||
        raw.year
      ),

    source_url:
      clean(
        raw.source_url ||
        raw.url
      ),

    source_provider:
      clean(
        raw.source_provider ||
        raw.provider
      ),

    source_agent:
      clean(
        raw.source_agent
      ) ||
      sourceAgent,

    proposition:
      clean(
        raw.proposition
      ),

    relevance:
      clean(
        raw.relevance
      ),

    binding_status:
      clean(
        raw.binding_status ||
        raw.bindingStatus
      ) ||
      "unknown",

    quote_status:
      clean(
        raw.quote_status ||
        raw.quoteStatus
      ) ||
      "not_supplied",

    citator_status:
      clean(
        raw.citator_status ||
        raw.citatorStatus
      ) ||
      "needs_citator_review",
  };
}

function collectAuthorityArrays(
  output: any
) {
  if (!output || typeof output !== "object") {
    return [];
  }

  const arrays = [
    output.authorities,
    output.legal_authorities,
    output.case_law,
    output.caseLaw,
    output.draft?.authority_checklist,
  ];

  return arrays
    .filter(Array.isArray)
    .flat();
}

export function buildScribeAuthorityDictionary(
  priorAgents: Record<string, any>
) {
  const rows: ScribeAuthorityRecord[] = [];

  for (
    const [agentId, state]
    of Object.entries(
      priorAgents || {}
    )
  ) {
    const output =
      state?.output || null;

    for (
      const raw of
      collectAuthorityArrays(
        output
      )
    ) {
      const normalized =
        authorityFrom(
          raw,
          agentId
        );

      if (normalized) {
        rows.push(
          normalized
        );
      }
    }
  }

  const seen =
    new Set<string>();

  const authorities =
    rows.filter(
      (row) => {
        const key =
          [
            row.case_name,
            row.citation,
            row.full_citation,
          ]
            .join("|")
            .toLowerCase();

        if (
          !key ||
          seen.has(key)
        ) {
          return false;
        }

        seen.add(key);
        return true;
      }
    );

  const byCaseName: Record<
    string,
    ScribeAuthorityRecord
  > = {};

  for (const row of authorities) {
    const key =
      row.case_name
        .toLowerCase();

    if (
      key &&
      !byCaseName[key]
    ) {
      byCaseName[key] =
        row;
    }
  }

  return {
    generated_at:
      new Date()
        .toISOString(),

    authority_count:
      authorities.length,

    authorities,

    by_case_name:
      byCaseName,

    usage_rules: [
      "Before naming any case in filing-ready prose, look it up in this authority dictionary.",
      "Use full_citation when available.",
      "Do not output a case-name-only citation as filing-ready when fuller citation metadata exists.",
      "If full_citation is CITATION INCOMPLETE, preserve that warning in draft.authority_checklist and do not invent the missing citation components.",
      "Every relied-on authority should preserve source_url, source_provider, source_agent, proposition, binding_status, and citator_status when supplied.",
      "A source in this dictionary is not automatically good law; preserve citator review warnings."
    ]
  };
}

function normalizeFact(
  raw: any,
  sourceAgent: string
) {
  if (
    raw == null
  ) {
    return null;
  }

  if (
    typeof raw ===
    "string"
  ) {
    const fact =
      clean(raw);

    if (!fact) {
      return null;
    }

    return {
      fact,
      legal_significance:
        "",
      source:
        sourceAgent,
      source_agent:
        sourceAgent,
      source_reference:
        "",
      confidence:
        "reported"
    };
  }

  if (
    typeof raw !==
    "object"
  ) {
    return null;
  }

  const fact =
    clean(
      raw.fact ||
      raw.detail ||
      raw.event ||
      raw.description ||
      raw.text
    );

  if (!fact) {
    return null;
  }

  return {
    fact,

    legal_significance:
      clean(
        raw.legal_significance ||
        raw.significance ||
        raw.why_it_matters ||
        raw.whyItMatters
      ),

    source:
      clean(
        raw.source
      ) ||
      sourceAgent,

    source_agent:
      clean(
        raw.source_agent
      ) ||
      sourceAgent,

    source_reference:
      clean(
        raw.source_reference ||
        raw.source_ref ||
        raw.reference ||
        raw.page ||
        raw.paragraph
      ),

    confidence:
      clean(
        raw.confidence
      ) ||
      "reported"
  };
}

export function buildScribeFactDevelopmentPackets(
  storedMatter: any,
  priorAgents: Record<string, any>
) {
  const packets: any[] = [];

  const caseBrain =
    storedMatter?.caseBrain ||
    {};

  for (
    const raw of
    asArray(
      caseBrain.key_facts
    )
  ) {
    const fact =
      normalizeFact(
        raw,
        "case_brain"
      );

    if (fact) {
      packets.push(fact);
    }
  }

  for (
    const raw of
    asArray(
      caseBrain.timeline
    )
  ) {
    const fact =
      normalizeFact(
        raw,
        "case_brain_timeline"
      );

    if (fact) {
      packets.push(fact);
    }
  }

  for (
    const [agentId, state]
    of Object.entries(
      priorAgents || {}
    )
  ) {
    const output =
      state?.output ||
      {};

    for (
      const raw of
      [
        ...asArray(
          output.facts_analysis
        ),
        ...asArray(
          output.fact_significance
        ),
        ...asArray(
          output.factual_analysis
        ),
      ]
    ) {
      const fact =
        normalizeFact(
          raw,
          agentId
        );

      if (fact) {
        packets.push(fact);
      }
    }
  }

  const seen =
    new Set<string>();

  const unique =
    packets.filter(
      (packet) => {
        const key =
          packet.fact
            .toLowerCase();

        if (
          !key ||
          seen.has(key)
        ) {
          return false;
        }

        seen.add(key);
        return true;
      }
    );

  return {
    generated_at:
      new Date()
        .toISOString(),

    packet_count:
      unique.length,

    packets:
      unique,

    development_rules: [
      "Do not collapse multiple supported material facts into a two- or three-sentence chronology.",
      "Group related facts into professional factual paragraphs.",
      "After a material factual cluster, add one or more sentences explaining why those verified facts matter to the Court when that significance is supported by the record and legal framework.",
      "Do not invent hardship, emotional impact, medical effects, financial effects, family facts, community ties, detention conditions, criminal facts, supervision history, or procedural facts.",
      "Preserve source / source_agent / source_reference when supplied.",
      "If a factual significance point is not supported, omit it or flag attorney input needed."
    ]
  };
}

export function buildScribeStrictContract(
  draftType: string
) {
  return {
    version:
      "scribe_strict_v2",

    draft_type:
      draftType ||
      "habeas",

    statement_of_facts: {
      minimum_behavior: [
        "Develop supported facts into a substantive narrative, not a short chronology.",
        "For each material factual cluster, state the facts and then explain their supported legal/equitable significance.",
        "Use separate significance sentences or paragraphs when helpful.",
        "Preserve factual source references when available."
      ],

      required_internal_check: [
        "Did each major factual cluster receive adequate factual development?",
        "Did the draft explain why supported family, community, custody, liberty, procedural, or hardship facts matter to the Court?",
        "Did the draft avoid invented hardship or unsupported emotional rhetoric?"
      ]
    },

    authority_use: {
      mandatory: [
        "Build and consult the supplied authority_dictionary before writing final filing-ready case citations.",
        "Use full_citation for every authority when available.",
        "Do not output case-name-only citations as filing-ready when fuller metadata exists.",
        "If citation data is incomplete, mark the checklist CITATION INCOMPLETE instead of inventing missing fields.",
        "Every material legal proposition must be represented in draft.authority_checklist with source metadata when available."
      ]
    },

    source_chain: {
      mandatory: [
        "For every major argument, preserve the authority source and factual source used.",
        "Prefer Case Brain / prior specialist authority already verified for the active matter before introducing a new authority.",
        "Preserve source_agent and source_url so counsel can backtrack quickly."
      ]
    },

    final_preflight: [
      "Reject internally any draft section that cites a case only by name when a complete citation is available in authority_dictionary.",
      "Reject internally any major factual paragraph that cannot be traced to the active matter record.",
      "Reject internally any argument that relies on an authority not present in verified specialist research or identified Government-filed authority.",
      "Run a final pass specifically for Statement of Facts depth, complete citations, source traceability, and citator warnings."
    ]
  };
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = {
  draft: path.join(root, "app", "components", "DraftManagerWorkstation.tsx"),
  response: path.join(root, "app", "components", "GovernmentResponseWorkstation.tsx"),
  specialist: path.join(root, "app", "components", "SpecialistWorkstation.tsx"),
  agentRun: path.join(root, "app", "api", "agents", "run", "route.ts"),
  rebuttalRun: path.join(root, "app", "api", "rebuttal", "run", "route.ts"),
  authority: path.join(root, "app", "api", "legal-authorities", "research", "route.ts"),
};

for (const [label, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Immigration reasoning patch: ${label} file not found: ${file}`);
  }
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, value) {
  fs.writeFileSync(file, value, "utf8");
}

function replaceRequired(input, find, replacement, label) {
  if (!input.includes(find)) {
    throw new Error(`Immigration reasoning patch: anchor not found for ${label}`);
  }
  return input.replace(find, replacement);
}

const MARKER = "IMMIGRATION_REASONING_V2";

/*
|--------------------------------------------------------------------------
| DRAFT MANAGER — deeper Statement of Facts + full citations + source chain
|--------------------------------------------------------------------------
*/

let draft = read(files.draft);

if (!draft.includes(`${MARKER}_DRAFT`)) {
  draft = replaceRequired(
    draft,
`              "Draft substantive prose for each section using the supplied matter record and specialist analyses.",`,
`              "Draft substantive prose for each section using the supplied matter record and specialist analyses.",
              "${MARKER}_DRAFT",
              "STATEMENT OF FACTS: Do not reduce supported facts to a couple of conclusory sentences. Develop the record in professional pleading prose with enough detail for the Court to understand the person's detention, procedural posture, family/community ties, liberty interests, and other supported equities.",
              "STATEMENT OF FACTS: For each material factual cluster, first state the supported facts accurately, then explain in a separate sentence or short paragraph why those verified facts matter to the Court's analysis. Examples of significance may include family hardship, substantial U.S. ties, liberty interests, custody posture, dangerousness, flight risk, or equities, but only when the supplied record actually supports that significance.",
              "STATEMENT OF FACTS: Do not invent hardship or emotional impact. If the record says a detainee married a U.S. citizen and has U.S.-citizen children, the draft may explain that those verified relationships demonstrate substantial U.S. family ties and may create concrete family hardship from continued detention; it may not invent unsupported medical, financial, or psychological consequences.",
              "FACT PROVENANCE: Material factual paragraphs should remain traceable to Case Brain, a verified specialist output, attorney input, or an identified record source. Preserve source references when available.",
              "CASE BRAIN REUSE: Before selecting new authority, review authorities already present in Case Brain and prior verified specialist outputs. Reuse directly relevant verified sources when appropriate and identify their prior source.",
              "FULL CITATIONS: Never cite a case by case name alone when the supplied authority record contains reporter, docket, court, date, year, or other citation metadata. Preserve a copyable complete citation using only verified metadata.",
              "FULL CITATIONS: If the research does not supply enough metadata to construct a complete citation, mark it CITATION INCOMPLETE for attorney review rather than inventing reporter numbers, court information, dates, years, docket numbers, or pin cites.",
              "SOURCE CHAIN: Every major legal argument should be traceable to the authority source URL/provider and the specialist/Case Brain source that supplied it. Preserve proposition, relevance, binding status, source URL, source provider, and citator-review status in the authority checklist/output.",
              "QA: Flag any material proposition that cannot be traced to verified authority and any material fact that cannot be traced to the active matter record.",`,
    "DraftManager factual-development requirements"
  );
}

write(files.draft, draft);

/*
|--------------------------------------------------------------------------
| GOVERNMENT RESPONSE UI — opposition anchored reply requirements
|--------------------------------------------------------------------------
*/

let response = read(files.response);

if (!response.includes(`${MARKER}_REPLY`)) {
  response = replaceRequired(
    response,
`                "Analyze the government filing point by point before drafting.",`,
`                "Analyze the government filing point by point before drafting.",
                "${MARKER}_REPLY",
                "ANCHOR THE REPLY TO THE GOVERNMENT RESPONSE: Do not merely restate the Petition. Organize each material rebuttal around what the Government actually argued.",
                "For each material Government argument, identify: (1) the Government's contention, (2) the exact case/statute/authority it cited, (3) the proposition for which the Government relies on that authority, and (4) the filing location/page/section when available.",
                "Then analyze whether the Government's cited authority actually supports that proposition. Distinguish it factually, procedurally, jurisdictionally, or legally when the verified record supports a distinction.",
                "Apply Petitioner's verified facts to the rebuttal. Explain why the active matter differs from the Government authority instead of giving a generic statement that the case is distinguishable.",
                "Before adding new authority, search Case Brain and prior verified specialist outputs for relevant counter-authority already researched in this matter.",
                "Use the Government's cited authorities as anchor points for counterarguments: 'The Government relies on X for Y; X does not control here because ...' only when the verified authority and active facts support that analysis.",
                "Never cite only a case name when fuller citation metadata is available. Return a copyable complete citation and preserve source URL/provider, proposition, relevance, binding status, quote status, and citator status.",
                "If a full citation cannot be verified from supplied metadata, mark CITATION INCOMPLETE instead of fabricating the missing citation components.",
                "Preserve a source chain for each major rebuttal showing the Government argument/authority, Case Brain or specialist counter-source, authority URL/provider, and active factual source used.",`,
    "GovernmentResponse anchored-reply requirements"
  );
}

/*
| Add richer citation fields to the local UI type.
*/
response = response.replace(
`  citation?: string | null;
  court?: string | null;`,
`  citation?: string | null;
  full_citation?: string | null;
  fullCitation?: string | null;
  citation_complete?: boolean;
  court?: string | null;`
);

/*
| Show one copyable citation line rather than case name + orphan reporter metadata.
*/
response = replaceRequired(
  response,
`                              <h5>
                                {authority.title ||
                                  "Legal authority"}
                              </h5>

                              <div
                                className={
                                  styles.caseLawMeta
                                }
                              >
                                {authority.citation ? (
                                  <span>
                                    {
                                      authority.citation
                                    }
                                  </span>
                                ) : null}`,
`                              <h5>
                                {authority.title ||
                                  "Legal authority"}
                              </h5>

                              <div
                                className={
                                  styles.caseLawMeta
                                }
                              >
                                <span>
                                  {clean(
                                    authority.full_citation ||
                                    authority.fullCitation ||
                                    [
                                      authority.title,
                                      authority.citation
                                    ]
                                      .filter(Boolean)
                                      .join(", ")
                                  ) ||
                                    "CITATION INCOMPLETE"}
                                </span>`,
  "GovernmentResponse full citation display"
);

write(files.response, response);

/*
|--------------------------------------------------------------------------
| SPECIALIST UI — complete copyable citation in Elena/Lex cards
|--------------------------------------------------------------------------
*/

let specialist = read(files.specialist);

if (!specialist.includes(`${MARKER}_SPECIALIST`)) {
  specialist = specialist.replace(
`    citation?: string | null;
    court?: string | null;`,
`    citation?: string | null;
    full_citation?: string | null;
    fullCitation?: string | null;
    citation_complete?: boolean;
    court?: string | null;`
  );

  specialist = replaceRequired(
    specialist,
`                  <h4>{authority.title || "Legal authority"}</h4>

                  <div className="authority-meta">
                    {authority.citation && <span>{authority.citation}</span>}`,
`                  <h4>{authority.title || "Legal authority"}</h4>

                  <div className="authority-meta">
                    <span>
                      {String(
                        authority.full_citation ||
                        authority.fullCitation ||
                        [
                          authority.title,
                          authority.citation
                        ].filter(Boolean).join(", ") ||
                        "CITATION INCOMPLETE"
                      )}
                    </span>
                    <span style={{ display: "none" }}>${MARKER}_SPECIALIST</span>`,
    "Specialist complete citation display"
  );
}

write(files.specialist, specialist);

/*
|--------------------------------------------------------------------------
| AGENT RUN — send shared directives to Lex / Elena / Mateo / Atlas / QA / Avery
|--------------------------------------------------------------------------
*/

let agentRun = read(files.agentRun);

if (!agentRun.includes("IMMIGRATION_REASONING_DIRECTIVES")) {
  agentRun = replaceRequired(
    agentRun,
`import {
  retrieveFirmDraftingSources,
} from "../../../../lib/legal/firm-drafting-retrieval";`,
`import {
  retrieveFirmDraftingSources,
} from "../../../../lib/legal/firm-drafting-retrieval";

import {
  IMMIGRATION_REASONING_DIRECTIVES,
} from "../../../../lib/legal/immigration-reasoning-directives";`,
    "agents/run directives import"
  );
}

if (!agentRun.includes("immigration_reasoning_directives:")) {
  agentRun = replaceRequired(
    agentRun,
`    const inputPayload = {
      matter:
        storedMatter,

      request:
        draftingRequest,

      prior_specialists:`,
`    const inputPayload = {
      matter:
        storedMatter,

      request:
        draftingRequest,

      immigration_reasoning_directives:
        IMMIGRATION_REASONING_DIRECTIVES,

      prior_specialists:`,
    "agents/run shared directive payload"
  );
}

write(files.agentRun, agentRun);

/*
|--------------------------------------------------------------------------
| RHEA BACKEND — make reply directives first-class backend request data
|--------------------------------------------------------------------------
*/

let rebuttal = read(files.rebuttalRun);

if (!rebuttal.includes("GOVERNMENT_REPLY_REQUIREMENTS")) {
  rebuttal = replaceRequired(
    rebuttal,
`import {
  retrieveFirmDraftingSources,
} from "../../../../lib/legal/firm-drafting-retrieval";`,
`import {
  retrieveFirmDraftingSources,
} from "../../../../lib/legal/firm-drafting-retrieval";

import {
  GOVERNMENT_REPLY_REQUIREMENTS,
  IMMIGRATION_REASONING_DIRECTIVES,
} from "../../../../lib/legal/immigration-reasoning-directives";`,
    "rebuttal directives import"
  );
}

if (!rebuttal.includes("governmentReplyReasoningRequirements")) {
  rebuttal = replaceRequired(
    rebuttal,
`    firmDraftingSources,

    firmDraftingInstructions: [`,
`    firmDraftingSources,

    governmentReplyReasoningRequirements:
      GOVERNMENT_REPLY_REQUIREMENTS,

    immigrationReasoningDirectives:
      IMMIGRATION_REASONING_DIRECTIVES,

    governmentResponseAnchorPolicy: {
      required: true,
      sequence: [
        "government_contention",
        "government_authority_full_citation",
        "government_asserted_proposition",
        "authority_support_analysis",
        "factual_or_legal_distinction",
        "case_brain_counter_authority",
        "active_matter_fact_application",
        "drafted_counterargument"
      ],
      preserveGovernmentSourceLocation: true,
      requireCaseBrainReuseCheck: true,
      requireCompleteCitationWhenAvailable: true,
      prohibitInventedCitationComponents: true
    },

    firmDraftingInstructions: [`,
    "rebuttal backend reasoning requirements"
  );
}

write(files.rebuttalRun, rebuttal);

/*
|--------------------------------------------------------------------------
| AUTHORITY API — richer citation metadata, never name-only if metadata exists
|--------------------------------------------------------------------------
*/

let authority = read(files.authority);

if (!authority.includes("fullCitation?:")) {
  authority = replaceRequired(
    authority,
`  citation?: string | null;
  court?: string | null;`,
`  citation?: string | null;
  caseName?: string | null;
  fullCitation?: string | null;
  citationComplete?: boolean;
  citationComponents?: {
    caseName?: string | null;
    reporterCitation?: string | null;
    court?: string | null;
    date?: string | null;
    year?: string | null;
  };
  court?: string | null;`,
    "authority result citation fields"
  );
}

if (!authority.includes("function humanCourtLabel")) {
  authority = replaceRequired(
    authority,
`function truncate(value: string, max = 7000) {
  const clean = stripHtml(value);
  return clean.length > max ? \`\${clean.slice(0, max)}…\` : clean;
}`,
`function truncate(value: string, max = 7000) {
  const clean = stripHtml(value);
  return clean.length > max ? \`\${clean.slice(0, max)}…\` : clean;
}

function humanCourtLabel(value: unknown) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();

  const map: Record<string, string> = {
    scotus: "U.S.",
    ca11: "11th Cir.",
    ca5: "5th Cir.",
    ca4: "4th Cir.",
    ca3: "3d Cir.",
    ca2: "2d Cir.",
    ca1: "1st Cir.",
    ca6: "6th Cir.",
    ca7: "7th Cir.",
    ca8: "8th Cir.",
    ca9: "9th Cir.",
    ca10: "10th Cir.",
    cadc: "D.C. Cir.",
    flsd: "S.D. Fla.",
    flmd: "M.D. Fla.",
    flnd: "N.D. Fla."
  };

  return map[normalized] || raw;
}

function buildVerifiedCitationDisplay({
  caseName,
  reporterCitation,
  court,
  date
}: {
  caseName: string;
  reporterCitation?: string | null;
  court?: string | null;
  date?: string | null;
}) {
  const name = String(caseName || "").trim();
  const reporter = String(reporterCitation || "").trim();
  const courtLabel = humanCourtLabel(court);
  const yearMatch = String(date || "").match(/\\b(19|20)\\d{2}\\b/);
  const year = yearMatch?.[0] || "";

  if (!name || !reporter) {
    return {
      fullCitation:
        [name, reporter].filter(Boolean).join(", ") ||
        "CITATION INCOMPLETE",
      citationComplete: false,
      year
    };
  }

  let parenthetical = "";

  if (year) {
    const lowerReporter = reporter.toLowerCase();
    const isSupremeReporter =
      /\\b(u\\.s\\.|s\\.\\s*ct\\.|l\\.\\s*ed\\.)\\b/i.test(reporter);

    if (isSupremeReporter) {
      parenthetical = \` (\${year})\`;
    } else if (courtLabel) {
      parenthetical = \` (\${courtLabel} \${year})\`;
    } else {
      parenthetical = \` (\${year})\`;
    }
  }

  return {
    fullCitation:
      \`\${name}, \${reporter}\${parenthetical}\`,
    citationComplete:
      Boolean(name && reporter && year),
    year
  };
}`,
    "authority citation helper"
  );
}

if (!authority.includes("const citationDisplay =")) {
  authority = replaceRequired(
    authority,
`    const citations = Array.isArray(item?.citation)
      ? item.citation.join("; ")
      : Array.isArray(item?.citations)
      ? item.citations.join("; ")
      : item?.citation || item?.cite || null;`,
`    const citations = Array.isArray(item?.citation)
      ? item.citation.join("; ")
      : Array.isArray(item?.citations)
      ? item.citations.join("; ")
      : item?.citation || item?.cite || null;

    const filedDate =
      item?.dateFiled ||
      item?.date_filed ||
      item?.dateCreated ||
      null;

    const citationDisplay =
      buildVerifiedCitationDisplay({
        caseName:
          String(caseName),
        reporterCitation:
          citations
            ? String(citations)
            : null,
        court:
          item?.court
            ? String(item.court)
            : null,
        date:
          filedDate
            ? String(filedDate)
            : null
      });`,
    "authority citation display construction"
  );

  authority = replaceRequired(
    authority,
`      kind: "case",
      title: String(caseName),
      citation: citations ? String(citations) : null,
      court: item?.court ? String(item.court) : null,
      date: item?.dateFiled || item?.date_filed || item?.dateCreated || null,`,
`      kind: "case",
      title: String(caseName),
      caseName: String(caseName),
      citation: citations ? String(citations) : null,
      fullCitation:
        citationDisplay.fullCitation,
      citationComplete:
        citationDisplay.citationComplete,
      citationComponents: {
        caseName:
          String(caseName),
        reporterCitation:
          citations
            ? String(citations)
            : null,
        court:
          item?.court
            ? humanCourtLabel(
                item.court
              )
            : null,
        date:
          filedDate
            ? String(
                filedDate
              )
            : null,
        year:
          citationDisplay.year ||
          null
      },
      court: item?.court ? String(item.court) : null,
      date: filedDate,`,
    "authority result richer citation metadata"
  );
}

write(files.authority, authority);

console.log(
  "Applied Immigration habeas/bond factual-development, complete-citation, Case Brain source-reuse, and Government-reply anchor-point upgrades."
);

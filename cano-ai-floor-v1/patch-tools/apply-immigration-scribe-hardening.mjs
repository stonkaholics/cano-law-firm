import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const routePath =
  path.join(
    root,
    "app",
    "api",
    "agents",
    "run",
    "route.ts"
  );

const draftPath =
  path.join(
    root,
    "app",
    "components",
    "DraftManagerWorkstation.tsx"
  );

const cssPath =
  path.join(
    root,
    "app",
    "globals.css"
  );

for (
  const file of
  [
    routePath,
    draftPath,
    cssPath
  ]
) {
  if (
    !fs.existsSync(
      file
    )
  ) {
    throw new Error(
      "Scribe hardening patch: missing " +
      file
    );
  }
}

function replaceRequired(
  input,
  find,
  replacement,
  label
) {
  if (
    !input.includes(
      find
    )
  ) {
    throw new Error(
      "Scribe hardening patch: anchor not found for " +
      label
    );
  }

  return input.replace(
    find,
    replacement
  );
}

/*
|--------------------------------------------------------------------------
| SERVER-SIDE SCRIBE PREFLIGHT
|--------------------------------------------------------------------------
*/

let route =
  fs.readFileSync(
    routePath,
    "utf8"
  );

if (
  !route.includes(
    "buildScribeAuthorityDictionary"
  )
) {
  route =
    replaceRequired(
      route,
`import {
  retrieveFirmDraftingSources,
} from "../../../../lib/legal/firm-drafting-retrieval";`,
`import {
  retrieveFirmDraftingSources,
} from "../../../../lib/legal/firm-drafting-retrieval";

import {
  buildScribeAuthorityDictionary,
  buildScribeFactDevelopmentPackets,
  buildScribeStrictContract,
} from "../../../../lib/legal/scribe-drafting-intelligence";`,
      "Scribe helper import"
    );
}

if (
  !route.includes(
    "scribeAuthorityDictionary"
  )
) {
  route =
    replaceRequired(
      route,
`      draftingRequest = {
        ...options,`,
`      const scribeAuthorityDictionary =
        buildScribeAuthorityDictionary(
          priorAgents
        );

      const scribeFactDevelopmentPackets =
        buildScribeFactDevelopmentPackets(
          storedMatter,
          priorAgents
        );

      const scribeStrictContract =
        buildScribeStrictContract(
          draftType ||
          "habeas"
        );

      const existingDraftingRequirements =
        Array.isArray(
          (options as any)
            ?.draftingRequirements
        )
          ? (options as any)
              .draftingRequirements
          : [];

      draftingRequest = {
        ...options,

        scribeStrictContract,

        authorityDictionary:
          scribeAuthorityDictionary,

        factualDevelopmentPackets:
          scribeFactDevelopmentPackets,

        draftingRequirements: [
          ...existingDraftingRequirements,

          "SCRIBE STRICT PREFLIGHT: Before drafting, build the filing authority set from request.authorityDictionary and the factual narrative plan from request.factualDevelopmentPackets.",

          "STATEMENT OF FACTS DEPTH: Do not return a skeletal chronology. Develop each supported material factual cluster into professional pleading prose and add supported significance analysis explaining why the facts matter to the Court.",

          "FACT SIGNIFICANCE: When verified facts establish family ties, U.S.-citizen/LPR relatives, children, marriage, community ties, residence history, employment, compliance, detention history, medical issues, or other equities, explain their supported relevance to liberty, hardship, flight risk, dangerousness, equities, or the Court's detention analysis. Do not invent consequences not in the record.",

          "FULL CITATIONS: Before naming a case in filing-ready prose, look it up in request.authorityDictionary.authorities. Use full_citation when available.",

          "NO NAME-ONLY AUTHORITIES: Do not output a case-name-only citation as filing-ready when fuller verified metadata exists. If the authority dictionary says CITATION INCOMPLETE, preserve that warning in draft.authority_checklist rather than fabricating missing citation components.",

          "SOURCE TRACEABILITY: Every material legal proposition must map to draft.authority_checklist and preserve source_url/source_provider/source_agent when supplied.",

          "CASE BRAIN REUSE: Prefer directly relevant verified authorities already present in prior_specialists / authorityDictionary before introducing a different case.",

          "FINAL REJECTION CHECK: Internally revise the draft before returning it if (a) the Statement of Facts remains only a short chronology despite a richer record, (b) any filing-ready case is cited only by name when a full citation is available, or (c) a material proposition cannot be traced to a verified source."
        ],`,
      "Scribe server-side preflight"
    );
}

fs.writeFileSync(
  routePath,
  route,
  "utf8"
);

/*
|--------------------------------------------------------------------------
| DRAFT WORKSTATION — hard UI request + better authority/source display
|--------------------------------------------------------------------------
*/

let draft =
  fs.readFileSync(
    draftPath,
    "utf8"
  );

if (
  !draft.includes(
    "SCRIBE_STRICT_UI_V2"
  )
) {
  draft =
    replaceRequired(
      draft,
`            draftingRequirements: [
              "Return a complete attorney-editable pleading, not an outline.",
              "Draft substantive prose for each section using the supplied matter record and specialist analyses.",`,
`            draftingRequirements: [
              "SCRIBE_STRICT_UI_V2",
              "Return a complete attorney-editable pleading, not an outline.",
              "Draft substantive prose for each section using the supplied matter record and specialist analyses.",
              "STATEMENT OF FACTS: Do not reduce the factual record to only a few sentences when the supplied matter supports more detail.",
              "STATEMENT OF FACTS: For each material factual cluster, state the verified facts professionally and then explain in one or more supported sentences why those facts matter to the Court's analysis.",
              "STATEMENT OF FACTS: Develop family ties, children, marriage, community ties, residence, employment, custody history, procedural history, hardship, liberty interests, and equities only when actually supported by Case Brain or verified specialist outputs.",
              "STATEMENT OF FACTS: Do not invent hardship, emotional effects, medical effects, financial effects, family facts, detention conditions, or equities.",
              "CITATIONS: Use complete copyable case citations from verified specialist authority metadata whenever available.",
              "CITATIONS: Never output only the case name as filing-ready when reporter/docket/court/date/year information is available.",
              "CITATIONS: If complete citation metadata is unavailable, preserve CITATION INCOMPLETE in the authority checklist rather than inventing missing information.",
              "SOURCE CHAIN: Preserve source URL/provider and prior specialist/Case Brain source for every major authority and argument when supplied.",
              "CASE BRAIN REUSE: Review relevant authorities already present in Case Brain and prior verified specialist outputs before introducing new authority.",`,
      "DraftManager hard requirements"
    );

  draft =
    draft.replace(
`    return ["research", "habeas", "bond"].flatMap((agentId) =>`,
`    return ["research", "habeas", "bond", "synthesis", "qa"].flatMap((agentId) =>`
  );

  draft =
    replaceRequired(
      draft,
`        const citation = String(authority?.citation || "").toLowerCase();
        const title = String(authority?.title || "").toLowerCase();
        return (
          (citation && (needle.includes(citation) || citation.includes(needle))) ||
          (title && (needle.includes(title) || title.includes(needle)))
        );`,
`        const citation = String(authority?.citation || "").toLowerCase();
        const fullCitation = String(
          authority?.full_citation ||
          authority?.fullCitation ||
          ""
        ).toLowerCase();
        const title = String(
          authority?.case_name ||
          authority?.caseName ||
          authority?.title ||
          ""
        ).toLowerCase();

        return (
          (fullCitation &&
            (needle.includes(fullCitation) ||
              fullCitation.includes(needle))) ||
          (citation &&
            (needle.includes(citation) ||
              citation.includes(needle))) ||
          (title &&
            (needle.includes(title) ||
              title.includes(needle)))
        );`,
      "Draft authority source matching"
    );

  draft =
    replaceRequired(
      draft,
`                            <strong>{item.authority}</strong>
                            <span>
                              {String(item.status || "").replaceAll("_", " ")}
                            </span>
                            <p>{item.note}</p>

                            {source?.url ? (
                              <a
                                className="draft-authority-source-link"
                                href={source.url}`,
`                            <strong>
                              {item.full_citation ||
                                item.fullCitation ||
                                source?.full_citation ||
                                source?.fullCitation ||
                                item.authority ||
                                "CITATION INCOMPLETE"}
                            </strong>

                            <span>
                              {String(item.status || "").replaceAll("_", " ")}
                            </span>

                            <p>{item.note}</p>

                            {(item.proposition || source?.proposition) ? (
                              <p className="draft-authority-relevance">
                                <b>Proposition:</b>{" "}
                                {item.proposition || source?.proposition}
                              </p>
                            ) : null}

                            {(item.source_agent ||
                              source?.source_agent ||
                              source?.provider ||
                              source?.source_provider) ? (
                              <p className="draft-authority-trace">
                                <b>Source chain:</b>{" "}
                                {[
                                  item.source_agent ||
                                    source?.source_agent,
                                  source?.provider ||
                                    source?.source_provider,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}

                            {(item.source_url ||
                              source?.source_url ||
                              source?.url) ? (
                              <a
                                className="draft-authority-source-link"
                                href={
                                  item.source_url ||
                                  source?.source_url ||
                                  source?.url
                                }`,
      "Draft complete citation display"
    );

  /*
  | Add Facts Analysis + Source Chain panels immediately before Authority Checklist.
  */
  draft =
    replaceRequired(
      draft,
`                <details
                  className="draft-review-details draft-authority-details"
                  open
                >
                  <summary>
                    Authority Checklist ({draft.authority_checklist?.length || 0})
                  </summary>`,
`                {Array.isArray(output?.facts_analysis) &&
                output.facts_analysis.length ? (
                  <details
                    className="draft-review-details draft-source-chain-details"
                    open
                  >
                    <summary>
                      Fact Development ({output.facts_analysis.length})
                    </summary>

                    <div className="draft-source-chain-list">
                      {output.facts_analysis.map(
                        (item: any, index: number) => (
                          <div key={index}>
                            <strong>
                              {item.fact ||
                                item.detail ||
                                "Material fact"}
                            </strong>

                            {item.legal_significance ||
                            item.significance ? (
                              <p>
                                <b>Why it matters:</b>{" "}
                                {item.legal_significance ||
                                  item.significance}
                              </p>
                            ) : null}

                            {item.source ||
                            item.source_agent ||
                            item.source_reference ? (
                              <small>
                                Source:{" "}
                                {[
                                  item.source,
                                  item.source_agent,
                                  item.source_reference,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            ) : null}
                          </div>
                        )
                      )}
                    </div>
                  </details>
                ) : null}

                {Array.isArray(output?.source_chain) &&
                output.source_chain.length ? (
                  <details
                    className="draft-review-details draft-source-chain-details"
                  >
                    <summary>
                      Argument Source Chain ({output.source_chain.length})
                    </summary>

                    <div className="draft-source-chain-list">
                      {output.source_chain.map(
                        (item: any, index: number) => (
                          <div key={index}>
                            <strong>
                              {item.argument_heading ||
                                item.argument ||
                                item.proposition ||
                                `Source chain ${index + 1}`}
                            </strong>

                            <p>
                              {item.detail ||
                                item.note ||
                                item.relevance ||
                                ""}
                            </p>

                            <small>
                              {[
                                item.source_agent,
                                item.source_reference,
                                item.source_provider,
                                item.source_url,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </div>
                        )
                      )}
                    </div>
                  </details>
                ) : null}

                <details
                  className="draft-review-details draft-authority-details"
                  open
                >
                  <summary>
                    Authority Checklist ({draft.authority_checklist?.length || 0})
                  </summary>`,
      "Draft fact/source chain panels"
    );
}

fs.writeFileSync(
  draftPath,
  draft,
  "utf8"
);

/*
|--------------------------------------------------------------------------
| CSS
|--------------------------------------------------------------------------
*/

let css =
  fs.readFileSync(
    cssPath,
    "utf8"
  );

if (
  !css.includes(
    "SCRIBE HARDENING V2"
  )
) {
  css += `

/* =========================================================
   SCRIBE HARDENING V2
   ========================================================= */

.draft-authority-trace{
  color:#6f8e9a!important
}

.draft-authority-trace b{
  color:#a8c0c9
}

.draft-source-chain-list{
  display:grid;
  gap:8px;
  padding:12px
}

.draft-source-chain-list>div{
  padding:10px;
  border:1px solid rgba(173,194,206,.08);
  border-radius:8px;
  background:rgba(255,255,255,.008)
}

.draft-source-chain-list strong{
  display:block;
  color:#dbe6ea;
  font-size:9px;
  line-height:1.45
}

.draft-source-chain-list p{
  margin:6px 0 0;
  color:#8299a4;
  font-size:8px;
  line-height:1.55
}

.draft-source-chain-list p b{
  color:#c8a96e
}

.draft-source-chain-list small{
  display:block;
  margin-top:6px;
  color:#607f8b;
  font-size:7px;
  line-height:1.45;
  overflow-wrap:anywhere
}
`;
}

fs.writeFileSync(
  cssPath,
  css,
  "utf8"
);

console.log(
  "Applied Scribe strict factual-development, authority-dictionary, full-citation, and source-chain hardening."
);

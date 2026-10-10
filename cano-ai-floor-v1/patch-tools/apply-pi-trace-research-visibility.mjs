import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(
  process.cwd(),
  "app",
  "personal-injury",
  "page.tsx"
);

const cssPath = path.join(
  process.cwd(),
  "app",
  "personal-injury",
  "personal-injury.module.css"
);

if (!fs.existsSync(pagePath)) {
  throw new Error(
    "Trace research visibility patch: page.tsx not found."
  );
}

if (!fs.existsSync(cssPath)) {
  throw new Error(
    "Trace research visibility patch: CSS not found."
  );
}

let source =
  fs.readFileSync(
    pagePath,
    "utf8"
  );

let css =
  fs.readFileSync(
    cssPath,
    "utf8"
  );

const MARKER =
  "TRACE_RESEARCH_VISIBILITY_V1";

function replaceRequired(
  input,
  find,
  replacement,
  label
) {
  if (!input.includes(find)) {
    throw new Error(
      "Trace research visibility patch: anchor not found for " +
      label
    );
  }

  return input.replace(
    find,
    replacement
  );
}

if (
  !source.includes(
    `/* ${MARKER} */`
  )
) {
  /*
  |--------------------------------------------------------------------------
  | 1) Add Records research truth/progress derived values.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`  const selectedReport =
    selectedTask?.result
      ?.official_report ||
    {};

  const selectedParties =`,
`  const selectedReport =
    selectedTask?.result
      ?.official_report ||
    {};

  /* ${MARKER} */
  const selectedResearchContext =
    selectedTask
      ?.research_context ||
    {};

  const selectedTaskResult =
    selectedTask?.result ||
    {};

  const selectedAgencyOutcome =
    selectedTaskResult
      .agency_resolution_outcome ||
    selectedResearchContext
      .agency_resolution_outcome ||
    {};

  const selectedAgencyVerified =
    selectedResearchContext
      .investigating_agency_verified ===
      true ||
    selectedAgencyOutcome
      .agency_verified ===
      true ||
    selectedReport.verified ===
      true;

  const selectedVerifiedAgency =
    selectedAgencyVerified
      ? String(
          selectedReport
            .investigating_agency ||
          selectedResearchContext
            .investigating_agency ||
          selectedTask
            ?.fingerprint
            ?.agency ||
          selectedIntel
            ?.investigating_agency ||
          ""
        )
      : "";

  const selectedBestAgencyCandidate =
    String(
      selectedResearchContext
        .best_agency_candidate ||
      selectedAgencyOutcome
        .best_candidate ||
      (
        !selectedAgencyVerified
          ? selectedTask
              ?.fingerprint
              ?.agency ||
            ""
          : ""
      )
    );

  const selectedCandidateConfidence =
    Number(
      selectedResearchContext
        .best_agency_candidate_confidence ||
      selectedAgencyOutcome
        .candidate_confidence ||
      selectedAgencyOutcome
        .best_candidate_confidence ||
      0
    );

  const selectedResolutionState =
    String(
      selectedAgencyOutcome
        .resolution_state ||
      (
        selectedAgencyVerified
          ? "verified"
          : selectedTask?.status ===
            "needs_agency_resolution"
          ? "unresolved"
          : "pending"
      )
    );

  const selectedOfficialEvidenceCount =
    Number(
      selectedAgencyOutcome
        .official_evidence_count ||
      selectedAgencyOutcome
        .evidence_summary
        ?.official_evidence_count ||
      0
    );

  const selectedTotalEvidenceCount =
    Number(
      selectedAgencyOutcome
        .total_unique_evidence ||
      selectedAgencyOutcome
        .evidence_summary
        ?.total_unique_evidence ||
      (
        Array.isArray(
          selectedAgencyOutcome
            .evidence
        )
          ? selectedAgencyOutcome
              .evidence
              .length
          : 0
      )
    );

  const selectedCandidateSummary =
    Array.isArray(
      selectedAgencyOutcome
        .all_unresolved_candidates
    )
      ? selectedAgencyOutcome
          .all_unresolved_candidates
      : Array.isArray(
          selectedAgencyOutcome
            .candidate_summary
        )
      ? selectedAgencyOutcome
          .candidate_summary
      : [];

  const selectedDiscoverySource =
    String(
      selectedResearchContext
        .discovery_source ||
      selectedResearchContext
        .discovery_source_url ||
      selectedTask?.portal
        ?.verified_event_source ||
      selectedIncident?.source ||
      selectedIncident?.source_url ||
      ""
    );

  const selectedResearchStatus =
    String(
      selectedIntel
        ?.research_status ||
      selectedTask?.status ||
      "pending"
    );

  const selectedParties =`,
    "Trace research derived values"
  );

  /*
  |--------------------------------------------------------------------------
  | 2) Truth-state fix: do not show candidate as verified agency.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`                <div>
                  <span>AGENCY</span>
                  <strong>
                    {String(
                      selectedReport
                        .investigating_agency ||
                      selectedTask
                        ?.fingerprint
                        ?.agency ||
                      "Not verified"
                    )}
                  </strong>
                  <small>
                    records provenance
                  </small>
                </div>`,
`                <div>
                  <span>INVESTIGATING AGENCY</span>
                  <strong>
                    {selectedAgencyVerified
                      ? selectedVerifiedAgency ||
                        "Verified agency unavailable"
                      : "Not Verified"}
                  </strong>
                  <small>
                    {selectedAgencyVerified
                      ? "officially verified"
                      : selectedBestAgencyCandidate
                      ? "Candidate only: " +
                        selectedBestAgencyCandidate
                      : "agency resolution pending"}
                  </small>
                </div>`,
    "Trace agency truth card"
  );

  /*
  |--------------------------------------------------------------------------
  | 3) Insert visible Records research progress before people section.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`              <section className={styles.traceWsPeoplePanel}>`,
`              <section className={styles.traceWsResearchPanel}>
                <div className={styles.traceWsPanelHead}>
                  <div>
                    <span>RECORDS RESEARCH PROGRESS</span>
                    <strong>
                      What happened before Trace could resolve identity
                    </strong>
                  </div>

                  <em
                    className={
                      selectedAgencyVerified
                        ? styles.traceWsResearchVerified
                        : selectedResolutionState ===
                          "no_evidence"
                        ? styles.traceWsResearchNoEvidence
                        : styles.traceWsResearchPending
                    }
                  >
                    {selectedAgencyVerified
                      ? "AGENCY VERIFIED"
                      : selectedResolutionState ===
                        "no_evidence"
                      ? "NO VERIFYING EVIDENCE"
                      : "AGENCY UNRESOLVED"}
                  </em>
                </div>

                <div className={styles.traceWsResearchGrid}>
                  <div>
                    <span>TASK STATUS</span>
                    <strong>
                      {String(
                        selectedTask?.status ||
                        "No task"
                      ).replace(
                        /_/g,
                        " "
                      )}
                    </strong>
                    <small>
                      report research state
                    </small>
                  </div>

                  <div>
                    <span>AGENCY RESOLUTION</span>
                    <strong>
                      {selectedResolutionState.replace(
                        /_/g,
                        " "
                      )}
                    </strong>
                    <small>
                      verification result
                    </small>
                  </div>

                  <div>
                    <span>BEST CANDIDATE</span>
                    <strong>
                      {selectedAgencyVerified
                        ? selectedVerifiedAgency ||
                          "Verified"
                        : selectedBestAgencyCandidate ||
                          "None"}
                    </strong>
                    <small>
                      {selectedAgencyVerified
                        ? "verified agency"
                        : "candidate only"}
                    </small>
                  </div>

                  <div>
                    <span>CANDIDATE CONFIDENCE</span>
                    <strong>
                      {selectedCandidateConfidence > 0
                        ? String(
                            Math.round(
                              selectedCandidateConfidence *
                                100
                            )
                          ) + "%"
                        : "—"}
                    </strong>
                    <small>
                      not identity confidence
                    </small>
                  </div>

                  <div>
                    <span>OFFICIAL EVIDENCE</span>
                    <strong>
                      {selectedOfficialEvidenceCount}
                    </strong>
                    <small>
                      verifying source matches
                    </small>
                  </div>

                  <div>
                    <span>TOTAL EVIDENCE</span>
                    <strong>
                      {selectedTotalEvidenceCount}
                    </strong>
                    <small>
                      research evidence items
                    </small>
                  </div>

                  <div>
                    <span>RESEARCH STATUS</span>
                    <strong>
                      {selectedResearchStatus.replace(
                        /_/g,
                        " "
                      )}
                    </strong>
                    <small>
                      intelligence state
                    </small>
                  </div>

                  <div>
                    <span>NEXT RECORDS ACTION</span>
                    <strong>
                      {String(
                        selectedTask
                          ?.next_action ||
                        selectedTaskResult
                          .next_action ||
                        "review"
                      ).replace(
                        /_/g,
                        " "
                      )}
                    </strong>
                    <small>
                      current workflow handoff
                    </small>
                  </div>
                </div>

                <div className={styles.traceWsResearchFoot}>
                  <span>
                    Discovery source
                  </span>
                  <code>
                    {selectedDiscoverySource ||
                      "Not recorded"}
                  </code>
                </div>

                {!selectedAgencyVerified &&
                selectedCandidateSummary.length ? (
                  <div className={styles.traceWsCandidateList}>
                    {selectedCandidateSummary
                      .slice(
                        0,
                        6
                      )
                      .map(
                        (
                          candidate: any,
                          index: number
                        ) => (
                          <div
                            key={
                              String(index) +
                              "-" +
                              String(
                                candidate
                                  ?.agency ||
                                candidate
                                  ?.name ||
                                "candidate"
                              )
                            }
                          >
                            <strong>
                              {String(
                                candidate
                                  ?.agency ||
                                candidate
                                  ?.name ||
                                "Agency candidate"
                              )}
                            </strong>

                            <span>
                              {Number(
                                candidate
                                  ?.confidence ||
                                candidate
                                  ?.candidate_confidence ||
                                0
                              ) > 0
                                ? String(
                                    Math.round(
                                      Number(
                                        candidate
                                          ?.confidence ||
                                        candidate
                                          ?.candidate_confidence ||
                                        0
                                      ) *
                                        100
                                    )
                                  ) + "%"
                                : "unscored"}
                            </span>
                          </div>
                        )
                      )}
                  </div>
                ) : null}
              </section>

              <section className={styles.traceWsPeoplePanel}>`,
    "Trace Records research progress panel"
  );

  /*
  |--------------------------------------------------------------------------
  | 4) Official-report source should also show research task provider/status
  | when report is not yet verified.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`                    <div>
                      <dt>Source URL</dt>
                      <dd>
                        {String(
                          selectedReport
                            .source_url ||
                          "Not recorded"
                        )}
                      </dd>
                    </div>`,
`                    <div>
                      <dt>Source URL</dt>
                      <dd>
                        {String(
                          selectedReport
                            .source_url ||
                          selectedTask
                            ?.portal
                            ?.verified_event_source ||
                          selectedDiscoverySource ||
                          "Not recorded"
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Records provider</dt>
                      <dd>
                        {String(
                          selectedTask
                            ?.provider ||
                          "Not assigned"
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Resolution</dt>
                      <dd>
                        {selectedAgencyVerified
                          ? "Agency verified"
                          : selectedResolutionState.replace(
                              /_/g,
                              " "
                            )}
                      </dd>
                    </div>`,
    "Trace official source expansion"
  );
}

/*
|--------------------------------------------------------------------------
| CSS
|--------------------------------------------------------------------------
*/

if (
  !css.includes(
    "TRACE RESEARCH VISIBILITY V1"
  )
) {
  css += `

/* =========================================================
   TRACE RESEARCH VISIBILITY V1
   ========================================================= */

.traceWsResearchPanel{
  margin-top:9px;
  padding:9px;
  border:1px solid rgba(110,154,179,.1);
  border-radius:8px;
  background:
    radial-gradient(circle at 0 0,rgba(226,187,103,.035),transparent 35%),
    rgba(7,22,31,.36)
}

.traceWsResearchPanel .traceWsPanelHead{
  align-items:center
}

.traceWsResearchPanel .traceWsPanelHead>em{
  flex:0 0 auto;
  padding:4px 7px;
  border-radius:999px;
  font-size:5.4px;
  font-style:normal;
  font-weight:900;
  letter-spacing:.05em
}

.traceWsResearchVerified{
  color:#83deb5;
  border:1px solid rgba(95,211,166,.18);
  background:rgba(95,211,166,.04)
}

.traceWsResearchPending{
  color:#dfbd74;
  border:1px solid rgba(226,187,103,.18);
  background:rgba(226,187,103,.04)
}

.traceWsResearchNoEvidence{
  color:#d9968f;
  border:1px solid rgba(214,119,112,.19);
  background:rgba(214,119,112,.04)
}

.traceWsResearchGrid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:6px
}

.traceWsResearchGrid>div{
  min-width:0;
  padding:7px 8px;
  border:1px solid rgba(110,154,179,.075);
  border-radius:7px;
  background:rgba(255,255,255,.006)
}

.traceWsResearchGrid span{
  display:block;
  color:#627f8c;
  font-size:5.3px;
  font-weight:900;
  letter-spacing:.065em
}

.traceWsResearchGrid strong{
  display:block;
  margin-top:4px;
  overflow:hidden;
  color:#bdcfd6;
  font-size:7px;
  text-overflow:ellipsis;
  white-space:nowrap;
  text-transform:capitalize
}

.traceWsResearchGrid small{
  display:block;
  margin-top:3px;
  color:#506b76;
  font-size:5.4px
}

.traceWsResearchFoot{
  display:flex;
  gap:6px;
  align-items:center;
  margin-top:7px;
  padding-top:7px;
  border-top:1px solid rgba(110,154,179,.065);
  color:#5e7e8a;
  font-size:5.5px
}

.traceWsResearchFoot code{
  min-width:0;
  overflow:hidden;
  color:#82a4b0;
  font-family:inherit;
  text-overflow:ellipsis;
  white-space:nowrap
}

.traceWsCandidateList{
  display:flex;
  gap:5px;
  flex-wrap:wrap;
  margin-top:7px
}

.traceWsCandidateList>div{
  display:inline-flex;
  align-items:center;
  gap:5px;
  padding:5px 7px;
  border:1px solid rgba(226,187,103,.12);
  border-radius:999px;
  background:rgba(226,187,103,.025)
}

.traceWsCandidateList strong{
  color:#aebfc4;
  font-size:5.7px;
  font-weight:800
}

.traceWsCandidateList span{
  color:#d3ad63;
  font-size:5.4px;
  font-weight:900
}

@media(max-width:1050px){
  .traceWsResearchGrid{
    grid-template-columns:repeat(2,minmax(0,1fr))
  }
}

@media(max-width:520px){
  .traceWsResearchGrid{
    grid-template-columns:1fr
  }
}
`;
}

fs.writeFileSync(
  pagePath,
  source,
  "utf8"
);

fs.writeFileSync(
  cssPath,
  css,
  "utf8"
);

console.log(
  "Applied Trace research visibility + agency truth-state patch."
);

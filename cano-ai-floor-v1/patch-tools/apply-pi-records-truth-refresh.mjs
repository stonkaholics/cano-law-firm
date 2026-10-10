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
    `Records truth/refresh patch: page.tsx not found: ${pagePath}`
  );
}

if (!fs.existsSync(cssPath)) {
  throw new Error(
    `Records truth/refresh patch: CSS not found: ${cssPath}`
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
  "RECORDS_TRUTH_AUTOREFRESH_V1";

function replaceRequired(
  input,
  find,
  replacement,
  label
) {
  if (!input.includes(find)) {
    throw new Error(
      `Records truth/refresh patch: anchor not found for ${label}`
    );
  }

  return input.replace(
    find,
    replacement
  );
}

if (!source.includes(`/* ${MARKER} */`)) {
  /*
  |--------------------------------------------------------------------------
  | 1) Preserve last non-empty Records task list and auto-refresh.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  const sortedTasks = useMemo(() => {
    const copy = [...(reportResearchTasks || [])];
    copy.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    return copy;
  }, [reportResearchTasks]);`,
`  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  /* ${MARKER} */
  const [stableTasks, setStableTasks] =
    useState<ReportResearchTask[]>(
      reportResearchTasks || []
    );

  useEffect(() => {
    if (
      Array.isArray(
        reportResearchTasks
      ) &&
      reportResearchTasks.length > 0
    ) {
      setStableTasks(
        reportResearchTasks
      );
    }
  }, [reportResearchTasks]);

  useEffect(() => {
    onRefresh();

    const timer =
      window.setInterval(
        () => {
          onRefresh();
        },
        6000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [onRefresh]);

  const sortedTasks = useMemo(() => {
    const copy = [...stableTasks];
    copy.sort(
      (a, b) =>
        new Date(
          b.updated_at ||
          b.created_at ||
          0
        ).getTime() -
        new Date(
          a.updated_at ||
          a.created_at ||
          0
        ).getTime()
    );
    return copy;
  }, [stableTasks]);`,
    "stable Records queue + auto refresh"
  );

  /*
  |--------------------------------------------------------------------------
  | 2) Make agency truth state explicit.
  | Candidate agency must never render as verified investigating agency.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`  const agency = String(
    officialReport.investigating_agency ||
    fingerprint.agency ||
    researchContext.investigating_agency ||
    selectedIntel?.investigating_agency ||
    ""
  );

  const bestCandidate = String(
    researchContext.best_agency_candidate ||
    resolutionOutcome.best_candidate ||
    ""
  );

  const agencyVerified =
    researchContext.investigating_agency_verified === true ||
    officialReport.verified === true;`,
`  const agencyVerified =
    researchContext.investigating_agency_verified === true ||
    officialReport.verified === true;

  const agency = String(
    agencyVerified
      ? (
          officialReport.investigating_agency ||
          researchContext.investigating_agency ||
          fingerprint.agency ||
          selectedIntel?.investigating_agency ||
          ""
        )
      : ""
  );

  const bestCandidate = String(
    researchContext.best_agency_candidate ||
    resolutionOutcome.best_candidate ||
    (
      !agencyVerified
        ? (
            fingerprint.agency ||
            selectedIntel?.investigating_agency ||
            ""
          )
        : ""
    )
  );`,
    "agency truth state"
  );

  /*
  |--------------------------------------------------------------------------
  | 3) Top command strip: show auto-refresh state.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`          <div className={styles.recordsWsSafetyBadge}>
            <ShieldCheck size={13} />
            SOURCE-GATED
          </div>
          <button type="button" onClick={onRefresh}>`,
`          <div className={styles.recordsWsSafetyBadge}>
            <ShieldCheck size={13} />
            SOURCE-GATED
          </div>
          <div className={styles.recordsWsAutoRefresh}>
            <Activity size={12} />
            AUTO · 6 SEC
          </div>
          <button type="button" onClick={onRefresh}>`,
    "auto refresh indicator"
  );

  /*
  |--------------------------------------------------------------------------
  | 4) Investigating agency card: unknown stays unknown.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`                  <span>INVESTIGATING AGENCY</span>
                  <strong>{agency || "Not verified"}</strong>
                  <small>{agencyVerified ? "officially verified" : bestCandidate ? "Best candidate: " + bestCandidate : "resolution pending"}</small>`,
`                  <span>INVESTIGATING AGENCY</span>
                  <strong>
                    {agencyVerified
                      ? agency || "Verified agency unavailable"
                      : "Not Verified"}
                  </strong>
                  <small>
                    {agencyVerified
                      ? "officially verified"
                      : bestCandidate
                      ? "Candidate only: " + bestCandidate
                      : "resolution pending"}
                  </small>`,
    "investigating agency display"
  );

  /*
  |--------------------------------------------------------------------------
  | 5) Next action must reflect unresolved agency blocker.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`                  <span>NEXT ACTION</span>
                  <strong>{String(selectedTask.next_action || "review").replace(/_/g, " ")}</strong>
                  <small>workflow state</small>`,
`                  <span>NEXT ACTION</span>
                  <strong>
                    {String(
                      !agencyVerified &&
                      selectedTask.status ===
                        "needs_agency_resolution"
                        ? "continue_agency_resolution"
                        : selectedTask.next_action ||
                          "review"
                    ).replace(
                      /_/g,
                      " "
                    )}
                  </strong>
                  <small>
                    {!agencyVerified &&
                    selectedTask.status ===
                      "needs_agency_resolution"
                      ? "agency verification blocks report lookup"
                      : "workflow state"}
                  </small>`,
    "next action truth state"
  );

  /*
  |--------------------------------------------------------------------------
  | 6) Agency Resolution panel: never use candidate as verified agency fallback.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`                    <div><dt>Best candidate</dt><dd>{bestCandidate || agency || "None"}</dd></div>`,
`                    <div>
                      <dt>Best candidate</dt>
                      <dd>
                        {agencyVerified
                          ? "Resolved"
                          : bestCandidate ||
                            "None"}
                      </dd>
                    </div>`,
    "agency candidate panel"
  );

  /*
  |--------------------------------------------------------------------------
  | 7) Portal / operator handoff: block visually until agency is verified.
  |--------------------------------------------------------------------------
  */

  source = replaceRequired(
    source,
`                  <strong>{String(result.handoff_status || result.lookup_status || selectedTask.status || "not required").replace(/_/g, " ")}</strong>`,
`                  <strong>
                    {String(
                      !agencyVerified &&
                      selectedTask.status ===
                        "needs_agency_resolution"
                        ? "blocked_agency_resolution_required"
                        : result.handoff_status ||
                          result.lookup_status ||
                          selectedTask.status ||
                          "not required"
                    ).replace(
                      /_/g,
                      " "
                    )}
                  </strong>`,
    "portal handoff header"
  );

  source = replaceRequired(
    source,
`                <div className={styles.recordsWsOperatorMeta}>
                  <span>Mode:<b>{String(result.execution_mode || result.access_preference || "—").replace(/_/g, " ")}</b></span>
                  <span>Operation:<b>{String(result.operation || portalHandoff.operation || "—").replace(/_/g, " ")}</b></span>
                </div>

                {operatorInstructions.length ? (
                  <ol>
                    {operatorInstructions.slice(0, 8).map((instruction: string, index: number) => (
                      <li key={String(index) + "-" + String(instruction)}>{String(instruction)}</li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.recordsWsMuted}>No operator handoff is currently queued for this task.</p>
                )}`,
`                {!agencyVerified &&
                selectedTask.status ===
                  "needs_agency_resolution" ? (
                  <div className={styles.recordsWsBlockedNotice}>
                    <ShieldCheck size={14} />
                    <div>
                      <strong>
                        Agency resolution required before portal execution
                      </strong>
                      <p>
                        {bestCandidate
                          ? bestCandidate +
                            " remains a candidate only. Records will not promote it to the investigating agency until event-specific official evidence verifies it."
                          : "The investigating agency is still unknown. Records will not start report lookup until an official source verifies the agency."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.recordsWsOperatorMeta}>
                      <span>
                        Mode:
                        <b>
                          {String(
                            result.execution_mode ||
                            result.access_preference ||
                            "—"
                          ).replace(
                            /_/g,
                            " "
                          )}
                        </b>
                      </span>
                      <span>
                        Operation:
                        <b>
                          {String(
                            result.operation ||
                            portalHandoff.operation ||
                            "—"
                          ).replace(
                            /_/g,
                            " "
                          )}
                        </b>
                      </span>
                    </div>

                    {operatorInstructions.length ? (
                      <ol>
                        {operatorInstructions
                          .slice(
                            0,
                            8
                          )
                          .map(
                            (
                              instruction: string,
                              index: number
                            ) => (
                              <li
                                key={
                                  String(
                                    index
                                  ) +
                                  "-" +
                                  String(
                                    instruction
                                  )
                                }
                              >
                                {String(
                                  instruction
                                )}
                              </li>
                            )
                          )}
                      </ol>
                    ) : (
                      <p className={styles.recordsWsMuted}>
                        No operator handoff is currently queued for this task.
                      </p>
                    )}
                  </>
                )}`,
    "portal blocked state"
  );
}

/*
|--------------------------------------------------------------------------
| CSS additions.
|--------------------------------------------------------------------------
*/

if (
  !css.includes(
    "RECORDS TRUTH AUTOREFRESH V1"
  )
) {
  css += `

/* =========================================================
   RECORDS TRUTH AUTOREFRESH V1
   ========================================================= */

.recordsWsAutoRefresh {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border: 1px solid rgba(111,184,244,.16);
  border-radius: 999px;
  background: rgba(111,184,244,.035);
  color: #7fb9d9;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: .065em;
}

.recordsWsBlockedNotice {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px;
  border: 1px solid rgba(226,187,103,.2);
  border-radius: 8px;
  background:
    linear-gradient(
      90deg,
      rgba(226,187,103,.055),
      rgba(226,187,103,.015)
    );
}

.recordsWsBlockedNotice > svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #ddb96d;
}

.recordsWsBlockedNotice strong {
  display: block;
  color: #dec17d;
  font-size: 7px;
  font-weight: 900;
}

.recordsWsBlockedNotice p {
  margin: 4px 0 0;
  color: #7e8f93;
  font-size: 6.5px;
  line-height: 1.5;
}

@media(max-width:760px) {
  .recordsWsAutoRefresh {
    align-self: flex-start;
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
  "Applied Records truth-state + stable queue auto-refresh patch."
);

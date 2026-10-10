import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "app", "personal-injury", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "personal-injury", "personal-injury.module.css");

if (!fs.existsSync(pagePath)) throw new Error(`Records workstation patch: page.tsx not found: ${pagePath}`);
if (!fs.existsSync(cssPath)) throw new Error(`Records workstation patch: CSS not found: ${cssPath}`);

let source = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const MARKER = "RECORDS_WORKSTATION_V1";

function replaceRequired(input, find, replacement, label) {
  if (!input.includes(find)) throw new Error(`Records workstation patch: anchor not found for ${label}`);
  return input.replace(find, replacement);
}

if (!source.includes("type ReportResearchTask =")) {
  source = replaceRequired(
    source,
    "type WorkspacePayload = {",
`type ReportResearchTask = {
  id: string;
  incident_id: string;
  intelligence_id?: string | null;
  agent_id?: string;
  task_type?: string;
  provider?: string;
  status: string;
  priority?: string;
  identifiers?: Record<string, any>;
  fingerprint?: Record<string, any>;
  portal?: Record<string, any>;
  requested_fields?: string[];
  verification_rules?: Record<string, any>;
  research_context?: Record<string, any>;
  result?: Record<string, any>;
  next_action?: string;
  created_at?: string;
  updated_at?: string;
};

type WorkspacePayload = {`,
    "ReportResearchTask type"
  );
}

if (!source.includes("reportResearchTasks: ReportResearchTask[];")) {
  source = replaceRequired(
    source,
    "  incidentSources: IncidentSource[];\n  apolloBudget: ApolloBudget;",
    "  incidentSources: IncidentSource[];\n  reportResearchTasks?: ReportResearchTask[];\n  apolloBudget: ApolloBudget;",
    "WorkspacePayload reportResearchTasks"
  );
}

if (!source.includes("    reportResearchTasks: [],")) {
  source = replaceRequired(
    source,
    "    incidentSources: [],\n    apolloBudget:",
    "    incidentSources: [],\n    reportResearchTasks: [],\n    apolloBudget:",
    "workspace initial reportResearchTasks"
  );
}

if (!source.includes("reportResearchTasks: Array.isArray(data.reportResearchTasks)")) {
  const pattern = `        incidentSources: Array.isArray(data.incidentSources)
          ? data.incidentSources
          : [],
        apolloBudget:`;
  const replacement = `        incidentSources: Array.isArray(data.incidentSources)
          ? data.incidentSources
          : [],
        reportResearchTasks: Array.isArray(data.reportResearchTasks)
          ? data.reportResearchTasks
          : [],
        apolloBudget:`;
  if (!source.includes(pattern)) throw new Error("Records workstation patch: incidentSources load anchor not found");
  source = source.replace(pattern, replacement);
  if (source.includes(pattern)) source = source.replace(pattern, replacement);
}

if (!source.includes("workspace.reportResearchTasks.length > 0")) {
  source = replaceRequired(
    source,
    "    workspace.incidentPeople.length > 0;",
    "    workspace.incidentPeople.length > 0 ||\n    (workspace.reportResearchTasks?.length || 0) > 0;",
    "realDataExists report tasks"
  );
}

if (!source.includes("<RecordsWorkstation")) {
  const postSafeAnchor =
`              ) : selectedAgent.id === "medintel" ? (
                <MedIntelWorkstation />
              ) : ["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id) ? (`;

  const rawAnchor =
`              ) : selectedAgent.id === "medintel" ? (
                <MedIntelWorkstation />
              ) : ["pulse", "intake"].includes(selectedAgent.id) ? (`;

  const rendered =
`              ) : selectedAgent.id === "medintel" ? (
                <MedIntelWorkstation />
              ) : selectedAgent.id === "records" ? (
                <RecordsWorkstation
                  reportResearchTasks={workspace.reportResearchTasks || []}
                  incidents={workspace.incidents}
                  incidentIntelligence={workspace.incidentIntelligence}
                  runningAgent={runningAgent}
                  agentMessage={agentMessage}
                  onRunRecords={(incidentId, taskId) =>
                    runPiAgent("records", {
                      incidentId,
                      taskId,
                      mode: "records_official_lookup",
                      requestedFrom: "records_expanded_workstation",
                    })
                  }
                  onRefresh={() => void loadWorkspace()}
                />
              ) : ["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id) ? (`;

  if (source.includes(postSafeAnchor)) {
    source = source.replace(postSafeAnchor, rendered);
  } else if (source.includes(rawAnchor)) {
    source = source.replace(rawAnchor, rendered.replace(
      `["pulse", "records", "trace", "sentinel", "intake"]`,
      `["pulse", "intake"]`
    ));
  } else {
    throw new Error("Records workstation patch: selected-agent anchor not found");
  }
}

source = source.replace(
  `selectedAgent.id === "medintel" ||
                    selectedAgent.runnable === false`,
  `["medintel", "records"].includes(selectedAgent.id) ||
                    selectedAgent.runnable === false`
);

source = source.replace(
  `selectedAgent.id === "medintel" || selectedAgent.runnable === false
                      ? undefined`,
  `["medintel", "records"].includes(selectedAgent.id) || selectedAgent.runnable === false
                      ? undefined`
);

source = source.replace(
  `{selectedAgent.id === "medintel"
                    ? "Use Medical Intake Below"`,
  `{selectedAgent.id === "medintel"
                    ? "Use Medical Intake Below"
                    : selectedAgent.id === "records"
                    ? "Use Records Queue Below"`
);

if (!source.includes(`/* ${MARKER} */`)) {
  const anchor = "function MedIntelWorkstation() {";
  const component = `/* ${MARKER} */
function RecordsWorkstation({
  reportResearchTasks,
  incidents,
  incidentIntelligence,
  runningAgent,
  agentMessage,
  onRunRecords,
  onRefresh,
}: {
  reportResearchTasks?: ReportResearchTask[];
  incidents: IncidentWatch[];
  incidentIntelligence: IncidentIntelligence[];
  runningAgent: string | null;
  agentMessage: string;
  onRunRecords: (incidentId: string, taskId?: string) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "verified" | "operator" | "blocked" | "review">("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  const sortedTasks = useMemo(() => {
    const copy = [...(reportResearchTasks || [])];
    copy.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    return copy;
  }, [reportResearchTasks]);

  const taskBucket = (task: ReportResearchTask) => {
    const status = String(task.status || "").toLowerCase();
    const recordsStatus = String(task.result?.records_status || task.research_context?.records_status || "").toLowerCase();

    if (status === "official_report_found" || recordsStatus === "verified") return "verified";
    if (status.includes("awaiting_operator") || status.includes("awaiting_manual") || status === "portal_lookup_ready") return "operator";
    if (status === "needs_agency_resolution") return "blocked";
    if (status.includes("conflict") || recordsStatus === "conflict" || recordsStatus === "insufficient") return "review";
    return "all";
  };

  const filteredTasks = sortedTasks.filter((task) => filter === "all" || taskBucket(task) === filter);
  const selectedTask =
    sortedTasks.find((task) => task.id === selectedTaskId) ||
    filteredTasks[0] ||
    sortedTasks[0] ||
    null;

  useEffect(() => {
    if (selectedTask && selectedTask.id !== selectedTaskId) setSelectedTaskId(selectedTask.id);
  }, [selectedTask?.id, selectedTaskId]);

  const verifiedCount = sortedTasks.filter((task) => taskBucket(task) === "verified").length;
  const operatorCount = sortedTasks.filter((task) => taskBucket(task) === "operator").length;
  const blockedCount = sortedTasks.filter((task) => taskBucket(task) === "blocked").length;
  const reviewCount = sortedTasks.filter((task) => taskBucket(task) === "review").length;

  const selectedIncident = selectedTask ? incidents.find((incident) => incident.id === selectedTask.incident_id) || null : null;
  const selectedIntel = selectedTask ? incidentIntelligence.find((intel) => intel.incident_id === selectedTask.incident_id) || null : null;

  const identifiers = selectedTask?.identifiers || {};
  const fingerprint = selectedTask?.fingerprint || {};
  const researchContext = selectedTask?.research_context || {};
  const result = selectedTask?.result || {};
  const officialReport = result.official_report || {};
  const recordsValidation = officialReport.verification || result.records_validation || {};
  const resolutionOutcome = researchContext.agency_resolution_outcome || result.agency_resolution_outcome || {};
  const portalHandoff = result.portal_handoff || {};

  const operatorInstructions: string[] = (
    Array.isArray(result.operator_instructions)
      ? result.operator_instructions
      : Array.isArray(portalHandoff.lookup_instructions)
      ? portalHandoff.lookup_instructions
      : []
  ).map((value: unknown) => String(value));

  const sourceUrl = String(
    officialReport.source_url ||
    officialReport.official_source_url ||
    recordsValidation.official_source_url ||
    ""
  );
  const isSafeHttpUrl = /^https?:\\/\\//i.test(sourceUrl);

  const reportNumber = String(
    officialReport.crash_report_number ||
    identifiers.crash_report_number ||
    selectedIntel?.crash_report_number ||
    ""
  );

  const agencyCaseNumber = String(
    officialReport.agency_case_number ||
    identifiers.agency_case_number ||
    selectedIntel?.agency_case_number ||
    ""
  );

  const agency = String(
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
    officialReport.verified === true;

  const reportVerified =
    selectedTask?.status === "official_report_found" ||
    result.records_status === "verified" ||
    officialReport.verified === true;

  const validationConfidence = Number(
    recordsValidation.confidence ||
    recordsValidation.verification_confidence ||
    0
  );

  const getStatusTone = (task: ReportResearchTask) => {
    const bucket = taskBucket(task);
    if (bucket === "verified") return styles.recordsWsStatusVerified;
    if (bucket === "operator") return styles.recordsWsStatusOperator;
    if (bucket === "blocked") return styles.recordsWsStatusBlocked;
    if (bucket === "review") return styles.recordsWsStatusReview;
    return styles.recordsWsStatusNeutral;
  };

  const displayLocation = String(fingerprint.location || selectedIncident?.location || "") || "Location pending";
  const displayCounty = String(fingerprint.county || selectedIncident?.county || "") || "County pending";
  const displayDate = String(fingerprint.crash_date || selectedIncident?.occurred_at || "");

  return (
    <div className={styles.recordsWsShell}>
      <section className={styles.recordsWsCommand}>
        <div>
          <span>OFFICIAL ACCIDENT RECORDS CONTROL</span>
          <strong>Verified records before identity research</strong>
          <p>
            Records tracks investigating-agency resolution, official report identifiers,
            portal/operator handoffs, source provenance, conflicts, and the verified
            report state that unlocks Trace or Sentinel.
          </p>
        </div>
        <div className={styles.recordsWsCommandActions}>
          <div className={styles.recordsWsSafetyBadge}>
            <ShieldCheck size={13} />
            SOURCE-GATED
          </div>
          <button type="button" onClick={onRefresh}>
            <RefreshCw size={13} />
            Refresh Records
          </button>
        </div>
      </section>

      {agentMessage ? <div className={styles.recordsWsMessage}>{agentMessage}</div> : null}

      <section className={styles.recordsWsStats}>
        <div><span>REPORT TASKS</span><strong>{sortedTasks.length}</strong><small>official-record queue</small></div>
        <div><span>VERIFIED</span><strong>{verifiedCount}</strong><small>report found</small></div>
        <div><span>OPERATOR</span><strong>{operatorCount}</strong><small>portal handoff</small></div>
        <div><span>AGENCY BLOCKED</span><strong>{blockedCount}</strong><small>resolution needed</small></div>
        <div><span>REVIEW</span><strong>{reviewCount}</strong><small>conflict / incomplete</small></div>
      </section>

      <section className={styles.recordsWsFilterBar}>
        {[
          ["all", "All"],
          ["verified", "Verified"],
          ["operator", "Operator"],
          ["blocked", "Agency Blocked"],
          ["review", "Needs Review"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? styles.recordsWsFilterActive : ""}
            onClick={() => setFilter(value as "all" | "verified" | "operator" | "blocked" | "review")}
          >
            {label}
          </button>
        ))}
      </section>

      <div className={styles.recordsWsGrid}>
        <section className={styles.recordsWsQueue}>
          <div className={styles.recordsWsSectionHead}>
            <div>
              <span>RECORDS QUEUE</span>
              <strong>{filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"}</strong>
            </div>
            <small>newest activity first</small>
          </div>

          <div className={styles.recordsWsQueueList}>
            {filteredTasks.length ? (
              filteredTasks.map((task) => {
                const taskFp = task.fingerprint || {};
                const taskResult = task.result || {};
                const taskReport = taskResult.official_report || {};
                const taskReportNo = String(taskReport.crash_report_number || task.identifiers?.crash_report_number || "");
                const incident = incidents.find((item) => item.id === task.incident_id);

                return (
                  <button
                    key={task.id}
                    type="button"
                    className={selectedTask?.id === task.id ? styles.recordsWsQueueActive : ""}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className={styles.recordsWsQueueTop}>
                      <span className={getStatusTone(task)}>
                        {String(task.status || "pending").replace(/_/g, " ").toUpperCase()}
                      </span>
                      <small>{formatDateTime(task.updated_at)}</small>
                    </div>
                    <strong>{String(taskFp.location || incident?.location || "Accident record")}</strong>
                    <p>{String(taskFp.county || incident?.county || "Florida")} · {task.provider || "Official records"}</p>
                    <div className={styles.recordsWsQueueMeta}>
                      <em>{taskReportNo ? "REPORT " + taskReportNo : "REPORT ID PENDING"}</em>
                      <em>{String(task.next_action || "review").replace(/_/g, " ")}</em>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={styles.recordsWsEmpty}>
                <FileSearch size={20} />
                <strong>No Records tasks in this view.</strong>
                <p>Run Records from a Pulse incident to create or continue an official-record task.</p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.recordsWsDetail}>
          {selectedTask ? (
            <>
              <div className={styles.recordsWsDetailHead}>
                <div>
                  <span>SELECTED OFFICIAL-RECORD TASK</span>
                  <h3>{displayLocation}</h3>
                  <p>{displayCounty}{displayDate ? " · " + formatDateTime(displayDate) : ""}</p>
                </div>
                <div className={styles.recordsWsDetailActions}>
                  {isSafeHttpUrl ? (
                    <a href={sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={12} />
                      Official Source
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={Boolean(runningAgent) || !selectedTask.incident_id}
                    onClick={() => onRunRecords(selectedTask.incident_id, selectedTask.id)}
                  >
                    {runningAgent === "records" ? (
                      <RefreshCw size={12} className={styles.spin} />
                    ) : (
                      <FileSearch size={12} />
                    )}
                    {runningAgent === "records" ? "Running…" : "Run Records"}
                  </button>
                </div>
              </div>

              <div className={styles.recordsWsStateRow}>
                <span className={reportVerified ? styles.recordsWsStateGood : styles.recordsWsStatePending}>
                  {reportVerified ? "REPORT VERIFIED" : "REPORT PENDING"}
                </span>
                <span className={agencyVerified ? styles.recordsWsStateGood : styles.recordsWsStatePending}>
                  {agencyVerified ? "AGENCY VERIFIED" : "AGENCY UNRESOLVED"}
                </span>
                <span className={result.records_status === "conflict" ? styles.recordsWsStateBad : styles.recordsWsStateNeutral}>
                  {String(result.records_status || "records active").replace(/_/g, " ").toUpperCase()}
                </span>
              </div>

              <div className={styles.recordsWsInfoGrid}>
                <div>
                  <span>INVESTIGATING AGENCY</span>
                  <strong>{agency || "Not verified"}</strong>
                  <small>{agencyVerified ? "officially verified" : bestCandidate ? "Best candidate: " + bestCandidate : "resolution pending"}</small>
                </div>
                <div>
                  <span>CRASH REPORT #</span>
                  <strong>{reportNumber || "Pending"}</strong>
                  <small>official identifier</small>
                </div>
                <div>
                  <span>AGENCY CASE #</span>
                  <strong>{agencyCaseNumber || "Pending"}</strong>
                  <small>agency identifier</small>
                </div>
                <div>
                  <span>VALIDATION</span>
                  <strong>{validationConfidence ? String(validationConfidence) + "%" : reportVerified ? "Verified" : "Pending"}</strong>
                  <small>Records confidence</small>
                </div>
                <div>
                  <span>PROVIDER</span>
                  <strong>{selectedTask.provider || "Official records"}</strong>
                  <small>source channel</small>
                </div>
                <div>
                  <span>NEXT ACTION</span>
                  <strong>{String(selectedTask.next_action || "review").replace(/_/g, " ")}</strong>
                  <small>workflow state</small>
                </div>
              </div>

              <div className={styles.recordsWsPanels}>
                <section>
                  <div className={styles.recordsWsPanelHead}>
                    <span>REPORT PROVENANCE</span>
                    <strong>Official source chain</strong>
                  </div>
                  <dl className={styles.recordsWsDefinitionList}>
                    <div><dt>Report date</dt><dd>{officialReport.report_date || "Not recorded"}</dd></div>
                    <div><dt>Crash date</dt><dd>{officialReport.crash_date || fingerprint.crash_date || "Not recorded"}</dd></div>
                    <div><dt>Source host</dt><dd>{recordsValidation.source_hostname || "Pending"}</dd></div>
                    <div><dt>Identity-bearing</dt><dd>{officialReport.identity_bearing_source_available === true ? "Available" : "Not established"}</dd></div>
                  </dl>
                </section>

                <section>
                  <div className={styles.recordsWsPanelHead}>
                    <span>AGENCY RESOLUTION</span>
                    <strong>Candidate → verification</strong>
                  </div>
                  <dl className={styles.recordsWsDefinitionList}>
                    <div><dt>Best candidate</dt><dd>{bestCandidate || agency || "None"}</dd></div>
                    <div>
                      <dt>Candidate confidence</dt>
                      <dd>
                        {Number(researchContext.best_agency_candidate_confidence || resolutionOutcome.candidate_confidence || 0)
                          ? String(Math.round(Number(researchContext.best_agency_candidate_confidence || resolutionOutcome.candidate_confidence || 0) * 100)) + "%"
                          : "—"}
                      </dd>
                    </div>
                    <div><dt>Resolution state</dt><dd>{String(resolutionOutcome.resolution_state || (agencyVerified ? "verified" : "pending")).replace(/_/g, " ")}</dd></div>
                    <div><dt>Resolution required</dt><dd>{researchContext.agency_resolution_required === true ? "Yes" : "No"}</dd></div>
                  </dl>
                </section>
              </div>

              <section className={styles.recordsWsOperator}>
                <div className={styles.recordsWsPanelHead}>
                  <span>PORTAL / OPERATOR HANDOFF</span>
                  <strong>{String(result.handoff_status || result.lookup_status || selectedTask.status || "not required").replace(/_/g, " ")}</strong>
                </div>
                <div className={styles.recordsWsOperatorMeta}>
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
                )}
              </section>

              <section className={styles.recordsWsFooter}>
                <div><span>INCIDENT ID</span><code>{selectedTask.incident_id}</code></div>
                <div><span>TASK ID</span><code>{selectedTask.id}</code></div>
                <div><span>UPDATED</span><strong>{formatDateTime(selectedTask.updated_at)}</strong></div>
              </section>
            </>
          ) : (
            <div className={styles.recordsWsEmptyLarge}>
              <FileSearch size={28} />
              <strong>Records is ready.</strong>
              <p>Run Records from an accident incident or wait for the official-report worker to create a task.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

`;
  source = replaceRequired(source, anchor, component + anchor, "RecordsWorkstation component");
}

if (!css.includes("RECORDS WORKSTATION V1")) {
  css += `

/* =========================================================
   RECORDS WORKSTATION V1
   ========================================================= */
.recordsWsShell{display:grid;gap:10px;min-width:0}
.recordsWsCommand{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 14px;border:1px solid rgba(111,184,244,.18);border-radius:11px;background:radial-gradient(circle at 0 0,rgba(111,184,244,.07),transparent 38%),linear-gradient(90deg,rgba(111,184,244,.035),rgba(7,18,27,.22))}
.recordsWsCommand>div:first-child{min-width:0}
.recordsWsCommand span,.recordsWsSectionHead span,.recordsWsPanelHead span,.recordsWsInfoGrid span,.recordsWsFooter span{display:block;color:#72acd0;font-size:6px;font-weight:900;letter-spacing:.1em}
.recordsWsCommand strong{display:block;margin-top:4px;color:#e1ebef;font-family:Georgia,serif;font-size:15px;font-weight:500}
.recordsWsCommand p{max-width:830px;margin:5px 0 0;color:#73909d;font-size:7.5px;line-height:1.55}
.recordsWsCommandActions{display:flex;align-items:center;gap:7px;flex:0 0 auto}
.recordsWsCommandActions button,.recordsWsDetailActions button,.recordsWsDetailActions a{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:7px 10px;border:1px solid rgba(111,184,244,.19);border-radius:7px;background:rgba(111,184,244,.045);color:#8bc4e4;font-size:7px;font-weight:900;text-decoration:none;cursor:pointer}
.recordsWsCommandActions button:hover,.recordsWsDetailActions button:hover,.recordsWsDetailActions a:hover{border-color:rgba(111,184,244,.34);background:rgba(111,184,244,.08)}
.recordsWsDetailActions button:disabled{opacity:.4;cursor:not-allowed}
.recordsWsSafetyBadge{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid rgba(95,211,166,.22);border-radius:999px;background:rgba(95,211,166,.05);color:#89ddb8;font-size:6px;font-weight:900;letter-spacing:.075em}
.recordsWsMessage{padding:8px 10px;border:1px solid rgba(111,184,244,.13);border-radius:8px;background:rgba(111,184,244,.025);color:#86abc0;font-size:7px}
.recordsWsStats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
.recordsWsStats>div{min-width:0;padding:9px 10px;border:1px solid rgba(110,154,179,.11);border-radius:8px;background:rgba(5,17,25,.28)}
.recordsWsStats span{display:block;color:#688b9c;font-size:5.8px;font-weight:900;letter-spacing:.08em}
.recordsWsStats strong{display:block;margin-top:4px;color:#dce9ee;font-size:16px}
.recordsWsStats small{display:block;margin-top:2px;color:#55717d;font-size:6px}
.recordsWsFilterBar{display:flex;gap:6px;flex-wrap:wrap;padding:2px 0}
.recordsWsFilterBar button{padding:6px 8px;border:1px solid rgba(110,154,179,.11);border-radius:999px;background:rgba(255,255,255,.008);color:#698895;font-size:6px;font-weight:850;cursor:pointer}
.recordsWsFilterBar button:hover,.recordsWsFilterActive{border-color:rgba(111,184,244,.25)!important;background:rgba(111,184,244,.055)!important;color:#98c9e3!important}
.recordsWsGrid{display:grid;grid-template-columns:minmax(250px,.72fr) minmax(0,1.75fr);gap:9px;min-width:0}
.recordsWsQueue,.recordsWsDetail{min-width:0;min-height:430px;padding:11px;border:1px solid rgba(110,154,179,.12);border-radius:10px;background:rgba(5,16,24,.32)}
.recordsWsSectionHead,.recordsWsPanelHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
.recordsWsSectionHead strong,.recordsWsPanelHead strong{display:block;margin-top:3px;color:#d2e1e7;font-size:9px;font-weight:700;text-transform:capitalize}
.recordsWsSectionHead small{color:#536f7a;font-size:6px}
.recordsWsQueueList{max-height:610px;overflow:auto;padding-right:2px}
.recordsWsQueueList>button{width:100%;display:block;margin-bottom:6px;padding:9px;border:1px solid rgba(110,154,179,.1);border-radius:8px;background:rgba(9,27,38,.46);color:inherit;text-align:left;cursor:pointer}
.recordsWsQueueList>button:hover,.recordsWsQueueActive{border-color:rgba(111,184,244,.26)!important;background:rgba(111,184,244,.045)!important}
.recordsWsQueueTop{display:flex;align-items:center;justify-content:space-between;gap:8px}
.recordsWsQueueTop>span{padding:4px 6px;border-radius:999px;font-size:5.5px;font-weight:900;letter-spacing:.045em}
.recordsWsQueueTop small{color:#52717f;font-size:5.5px}
.recordsWsQueueList>button>strong{display:block;margin-top:7px;overflow:hidden;color:#d4e2e8;font-size:8px;text-overflow:ellipsis;white-space:nowrap}
.recordsWsQueueList>button>p{margin:3px 0 0;color:#6a8997;font-size:6.5px;line-height:1.35}
.recordsWsQueueMeta{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
.recordsWsQueueMeta em{padding:3px 5px;border:1px solid rgba(110,154,179,.09);border-radius:5px;color:#638493;background:rgba(255,255,255,.007);font-size:5.3px;font-style:normal;font-weight:800;text-transform:uppercase}
.recordsWsStatusVerified{color:#83deb5;border:1px solid rgba(95,211,166,.19);background:rgba(95,211,166,.045)}
.recordsWsStatusOperator{color:#e0bd72;border:1px solid rgba(226,187,103,.2);background:rgba(226,187,103,.045)}
.recordsWsStatusBlocked{color:#d9968f;border:1px solid rgba(214,119,112,.2);background:rgba(214,119,112,.04)}
.recordsWsStatusReview{color:#cc9fdf;border:1px solid rgba(183,122,209,.2);background:rgba(183,122,209,.04)}
.recordsWsStatusNeutral{color:#7895a3;border:1px solid rgba(110,154,179,.11);background:rgba(255,255,255,.01)}
.recordsWsDetailHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid rgba(110,154,179,.08)}
.recordsWsDetailHead>div:first-child{min-width:0}
.recordsWsDetailHead span{color:#70abd0;font-size:6px;font-weight:900;letter-spacing:.1em}
.recordsWsDetailHead h3{margin:4px 0 0;overflow:hidden;color:#e1e9ed;font-family:Georgia,serif;font-size:16px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}
.recordsWsDetailHead p{margin:4px 0 0;color:#668692;font-size:7px}
.recordsWsDetailActions{display:flex;gap:6px;flex:0 0 auto}
.recordsWsStateRow{display:flex;gap:6px;flex-wrap:wrap;padding:9px 0}
.recordsWsStateRow span{padding:4px 7px;border-radius:999px;font-size:5.8px;font-weight:900;letter-spacing:.055em}
.recordsWsStateGood{color:#83deb5;border:1px solid rgba(95,211,166,.18);background:rgba(95,211,166,.04)}
.recordsWsStatePending{color:#dfbd74;border:1px solid rgba(226,187,103,.18);background:rgba(226,187,103,.04)}
.recordsWsStateBad{color:#de938c;border:1px solid rgba(214,119,112,.19);background:rgba(214,119,112,.04)}
.recordsWsStateNeutral{color:#7394a3;border:1px solid rgba(110,154,179,.11);background:rgba(255,255,255,.008)}
.recordsWsInfoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.recordsWsInfoGrid>div{min-width:0;padding:8px 9px;border:1px solid rgba(110,154,179,.09);border-radius:7px;background:rgba(255,255,255,.006)}
.recordsWsInfoGrid strong{display:block;margin-top:4px;overflow:hidden;color:#cfdee4;font-size:8px;text-overflow:ellipsis;white-space:nowrap}
.recordsWsInfoGrid small{display:block;margin-top:3px;color:#536f7b;font-size:5.8px}
.recordsWsPanels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}
.recordsWsPanels>section,.recordsWsOperator{min-width:0;padding:9px;border:1px solid rgba(110,154,179,.09);border-radius:8px;background:rgba(7,22,31,.36)}
.recordsWsDefinitionList{margin:0}
.recordsWsDefinitionList>div{display:grid;grid-template-columns:minmax(90px,.8fr) minmax(0,1.2fr);gap:8px;padding:6px 0;border-top:1px solid rgba(110,154,179,.065)}
.recordsWsDefinitionList dt{color:#607f8d;font-size:6px}
.recordsWsDefinitionList dd{margin:0;overflow-wrap:anywhere;color:#b8ccd4;font-size:6.5px;text-align:right}
.recordsWsOperator{margin-top:8px}
.recordsWsOperatorMeta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.recordsWsOperatorMeta span{padding:4px 6px;border-radius:5px;background:rgba(111,184,244,.025);color:#658794;font-size:6px}
.recordsWsOperatorMeta b{margin-left:4px;color:#9cbac7;font-weight:800}
.recordsWsOperator ol{margin:0;padding-left:18px;color:#829da8;font-size:6.5px;line-height:1.55}
.recordsWsOperator li+li{margin-top:4px}
.recordsWsMuted{margin:0;color:#58737e;font-size:6.5px}
.recordsWsFooter{display:grid;grid-template-columns:1fr 1fr .7fr;gap:7px;margin-top:8px}
.recordsWsFooter>div{min-width:0;padding:7px 8px;border-top:1px solid rgba(110,154,179,.07)}
.recordsWsFooter code,.recordsWsFooter strong{display:block;margin-top:4px;overflow:hidden;color:#7f9da9;font-size:6px;font-family:inherit;text-overflow:ellipsis;white-space:nowrap}
.recordsWsEmpty,.recordsWsEmptyLarge{display:grid;place-items:center;min-height:170px;padding:18px;text-align:center;color:#55747f}
.recordsWsEmptyLarge{min-height:400px}
.recordsWsEmpty svg,.recordsWsEmptyLarge svg{color:#638da4}
.recordsWsEmpty strong,.recordsWsEmptyLarge strong{display:block;margin-top:7px;color:#8ba7b2;font-size:8px}
.recordsWsEmpty p,.recordsWsEmptyLarge p{max-width:420px;margin:4px 0 0;color:#57737e;font-size:6.5px;line-height:1.5}
@media(max-width:1050px){.recordsWsStats{grid-template-columns:repeat(3,minmax(0,1fr))}.recordsWsGrid{grid-template-columns:1fr}.recordsWsQueue{min-height:0}.recordsWsQueueList{max-height:330px}}
@media(max-width:760px){.recordsWsCommand,.recordsWsDetailHead{align-items:flex-start;flex-direction:column}.recordsWsCommandActions,.recordsWsDetailActions{flex-wrap:wrap}.recordsWsStats,.recordsWsInfoGrid,.recordsWsPanels,.recordsWsFooter{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.recordsWsStats,.recordsWsInfoGrid,.recordsWsPanels,.recordsWsFooter{grid-template-columns:1fr}}
`;
}

fs.writeFileSync(pagePath, source, "utf8");
fs.writeFileSync(cssPath, css, "utf8");

console.log("Applied Records expanded workstation UI.");

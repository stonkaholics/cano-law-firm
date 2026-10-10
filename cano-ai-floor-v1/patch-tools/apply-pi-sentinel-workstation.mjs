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
    "Sentinel workstation patch: page.tsx not found."
  );
}

if (!fs.existsSync(cssPath)) {
  throw new Error(
    "Sentinel workstation patch: CSS not found."
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
  "SENTINEL_WORKSTATION_V1";

function replaceRequired(
  input,
  find,
  replacement,
  label
) {
  if (!input.includes(find)) {
    throw new Error(
      "Sentinel workstation patch: anchor not found for " +
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
    "selectedAgent.id === \"sentinel\" ?"
  )
) {
  const anchor =
`              ) : selectedAgent.id === "trace" ? (
                <TraceWorkstation
                  incidents={workspace.incidents}
                  incidentIntelligence={workspace.incidentIntelligence}
                  incidentPeople={workspace.incidentPeople}
                  reportResearchTasks={workspace.reportResearchTasks || []}
                  runningAgent={runningAgent}
                  agentMessage={agentMessage}
                  onRunTrace={(incidentId, taskId) =>
                    runPiAgent("trace", {
                      incidentId,
                      taskId,
                      mode: "trace_identity_contact",
                      requestedFrom: "trace_expanded_workstation",
                      specialistAgent: "trace",
                    })
                  }
                  onRefresh={() => void loadWorkspace()}
                />
              ) : ["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id) ? (`;

  const replacement =
`              ) : selectedAgent.id === "trace" ? (
                <TraceWorkstation
                  incidents={workspace.incidents}
                  incidentIntelligence={workspace.incidentIntelligence}
                  incidentPeople={workspace.incidentPeople}
                  reportResearchTasks={workspace.reportResearchTasks || []}
                  runningAgent={runningAgent}
                  agentMessage={agentMessage}
                  onRunTrace={(incidentId, taskId) =>
                    runPiAgent("trace", {
                      incidentId,
                      taskId,
                      mode: "trace_identity_contact",
                      requestedFrom: "trace_expanded_workstation",
                      specialistAgent: "trace",
                    })
                  }
                  onRefresh={() => void loadWorkspace()}
                />
              ) : selectedAgent.id === "sentinel" ? (
                <SentinelWorkstation
                  incidents={workspace.incidents}
                  incidentIntelligence={workspace.incidentIntelligence}
                  incidentPeople={workspace.incidentPeople}
                  reportResearchTasks={workspace.reportResearchTasks || []}
                  runningAgent={runningAgent}
                  agentMessage={agentMessage}
                  onRunSentinel={(incidentId, taskId) =>
                    runPiAgent("sentinel", {
                      incidentId,
                      taskId,
                      mode: "sentinel_accident_review",
                      requestedFrom: "sentinel_expanded_workstation",
                      specialistAgent: "sentinel",
                    })
                  }
                  onRefresh={() => void loadWorkspace()}
                />
              ) : ["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id) ? (`;

  source =
    replaceRequired(
      source,
      anchor,
      replacement,
      "Sentinel expanded route"
    );
}

/*
|--------------------------------------------------------------------------
| Disable generic top Run button for Sentinel.
|--------------------------------------------------------------------------
*/

source =
  source.replace(
    `["medintel", "records", "trace"].includes(selectedAgent.id) ||
                    selectedAgent.runnable === false`,
    `["medintel", "records", "trace", "sentinel"].includes(selectedAgent.id) ||
                    selectedAgent.runnable === false`
  );

source =
  source.replace(
    `["medintel", "records", "trace"].includes(selectedAgent.id) || selectedAgent.runnable === false
                      ? undefined`,
    `["medintel", "records", "trace", "sentinel"].includes(selectedAgent.id) || selectedAgent.runnable === false
                      ? undefined`
  );

source =
  source.replace(
    `: selectedAgent.id === "trace"
                    ? "Use Trace Queue Below"`,
    `: selectedAgent.id === "trace"
                    ? "Use Trace Queue Below"
                    : selectedAgent.id === "sentinel"
                    ? "Use Sentinel Queue Below"`
  );

/*
|--------------------------------------------------------------------------
| Add Sentinel summary to each Pulse incident card.
|--------------------------------------------------------------------------
*/

if (
  !source.includes(
    "PULSE_SENTINEL_REPORT_V1"
  )
) {
  const sentinelButton =
`          <button
            onClick={() => onRunSentinel?.(incident.id)}
            disabled={
              Boolean(runningAgent) ||
              !onRunSentinel
            }
            title={
              contactKnown
                ? "Run Sentinel final review on the current identity/contact package."
                : "Run Sentinel now to review provenance, missing-data blockers, timing gates, and whether the incident should return to Records or Trace."
            }
          >
            <ShieldCheck size={12} />
            Run Sentinel
          </button>`;

  const pulseReport =
`${sentinelButton}

          {/* PULSE_SENTINEL_REPORT_V1 */}
          {intel?.metadata?.sentinel ? (
            <section className={styles.pulseSentinelReport}>
              <div className={styles.pulseSentinelReportHead}>
                <div>
                  <span>SENTINEL FINAL REVIEW</span>
                  <strong>
                    {String(
                      intel.metadata.sentinel.decision ||
                      "review_required"
                    ).replace(
                      /_/g,
                      " "
                    )}
                  </strong>
                </div>

                <em
                  className={
                    String(
                      intel.metadata.sentinel.decision ||
                      ""
                    ) === "ready_human_review"
                      ? styles.pulseSentinelGood
                      : String(
                          intel.metadata.sentinel.decision ||
                          ""
                        ) === "represented_block"
                      ? styles.pulseSentinelBlocked
                      : styles.pulseSentinelHold
                  }
                >
                  {String(
                    intel.metadata.sentinel.decision ||
                    "review required"
                  ).replace(
                    /_/g,
                    " "
                  )}
                </em>
              </div>

              <div className={styles.pulseSentinelReportGrid}>
                <div>
                  <span>NEXT ACTION</span>
                  <strong>
                    {String(
                      intel.metadata.sentinel.next_action ||
                      "manual_compliance_review"
                    ).replace(
                      /_/g,
                      " "
                    )}
                  </strong>
                </div>

                <div>
                  <span>BLOCKERS</span>
                  <strong>
                    {Array.isArray(
                      intel.metadata.sentinel.blockers
                    )
                      ? intel.metadata.sentinel.blockers.length
                      : 0}
                  </strong>
                </div>

                <div>
                  <span>PASSED CHECKS</span>
                  <strong>
                    {Array.isArray(
                      intel.metadata.sentinel.passed_checks
                    )
                      ? intel.metadata.sentinel.passed_checks.length
                      : 0}
                  </strong>
                </div>

                <div>
                  <span>HUMAN REVIEW</span>
                  <strong>
                    {intel.metadata.sentinel.human_review_required === false
                      ? "Not required"
                      : "Required"}
                  </strong>
                </div>
              </div>

              {Array.isArray(
                intel.metadata.sentinel.blockers
              ) &&
              intel.metadata.sentinel.blockers.length ? (
                <div className={styles.pulseSentinelBlockers}>
                  {intel.metadata.sentinel.blockers
                    .slice(
                      0,
                      5
                    )
                    .map(
                      (
                        blocker: unknown,
                        index: number
                      ) => (
                        <span
                          key={
                            String(index) +
                            "-" +
                            String(blocker)
                          }
                        >
                          {String(
                            blocker
                          ).replace(
                            /_/g,
                            " "
                          )}
                        </span>
                      )
                    )}
                </div>
              ) : null}
            </section>
          ) : null}`;

  source =
    replaceRequired(
      source,
      sentinelButton,
      pulseReport,
      "Pulse Sentinel final report"
    );
}

/*
|--------------------------------------------------------------------------
| Sentinel workstation component.
|--------------------------------------------------------------------------
*/

if (
  !source.includes(
    `/* ${MARKER} */`
  )
) {
  const anchor =
    "function MedIntelWorkstation() {";

  const component =
`/* SENTINEL_WORKSTATION_V1 */
function SentinelWorkstation({
  incidents,
  incidentIntelligence,
  incidentPeople,
  reportResearchTasks,
  runningAgent,
  agentMessage,
  onRunSentinel,
  onRefresh,
}: {
  incidents: IncidentWatch[];
  incidentIntelligence: IncidentIntelligence[];
  incidentPeople: IncidentPerson[];
  reportResearchTasks?: ReportResearchTask[];
  runningAgent: string | null;
  agentMessage: string;
  onRunSentinel: (incidentId: string, taskId?: string) => void;
  onRefresh: () => void;
}) {
  const [selectedIncidentId, setSelectedIncidentId] =
    useState<string>("");

  const [filter, setFilter] =
    useState<
      "all" |
      "ready" |
      "hold" |
      "blocked" |
      "routing" |
      "review"
    >("all");

  const [stableIntelligence, setStableIntelligence] =
    useState<IncidentIntelligence[]>(
      incidentIntelligence || []
    );

  const [stablePeople, setStablePeople] =
    useState<IncidentPerson[]>(
      incidentPeople || []
    );

  const [stableTasks, setStableTasks] =
    useState<ReportResearchTask[]>(
      reportResearchTasks || []
    );

  useEffect(() => {
    if (
      Array.isArray(
        incidentIntelligence
      ) &&
      incidentIntelligence.length > 0
    ) {
      setStableIntelligence(
        incidentIntelligence
      );
    }
  }, [incidentIntelligence]);

  useEffect(() => {
    if (
      Array.isArray(
        incidentPeople
      ) &&
      incidentPeople.length > 0
    ) {
      setStablePeople(
        incidentPeople
      );
    }
  }, [incidentPeople]);

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
  }, []);

  const intelligenceByIncident =
    useMemo(() => {
      const map =
        new Map<
          string,
          IncidentIntelligence
        >();

      stableIntelligence.forEach(
        (row) => {
          if (row.incident_id) {
            map.set(
              row.incident_id,
              row
            );
          }
        }
      );

      return map;
    }, [stableIntelligence]);

  const peopleByIncident =
    useMemo(() => {
      const map =
        new Map<
          string,
          IncidentPerson[]
        >();

      stablePeople.forEach(
        (person) => {
          const key =
            String(
              person.incident_id ||
              ""
            );

          if (!key) return;

          const current =
            map.get(key) || [];

          current.push(person);
          map.set(
            key,
            current
          );
        }
      );

      return map;
    }, [stablePeople]);

  const latestTaskByIncident =
    useMemo(() => {
      const map =
        new Map<
          string,
          ReportResearchTask
        >();

      stableTasks
        .slice()
        .sort(
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
        )
        .forEach(
          (task) => {
            if (
              task.incident_id &&
              !map.has(
                task.incident_id
              )
            ) {
              map.set(
                task.incident_id,
                task
              );
            }
          }
        );

      return map;
    }, [stableTasks]);

  const getSentinel =
    (
      incidentId: string
    ) => {
      const intel =
        intelligenceByIncident.get(
          incidentId
        );

      const sentinel =
        intel?.metadata?.sentinel;

      return sentinel &&
        typeof sentinel ===
          "object"
        ? sentinel
        : null;
    };

  const getDecision =
    (
      incidentId: string
    ) =>
      String(
        getSentinel(
          incidentId
        )?.decision ||
        ""
      );

  const bucketFor =
    (
      incidentId: string
    ) => {
      const decision =
        getDecision(
          incidentId
        );

      if (
        decision ===
        "ready_human_review"
      ) {
        return "ready";
      }

      if (
        decision ===
        "timing_hold"
      ) {
        return "hold";
      }

      if (
        decision ===
        "represented_block"
      ) {
        return "blocked";
      }

      if (
        decision ===
          "records_required" ||
        decision ===
          "trace_required"
      ) {
        return "routing";
      }

      return "review";
    };

  const queue =
    useMemo(() => {
      const copy =
        [...incidents];

      copy.sort(
        (a, b) =>
          new Date(
            b.occurred_at ||
            0
          ).getTime() -
          new Date(
            a.occurred_at ||
            0
          ).getTime()
      );

      return copy.filter(
        (incident) =>
          filter === "all" ||
          bucketFor(
            incident.id
          ) === filter
      );
    }, [
      incidents,
      stableIntelligence,
      filter,
    ]);

  const selectedIncident =
    incidents.find(
      (incident) =>
        incident.id ===
        selectedIncidentId
    ) ||
    queue[0] ||
    incidents[0] ||
    null;

  useEffect(() => {
    if (
      selectedIncident &&
      selectedIncident.id !==
        selectedIncidentId
    ) {
      setSelectedIncidentId(
        selectedIncident.id
      );
    }
  }, [
    selectedIncident?.id,
    selectedIncidentId,
  ]);

  const selectedIntel =
    selectedIncident
      ? intelligenceByIncident.get(
          selectedIncident.id
        ) || null
      : null;

  const selectedSentinel =
    selectedIntel
      ?.metadata
      ?.sentinel &&
    typeof selectedIntel
      .metadata
      .sentinel ===
      "object"
      ? selectedIntel
          .metadata
          .sentinel
      : {};

  const selectedPeople =
    selectedIncident
      ? peopleByIncident.get(
          selectedIncident.id
        ) || []
      : [];

  const selectedTask =
    selectedIncident
      ? latestTaskByIncident.get(
          selectedIncident.id
        ) || null
      : null;

  const blockers: string[] =
    Array.isArray(
      selectedSentinel.blockers
    )
      ? selectedSentinel.blockers.map(
          (value: unknown) =>
            String(value)
        )
      : [];

  const passedChecks: string[] =
    Array.isArray(
      selectedSentinel.passed_checks
    )
      ? selectedSentinel.passed_checks.map(
          (value: unknown) =>
            String(value)
        )
      : [];

  const decision =
    String(
      selectedSentinel.decision ||
      ""
    );

  const nextAction =
    String(
      selectedSentinel.next_action ||
      "run_sentinel_review"
    );

  const records =
    selectedSentinel.records &&
    typeof selectedSentinel.records ===
      "object"
      ? selectedSentinel.records
      : {};

  const trace =
    selectedSentinel.trace &&
    typeof selectedSentinel.trace ===
      "object"
      ? selectedSentinel.trace
      : {};

  const timing =
    selectedSentinel.timing &&
    typeof selectedSentinel.timing ===
      "object"
      ? selectedSentinel.timing
      : {};

  const representation =
    selectedSentinel.representation &&
    typeof selectedSentinel.representation ===
      "object"
      ? selectedSentinel.representation
      : {};

  const provenance =
    selectedSentinel.provenance &&
    typeof selectedSentinel.provenance ===
      "object"
      ? selectedSentinel.provenance
      : {};

  const readyCount =
    incidents.filter(
      (incident) =>
        getDecision(
          incident.id
        ) ===
        "ready_human_review"
    ).length;

  const holdCount =
    incidents.filter(
      (incident) =>
        getDecision(
          incident.id
        ) ===
        "timing_hold"
    ).length;

  const blockedCount =
    incidents.filter(
      (incident) =>
        getDecision(
          incident.id
        ) ===
        "represented_block"
    ).length;

  const routingCount =
    incidents.filter(
      (incident) =>
        [
          "records_required",
          "trace_required"
        ].includes(
          getDecision(
            incident.id
          )
        )
    ).length;

  const reviewCount =
    incidents.filter(
      (incident) => {
        const value =
          getDecision(
            incident.id
          );

        return (
          !value ||
          [
            "review_required",
            "representation_review"
          ].includes(
            value
          )
        );
      }
    ).length;

  const decisionClass =
    (
      value: string
    ) => {
      if (
        value ===
        "ready_human_review"
      ) {
        return styles.sentinelWsGood;
      }

      if (
        value ===
        "represented_block"
      ) {
        return styles.sentinelWsBlocked;
      }

      if (
        value ===
        "timing_hold"
      ) {
        return styles.sentinelWsHold;
      }

      if (
        value ===
          "records_required" ||
        value ===
          "trace_required"
      ) {
        return styles.sentinelWsRouting;
      }

      return styles.sentinelWsReview;
    };

  return (
    <div className={styles.sentinelWsShell}>
      <section className={styles.sentinelWsCommand}>
        <div>
          <span>
            FINAL ACCIDENT INTELLIGENCE REVIEW
          </span>

          <strong>
            Sentinel decides what is complete, blocked, missing, or ready for human review
          </strong>

          <p>
            Sentinel checks Records, Trace, source provenance, representation state,
            solicitation timing, and missing prerequisites. It never authorizes automatic outreach.
          </p>
        </div>

        <div className={styles.sentinelWsCommandActions}>
          <div className={styles.sentinelWsSafety}>
            <ShieldCheck size={13} />
            HUMAN GATE
          </div>

          <div className={styles.sentinelWsAuto}>
            <Activity size={12} />
            AUTO · 6 SEC
          </div>

          <button
            type="button"
            onClick={onRefresh}
          >
            <RefreshCw size={13} />
            Refresh Sentinel
          </button>
        </div>
      </section>

      {agentMessage ? (
        <div className={styles.sentinelWsMessage}>
          {agentMessage}
        </div>
      ) : null}

      <section className={styles.sentinelWsStats}>
        <div>
          <span>READY HUMAN REVIEW</span>
          <strong>{readyCount}</strong>
          <small>all automated checks passed</small>
        </div>

        <div>
          <span>TIMING HOLD</span>
          <strong>{holdCount}</strong>
          <small>waiting on solicitation gate</small>
        </div>

        <div>
          <span>REPRESENTED BLOCK</span>
          <strong>{blockedCount}</strong>
          <small>do not contact</small>
        </div>

        <div>
          <span>ROUTED BACK</span>
          <strong>{routingCount}</strong>
          <small>Records or Trace required</small>
        </div>

        <div>
          <span>REVIEW REQUIRED</span>
          <strong>{reviewCount}</strong>
          <small>manual compliance review</small>
        </div>
      </section>

      <section className={styles.sentinelWsFilterBar}>
        {[
          ["all", "All"],
          ["ready", "Ready"],
          ["hold", "Timing Hold"],
          ["blocked", "Represented"],
          ["routing", "Routed Back"],
          ["review", "Needs Review"],
        ].map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                filter === value
                  ? styles.sentinelWsFilterActive
                  : ""
              }
              onClick={() =>
                setFilter(
                  value as
                    | "all"
                    | "ready"
                    | "hold"
                    | "blocked"
                    | "routing"
                    | "review"
                )
              }
            >
              {label}
            </button>
          )
        )}
      </section>

      <div className={styles.sentinelWsGrid}>
        <section className={styles.sentinelWsQueue}>
          <div className={styles.sentinelWsSectionHead}>
            <div>
              <span>SENTINEL QUEUE</span>
              <strong>
                {queue.length} incident
                {queue.length === 1
                  ? ""
                  : "s"}
              </strong>
            </div>
            <small>
              newest accident first
            </small>
          </div>

          <div className={styles.sentinelWsQueueList}>
            {queue.length ? (
              queue.map(
                (incident) => {
                  const sentinel =
                    getSentinel(
                      incident.id
                    );

                  const itemDecision =
                    String(
                      sentinel?.decision ||
                      ""
                    );

                  const itemBlockers =
                    Array.isArray(
                      sentinel?.blockers
                    )
                      ? sentinel.blockers.length
                      : 0;

                  return (
                    <button
                      key={incident.id}
                      type="button"
                      className={
                        selectedIncident?.id ===
                        incident.id
                          ? styles.sentinelWsQueueActive
                          : ""
                      }
                      onClick={() =>
                        setSelectedIncidentId(
                          incident.id
                        )
                      }
                    >
                      <div className={styles.sentinelWsQueueTop}>
                        <span
                          className={
                            decisionClass(
                              itemDecision
                            )
                          }
                        >
                          {itemDecision
                            ? itemDecision
                                .replace(
                                  /_/g,
                                  " "
                                )
                                .toUpperCase()
                            : "NOT REVIEWED"}
                        </span>

                        <small>
                          {formatDateTime(
                            incident.occurred_at
                          )}
                        </small>
                      </div>

                      <strong>
                        {incident.location ||
                          "Accident incident"}
                      </strong>

                      <p>
                        {incident.county ||
                          "Florida"}
                        {" · "}
                        {incident.incident_type ||
                          "Accident"}
                      </p>

                      <div className={styles.sentinelWsQueueMeta}>
                        <em>
                          {itemBlockers}
                          {" "}
                          BLOCKERS
                        </em>

                        <em>
                          {String(
                            sentinel?.next_action ||
                            "run sentinel"
                          ).replace(
                            /_/g,
                            " "
                          )}
                        </em>
                      </div>
                    </button>
                  );
                }
              )
            ) : (
              <div className={styles.sentinelWsEmpty}>
                <ShieldCheck size={22} />
                <strong>
                  No incidents in this view.
                </strong>
                <p>
                  Change the filter or run Sentinel on an incident from Pulse.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.sentinelWsDetail}>
          {selectedIncident ? (
            <>
              <div className={styles.sentinelWsDetailHead}>
                <div>
                  <span>
                    SELECTED SENTINEL REVIEW
                  </span>

                  <h3>
                    {selectedIncident.location ||
                      "Accident incident"}
                  </h3>

                  <p>
                    {selectedIncident.county ||
                      "Florida"}
                    {" · "}
                    {formatDateTime(
                      selectedIncident.occurred_at
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    Boolean(
                      runningAgent
                    )
                  }
                  onClick={() =>
                    onRunSentinel(
                      selectedIncident.id,
                      selectedTask?.id
                    )
                  }
                >
                  {runningAgent ===
                  "sentinel" ? (
                    <RefreshCw
                      size={12}
                      className={
                        styles.spin
                      }
                    />
                  ) : (
                    <ShieldCheck
                      size={12}
                    />
                  )}

                  {runningAgent ===
                  "sentinel"
                    ? "Running…"
                    : "Run Sentinel"}
                </button>
              </div>

              <div className={styles.sentinelWsDecisionRow}>
                <span
                  className={
                    decisionClass(
                      decision
                    )
                  }
                >
                  {decision
                    ? decision
                        .replace(
                          /_/g,
                          " "
                        )
                        .toUpperCase()
                    : "NOT REVIEWED"}
                </span>

                <span className={styles.sentinelWsHumanGate}>
                  HUMAN REVIEW REQUIRED
                </span>

                <span className={styles.sentinelWsNoAuto}>
                  AUTO OUTREACH OFF
                </span>
              </div>

              <div className={styles.sentinelWsInfoGrid}>
                <div>
                  <span>NEXT ACTION</span>
                  <strong>
                    {nextAction.replace(
                      /_/g,
                      " "
                    )}
                  </strong>
                  <small>
                    Sentinel routing decision
                  </small>
                </div>

                <div>
                  <span>BLOCKERS</span>
                  <strong>
                    {blockers.length}
                  </strong>
                  <small>
                    failed or missing checks
                  </small>
                </div>

                <div>
                  <span>PASSED CHECKS</span>
                  <strong>
                    {passedChecks.length}
                  </strong>
                  <small>
                    verified gates
                  </small>
                </div>

                <div>
                  <span>VERIFIED IDENTITIES</span>
                  <strong>
                    {Number(
                      trace
                        .verified_identity_count ||
                      0
                    )}
                  </strong>
                  <small>
                    Trace result
                  </small>
                </div>

                <div>
                  <span>SOURCE CONTACTS</span>
                  <strong>
                    {Number(
                      trace
                        .source_contact_count ||
                      0
                    )}
                  </strong>
                  <small>
                    contact present in source
                  </small>
                </div>

                <div>
                  <span>REPRESENTATION UNKNOWN</span>
                  <strong>
                    {Number(
                      representation
                        .unknown_count ||
                      0
                    )}
                  </strong>
                  <small>
                    requires review
                  </small>
                </div>
              </div>

              <div className={styles.sentinelWsPanels}>
                <section>
                  <div className={styles.sentinelWsPanelHead}>
                    <span>BLOCKERS</span>
                    <strong>
                      What prevents completion
                    </strong>
                  </div>

                  {blockers.length ? (
                    <div className={styles.sentinelWsCheckList}>
                      {blockers.map(
                        (
                          blocker: string,
                          index: number
                        ) => (
                          <div
                            key={
                              String(index) +
                              "-" +
                              blocker
                            }
                            className={styles.sentinelWsCheckBad}
                          >
                            <X size={11} />
                            <span>
                              {blocker.replace(
                                /_/g,
                                " "
                              )}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className={styles.sentinelWsMuted}>
                      No Sentinel blockers recorded.
                    </p>
                  )}
                </section>

                <section>
                  <div className={styles.sentinelWsPanelHead}>
                    <span>PASSED CHECKS</span>
                    <strong>
                      Verified gates
                    </strong>
                  </div>

                  {passedChecks.length ? (
                    <div className={styles.sentinelWsCheckList}>
                      {passedChecks.map(
                        (
                          check: string,
                          index: number
                        ) => (
                          <div
                            key={
                              String(index) +
                              "-" +
                              check
                            }
                            className={styles.sentinelWsCheckGood}
                          >
                            <CheckCircle2 size={11} />
                            <span>
                              {check.replace(
                                /_/g,
                                " "
                              )}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className={styles.sentinelWsMuted}>
                      No passed checks recorded yet.
                    </p>
                  )}
                </section>
              </div>

              <div className={styles.sentinelWsPanels}>
                <section>
                  <div className={styles.sentinelWsPanelHead}>
                    <span>RECORDS</span>
                    <strong>
                      Official report verification
                    </strong>
                  </div>

                  <dl className={styles.sentinelWsDefinitionList}>
                    <div>
                      <dt>Report verified</dt>
                      <dd>
                        {records.report_verified ===
                        true
                          ? "Yes"
                          : "No"}
                      </dd>
                    </div>

                    <div>
                      <dt>Agency verified</dt>
                      <dd>
                        {records.agency_verified ===
                        true
                          ? "Yes"
                          : "No"}
                      </dd>
                    </div>

                    <div>
                      <dt>Investigating agency</dt>
                      <dd>
                        {String(
                          records.investigating_agency ||
                          "Not verified"
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Crash report #</dt>
                      <dd>
                        {String(
                          records.crash_report_number ||
                          "Pending"
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <div className={styles.sentinelWsPanelHead}>
                    <span>TIMING + REPRESENTATION</span>
                    <strong>
                      Final operational gates
                    </strong>
                  </div>

                  <dl className={styles.sentinelWsDefinitionList}>
                    <div>
                      <dt>Solicitation gate</dt>
                      <dd>
                        {timing.timing_known ===
                        true
                          ? timing.timing_open ===
                            true
                            ? "Open"
                            : "Not open"
                          : "Unknown"}
                      </dd>
                    </div>

                    <div>
                      <dt>Eligible at</dt>
                      <dd>
                        {timing.solicitation_eligible_at
                          ? formatDateTime(
                              String(
                                timing.solicitation_eligible_at
                              )
                            )
                          : "Unknown"}
                      </dd>
                    </div>

                    <div>
                      <dt>Represented</dt>
                      <dd>
                        {Number(
                          representation
                            .represented_count ||
                          0
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Representation unknown</dt>
                      <dd>
                        {Number(
                          representation
                            .unknown_count ||
                          0
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              <section className={styles.sentinelWsProvenance}>
                <div className={styles.sentinelWsPanelHead}>
                  <span>SOURCE PROVENANCE</span>
                  <strong>
                    Evidence chain Sentinel reviewed
                  </strong>
                </div>

                <div className={styles.sentinelWsProvenanceGrid}>
                  <div>
                    <span>INCIDENT SOURCE</span>
                    <code>
                      {String(
                        provenance.incident_source_url ||
                        selectedIncident.source_url ||
                        "Not recorded"
                      )}
                    </code>
                  </div>

                  <div>
                    <span>REPORT SOURCE</span>
                    <code>
                      {String(
                        provenance.report_source_url ||
                        "Not recorded"
                      )}
                    </code>
                  </div>

                  <div>
                    <span>IDENTITY SOURCES</span>
                    <strong>
                      {provenance.identity_sources_ready ===
                      true
                        ? "Ready"
                        : "Incomplete"}
                    </strong>
                  </div>

                  <div>
                    <span>PROVENANCE</span>
                    <strong>
                      {provenance.provenance_ready ===
                      true
                        ? "Ready"
                        : "Incomplete"}
                    </strong>
                  </div>
                </div>
              </section>

              <section className={styles.sentinelWsPeople}>
                <div className={styles.sentinelWsPanelHead}>
                  <span>PEOPLE REVIEW</span>
                  <strong>
                    {selectedPeople.length} stored incident people
                  </strong>
                </div>

                {selectedPeople.length ? (
                  <div className={styles.sentinelWsPeopleList}>
                    {selectedPeople.map(
                      (
                        person: IncidentPerson
                      ) => (
                        <article
                          key={person.id}
                        >
                          <div>
                            <span>
                              {String(
                                person.role ||
                                "party"
                              ).toUpperCase()}
                            </span>

                            <strong>
                              {person.name ||
                                "Unnamed"}
                            </strong>
                          </div>

                          <div>
                            <span>REPRESENTATION</span>
                            <strong>
                              {String(
                                person.represented_status ||
                                "unknown"
                              ).replace(
                                /_/g,
                                " "
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>OUTREACH STATUS</span>
                            <strong>
                              {String(
                                person.outreach_status ||
                                "blocked"
                              ).replace(
                                /_/g,
                                " "
                              )}
                            </strong>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                ) : (
                  <p className={styles.sentinelWsMuted}>
                    No incident people are stored yet.
                  </p>
                )}
              </section>

              <section className={styles.sentinelWsFooter}>
                <div>
                  <span>INCIDENT ID</span>
                  <code>
                    {selectedIncident.id}
                  </code>
                </div>

                <div>
                  <span>REPORT TASK</span>
                  <code>
                    {selectedTask?.id ||
                      "None"}
                  </code>
                </div>

                <div>
                  <span>REVIEWED</span>
                  <strong>
                    {selectedSentinel.reviewed_at
                      ? formatDateTime(
                          String(
                            selectedSentinel.reviewed_at
                          )
                        )
                      : "Not yet"}
                  </strong>
                </div>
              </section>
            </>
          ) : (
            <div className={styles.sentinelWsEmptyLarge}>
              <ShieldCheck size={28} />
              <strong>
                Sentinel is ready.
              </strong>
              <p>
                Select an incident and run Sentinel to generate the final review.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

`;

  source =
    replaceRequired(
      source,
      anchor,
      component + anchor,
      "SentinelWorkstation component"
    );
}

/*
|--------------------------------------------------------------------------
| CSS
|--------------------------------------------------------------------------
*/

if (
  !css.includes(
    "SENTINEL WORKSTATION V1"
  )
) {
  css += `

/* =========================================================
   SENTINEL WORKSTATION V1
   ========================================================= */

.sentinelWsShell{display:grid;gap:10px;min-width:0}
.sentinelWsCommand{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 14px;border:1px solid rgba(197,166,95,.18);border-radius:11px;background:radial-gradient(circle at 0 0,rgba(197,166,95,.075),transparent 38%),linear-gradient(90deg,rgba(197,166,95,.035),rgba(7,18,27,.22))}
.sentinelWsCommand>div:first-child{min-width:0}
.sentinelWsCommand span,.sentinelWsSectionHead span,.sentinelWsPanelHead span,.sentinelWsInfoGrid span,.sentinelWsFooter span,.sentinelWsProvenanceGrid span,.sentinelWsPeople span{display:block;color:#bea66e;font-size:6px;font-weight:900;letter-spacing:.1em}
.sentinelWsCommand strong{display:block;margin-top:4px;color:#e7e4dc;font-family:Georgia,serif;font-size:15px;font-weight:500}
.sentinelWsCommand p{max-width:850px;margin:5px 0 0;color:#7d9098;font-size:7.5px;line-height:1.55}
.sentinelWsCommandActions{display:flex;align-items:center;gap:7px;flex:0 0 auto}
.sentinelWsCommandActions button,.sentinelWsDetailHead>button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:7px 10px;border:1px solid rgba(197,166,95,.2);border-radius:7px;background:rgba(197,166,95,.045);color:#d1b878;font-size:7px;font-weight:900;cursor:pointer}
.sentinelWsCommandActions button:hover,.sentinelWsDetailHead>button:hover{border-color:rgba(197,166,95,.38);background:rgba(197,166,95,.08)}
.sentinelWsDetailHead>button:disabled{opacity:.4;cursor:not-allowed}
.sentinelWsSafety,.sentinelWsAuto{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid rgba(95,211,166,.2);border-radius:999px;background:rgba(95,211,166,.045);color:#89ddb8;font-size:6px;font-weight:900;letter-spacing:.065em}
.sentinelWsAuto{border-color:rgba(197,166,95,.16);background:rgba(197,166,95,.035);color:#cbb273}
.sentinelWsMessage{padding:8px 10px;border:1px solid rgba(197,166,95,.12);border-radius:8px;background:rgba(197,166,95,.025);color:#91a7b0;font-size:7px}
.sentinelWsStats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
.sentinelWsStats>div{min-width:0;padding:9px 10px;border:1px solid rgba(110,154,179,.11);border-radius:8px;background:rgba(5,17,25,.28)}
.sentinelWsStats span{display:block;color:#718891;font-size:5.8px;font-weight:900;letter-spacing:.08em}
.sentinelWsStats strong{display:block;margin-top:4px;color:#dce9ee;font-size:16px}
.sentinelWsStats small{display:block;margin-top:2px;color:#55717d;font-size:6px}
.sentinelWsFilterBar{display:flex;gap:6px;flex-wrap:wrap}
.sentinelWsFilterBar button{padding:6px 8px;border:1px solid rgba(110,154,179,.11);border-radius:999px;background:rgba(255,255,255,.008);color:#698895;font-size:6px;font-weight:850;cursor:pointer}
.sentinelWsFilterBar button:hover,.sentinelWsFilterActive{border-color:rgba(197,166,95,.25)!important;background:rgba(197,166,95,.055)!important;color:#d1b878!important}
.sentinelWsGrid{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(0,1.8fr);gap:9px;min-width:0}
.sentinelWsQueue,.sentinelWsDetail{min-width:0;min-height:430px;padding:11px;border:1px solid rgba(110,154,179,.12);border-radius:10px;background:rgba(5,16,24,.32)}
.sentinelWsSectionHead,.sentinelWsPanelHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
.sentinelWsSectionHead strong,.sentinelWsPanelHead strong{display:block;margin-top:3px;color:#d2e1e7;font-size:9px;font-weight:700}
.sentinelWsSectionHead small{color:#536f7a;font-size:6px}
.sentinelWsQueueList{max-height:650px;overflow:auto;padding-right:2px}
.sentinelWsQueueList>button{width:100%;display:block;margin-bottom:6px;padding:9px;border:1px solid rgba(110,154,179,.1);border-radius:8px;background:rgba(9,27,38,.46);color:inherit;text-align:left;cursor:pointer}
.sentinelWsQueueList>button:hover,.sentinelWsQueueActive{border-color:rgba(197,166,95,.25)!important;background:rgba(197,166,95,.04)!important}
.sentinelWsQueueTop{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sentinelWsQueueTop>span,.sentinelWsDecisionRow>span{padding:4px 6px;border-radius:999px;font-size:5.5px;font-weight:900;letter-spacing:.045em}
.sentinelWsQueueTop small{color:#52717f;font-size:5.5px}
.sentinelWsQueueList>button>strong{display:block;margin-top:7px;overflow:hidden;color:#d4e2e8;font-size:8px;text-overflow:ellipsis;white-space:nowrap}
.sentinelWsQueueList>button>p{margin:3px 0 0;color:#6a8997;font-size:6.5px}
.sentinelWsQueueMeta{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
.sentinelWsQueueMeta em{padding:3px 5px;border:1px solid rgba(110,154,179,.09);border-radius:5px;color:#638493;font-size:5.3px;font-style:normal;font-weight:800;text-transform:uppercase}
.sentinelWsGood{color:#83deb5!important;border:1px solid rgba(95,211,166,.19)!important;background:rgba(95,211,166,.045)!important}
.sentinelWsBlocked{color:#e69a92!important;border:1px solid rgba(214,119,112,.2)!important;background:rgba(214,119,112,.045)!important}
.sentinelWsHold{color:#dfbd74!important;border:1px solid rgba(226,187,103,.2)!important;background:rgba(226,187,103,.045)!important}
.sentinelWsRouting{color:#8dc8df!important;border:1px solid rgba(111,184,244,.2)!important;background:rgba(111,184,244,.04)!important}
.sentinelWsReview{color:#cca0df!important;border:1px solid rgba(183,122,209,.2)!important;background:rgba(183,122,209,.04)!important}
.sentinelWsDetailHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid rgba(110,154,179,.08)}
.sentinelWsDetailHead span{color:#bea66e;font-size:6px;font-weight:900;letter-spacing:.1em}
.sentinelWsDetailHead h3{margin:4px 0 0;color:#e1e9ed;font-family:Georgia,serif;font-size:16px;font-weight:500}
.sentinelWsDetailHead p{margin:4px 0 0;color:#668692;font-size:7px}
.sentinelWsDecisionRow{display:flex;gap:6px;flex-wrap:wrap;padding:9px 0}
.sentinelWsHumanGate{color:#d4b973;border:1px solid rgba(197,166,95,.18);background:rgba(197,166,95,.04)}
.sentinelWsNoAuto{color:#8da8b4;border:1px solid rgba(110,154,179,.12);background:rgba(110,154,179,.02)}
.sentinelWsInfoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.sentinelWsInfoGrid>div{min-width:0;padding:8px 9px;border:1px solid rgba(110,154,179,.09);border-radius:7px;background:rgba(255,255,255,.006)}
.sentinelWsInfoGrid strong{display:block;margin-top:4px;color:#cfdee4;font-size:8px;text-transform:capitalize}
.sentinelWsInfoGrid small{display:block;margin-top:3px;color:#536f7b;font-size:5.8px}
.sentinelWsPanels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
.sentinelWsPanels>section,.sentinelWsProvenance,.sentinelWsPeople{min-width:0;padding:9px;border:1px solid rgba(110,154,179,.09);border-radius:8px;background:rgba(7,22,31,.36)}
.sentinelWsCheckList{display:grid;gap:5px}
.sentinelWsCheckList>div{display:flex;align-items:center;gap:6px;padding:6px 7px;border-radius:6px;font-size:6.3px;text-transform:capitalize}
.sentinelWsCheckBad{color:#d99a94;border:1px solid rgba(214,119,112,.12);background:rgba(214,119,112,.025)}
.sentinelWsCheckGood{color:#86cdb0;border:1px solid rgba(95,211,166,.11);background:rgba(95,211,166,.022)}
.sentinelWsDefinitionList{margin:0}
.sentinelWsDefinitionList>div{display:grid;grid-template-columns:minmax(90px,.8fr) minmax(0,1.2fr);gap:8px;padding:6px 0;border-top:1px solid rgba(110,154,179,.065)}
.sentinelWsDefinitionList dt{color:#607f8d;font-size:6px}
.sentinelWsDefinitionList dd{margin:0;color:#b8ccd4;font-size:6.5px;text-align:right;overflow-wrap:anywhere}
.sentinelWsProvenance{margin-top:8px}
.sentinelWsProvenanceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.sentinelWsProvenanceGrid>div{min-width:0;padding:7px;border-top:1px solid rgba(110,154,179,.06)}
.sentinelWsProvenanceGrid code,.sentinelWsProvenanceGrid strong{display:block;margin-top:4px;overflow:hidden;color:#9eb6c0;font-family:inherit;font-size:6.2px;text-overflow:ellipsis;white-space:nowrap}
.sentinelWsPeople{margin-top:8px}
.sentinelWsPeopleList{display:grid;gap:6px}
.sentinelWsPeopleList article{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:7px;padding:8px;border:1px solid rgba(110,154,179,.08);border-radius:7px;background:rgba(255,255,255,.006)}
.sentinelWsPeopleList article strong{display:block;margin-top:3px;color:#b7cbd3;font-size:6.5px;text-transform:capitalize}
.sentinelWsMuted{margin:0;color:#58737e;font-size:6.5px}
.sentinelWsFooter{display:grid;grid-template-columns:1fr 1fr .7fr;gap:7px;margin-top:8px}
.sentinelWsFooter>div{min-width:0;padding:7px 8px;border-top:1px solid rgba(110,154,179,.07)}
.sentinelWsFooter code,.sentinelWsFooter strong{display:block;margin-top:4px;overflow:hidden;color:#7f9da9;font-size:6px;font-family:inherit;text-overflow:ellipsis;white-space:nowrap}
.sentinelWsEmpty,.sentinelWsEmptyLarge{display:grid;place-items:center;min-height:180px;padding:18px;text-align:center;color:#55747f}
.sentinelWsEmptyLarge{min-height:420px}
.sentinelWsEmpty strong,.sentinelWsEmptyLarge strong{display:block;margin-top:7px;color:#8ba7b2;font-size:8px}
.sentinelWsEmpty p,.sentinelWsEmptyLarge p{max-width:440px;margin:4px 0 0;color:#57737e;font-size:6.5px;line-height:1.5}

/* Pulse card Sentinel final report */
.pulseSentinelReport{grid-column:1/-1;margin-top:7px;padding:8px;border:1px solid rgba(197,166,95,.13);border-radius:8px;background:rgba(197,166,95,.025)}
.pulseSentinelReportHead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.pulseSentinelReportHead span{display:block;color:#a8915e;font-size:5.3px;font-weight:900;letter-spacing:.08em}
.pulseSentinelReportHead strong{display:block;margin-top:3px;color:#d5dddF;font-size:7px;text-transform:capitalize}
.pulseSentinelReportHead em{padding:4px 6px;border-radius:999px;font-size:5.2px;font-style:normal;font-weight:900;text-transform:uppercase}
.pulseSentinelGood{color:#83deb5;border:1px solid rgba(95,211,166,.16);background:rgba(95,211,166,.035)}
.pulseSentinelBlocked{color:#e39891;border:1px solid rgba(214,119,112,.17);background:rgba(214,119,112,.035)}
.pulseSentinelHold{color:#dfbd74;border:1px solid rgba(226,187,103,.16);background:rgba(226,187,103,.035)}
.pulseSentinelReportGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:7px}
.pulseSentinelReportGrid>div{padding:6px;border-top:1px solid rgba(110,154,179,.06)}
.pulseSentinelReportGrid span{display:block;color:#607f8a;font-size:5.1px;font-weight:900}
.pulseSentinelReportGrid strong{display:block;margin-top:3px;color:#a9c0c9;font-size:6px;text-transform:capitalize}
.pulseSentinelBlockers{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.pulseSentinelBlockers span{padding:4px 5px;border-radius:999px;border:1px solid rgba(214,119,112,.12);background:rgba(214,119,112,.025);color:#c7948f;font-size:5.1px;text-transform:capitalize}

@media(max-width:1050px){
  .sentinelWsStats{grid-template-columns:repeat(3,minmax(0,1fr))}
  .sentinelWsGrid{grid-template-columns:1fr}
  .sentinelWsQueue{min-height:0}
  .sentinelWsQueueList{max-height:330px}
  .pulseSentinelReportGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
}

@media(max-width:760px){
  .sentinelWsCommand,.sentinelWsDetailHead{align-items:flex-start;flex-direction:column}
  .sentinelWsCommandActions{flex-wrap:wrap}
  .sentinelWsStats,.sentinelWsInfoGrid,.sentinelWsPanels,.sentinelWsFooter,.sentinelWsProvenanceGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .sentinelWsPeopleList article{grid-template-columns:1fr}
}

@media(max-width:520px){
  .sentinelWsStats,.sentinelWsInfoGrid,.sentinelWsPanels,.sentinelWsFooter,.sentinelWsProvenanceGrid,.pulseSentinelReportGrid{grid-template-columns:1fr}
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
  "Applied Sentinel expanded workstation + Pulse final-review report."
);

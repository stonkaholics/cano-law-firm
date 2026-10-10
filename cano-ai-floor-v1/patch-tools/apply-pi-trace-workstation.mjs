import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "app", "personal-injury", "page.tsx");
const cssPath = path.join(process.cwd(), "app", "personal-injury", "personal-injury.module.css");

if (!fs.existsSync(pagePath)) throw new Error("Trace workstation patch: page.tsx not found.");
if (!fs.existsSync(cssPath)) throw new Error("Trace workstation patch: CSS not found.");

let source = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

const MARKER = "TRACE_WORKSTATION_V1";

function replaceRequired(input, find, replacement, label) {
  if (!input.includes(find)) {
    throw new Error("Trace workstation patch: anchor not found for " + label);
  }
  return input.replace(find, replacement);
}

/*
|--------------------------------------------------------------------------
| Dedicated Trace expanded workstation
|--------------------------------------------------------------------------
*/

if (!source.includes("<TraceWorkstation")) {
  const recordsAnchor =
`              ) : selectedAgent.id === "records" ? (
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

  const replacement =
`              ) : selectedAgent.id === "records" ? (
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
              ) : selectedAgent.id === "trace" ? (
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

  source = replaceRequired(source, recordsAnchor, replacement, "Trace expanded route");
}

/*
|--------------------------------------------------------------------------
| Disable generic header Run for Trace, same as Records.
|--------------------------------------------------------------------------
*/

source = source.replace(
  `["medintel", "records"].includes(selectedAgent.id) ||
                    selectedAgent.runnable === false`,
  `["medintel", "records", "trace"].includes(selectedAgent.id) ||
                    selectedAgent.runnable === false`
);

source = source.replace(
  `["medintel", "records"].includes(selectedAgent.id) || selectedAgent.runnable === false
                      ? undefined`,
  `["medintel", "records", "trace"].includes(selectedAgent.id) || selectedAgent.runnable === false
                      ? undefined`
);

source = source.replace(
  `: selectedAgent.id === "records"
                    ? "Use Records Queue Below"`,
  `: selectedAgent.id === "records"
                    ? "Use Records Queue Below"
                    : selectedAgent.id === "trace"
                    ? "Use Trace Queue Below"`
);

/*
|--------------------------------------------------------------------------
| Trace workstation component
|--------------------------------------------------------------------------
*/

if (!source.includes("/* " + MARKER + " */")) {
  const anchor = "function MedIntelWorkstation() {";

  const component = `/* ${MARKER} */
function TraceWorkstation({
  incidents,
  incidentIntelligence,
  incidentPeople,
  reportResearchTasks,
  runningAgent,
  agentMessage,
  onRunTrace,
  onRefresh,
}: {
  incidents: IncidentWatch[];
  incidentIntelligence: IncidentIntelligence[];
  incidentPeople: IncidentPerson[];
  reportResearchTasks?: ReportResearchTask[];
  runningAgent: string | null;
  agentMessage: string;
  onRunTrace: (incidentId: string, taskId?: string) => void;
  onRefresh: () => void;
}) {
  const [selectedIncidentId, setSelectedIncidentId] =
    useState<string>("");

  const [filter, setFilter] =
    useState<
      "all" |
      "ready" |
      "verified" |
      "records" |
      "review"
    >("all");

  const [stablePeople, setStablePeople] =
    useState<IncidentPerson[]>(
      incidentPeople || []
    );

  const [stableIntelligence, setStableIntelligence] =
    useState<IncidentIntelligence[]>(
      incidentIntelligence || []
    );

  const [stableTasks, setStableTasks] =
    useState<ReportResearchTask[]>(
      reportResearchTasks || []
    );

  useEffect(() => {
    if (
      Array.isArray(incidentPeople) &&
      incidentPeople.length > 0
    ) {
      setStablePeople(incidentPeople);
    }
  }, [incidentPeople]);

  useEffect(() => {
    if (
      Array.isArray(incidentIntelligence) &&
      incidentIntelligence.length > 0
    ) {
      setStableIntelligence(
        incidentIntelligence
      );
    }
  }, [incidentIntelligence]);

  useEffect(() => {
    if (
      Array.isArray(reportResearchTasks) &&
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
      window.clearInterval(timer);
  }, []);

  const peopleByIncident = useMemo(() => {
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
        map.set(key, current);
      }
    );

    return map;
  }, [stablePeople]);

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

  const getTraceState = (
    incident: IncidentWatch
  ) => {
    const people =
      peopleByIncident.get(
        incident.id
      ) || [];

    const intel =
      intelligenceByIncident.get(
        incident.id
      );

    const task =
      latestTaskByIncident.get(
        incident.id
      );

    const officialReport =
      task?.result
        ?.official_report ||
      {};

    const recordsStatus =
      String(
        task?.result
          ?.records_status ||
        task?.research_context
          ?.records_status ||
        ""
      ).toLowerCase();

    const reportVerified =
      task?.status ===
        "official_report_found" ||
      recordsStatus ===
        "verified" ||
      officialReport.verified ===
        true;

    const parties =
      Array.isArray(
        officialReport.parties
      )
        ? officialReport.parties
        : [];

    const verifiedPeople =
      people.filter(
        (person) =>
          Boolean(
            String(
              person.identity_source ||
              ""
            ).trim()
          )
      );

    const ambiguousPeople =
      people.filter(
        (person) =>
          !String(
            person.identity_source ||
            ""
          ).trim()
      );

    if (
      verifiedPeople.length > 0
    ) {
      return "verified";
    }

    if (
      reportVerified &&
      parties.length > 0
    ) {
      return "ready";
    }

    if (
      ambiguousPeople.length > 0 ||
      String(
        intel?.identity_status ||
        ""
      ).toLowerCase().includes(
        "review"
      )
    ) {
      return "review";
    }

    return "records";
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
          getTraceState(
            incident
          ) === filter
      );
    }, [
      incidents,
      stablePeople,
      stableIntelligence,
      stableTasks,
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

  const selectedPeople =
    selectedIncident
      ? (
          peopleByIncident.get(
            selectedIncident.id
          ) || []
        )
      : [];

  const selectedIntel =
    selectedIncident
      ? intelligenceByIncident.get(
          selectedIncident.id
        ) || null
      : null;

  const selectedTask =
    selectedIncident
      ? latestTaskByIncident.get(
          selectedIncident.id
        ) || null
      : null;

  const selectedReport =
    selectedTask?.result
      ?.official_report ||
    {};

  const selectedParties =
    Array.isArray(
      selectedReport.parties
    )
      ? selectedReport.parties
      : [];

  const selectedState =
    selectedIncident
      ? getTraceState(
          selectedIncident
        )
      : "records";

  const verifiedIdentityCount =
    stablePeople.filter(
      (person) =>
        Boolean(
          String(
            person.identity_source ||
            ""
          ).trim()
        )
    ).length;

  const sourceReadyCount =
    incidents.filter(
      (incident) =>
        getTraceState(
          incident
        ) === "ready"
    ).length;

  const recordsRequiredCount =
    incidents.filter(
      (incident) =>
        getTraceState(
          incident
        ) === "records"
    ).length;

  const reviewCount =
    incidents.filter(
      (incident) =>
        getTraceState(
          incident
        ) === "review"
    ).length;

  const contactInSourceCount =
    stablePeople.filter(
      (person) =>
        Boolean(
          String(
            person.phone ||
            ""
          ).trim() ||
          String(
            person.email ||
            ""
          ).trim() ||
          String(
            person.mailing_address ||
            ""
          ).trim()
        )
    ).length;

  const stateClass = (
    state: string
  ) => {
    if (
      state === "verified"
    ) {
      return styles.traceWsStatusVerified;
    }

    if (
      state === "ready"
    ) {
      return styles.traceWsStatusReady;
    }

    if (
      state === "review"
    ) {
      return styles.traceWsStatusReview;
    }

    return styles.traceWsStatusRecords;
  };

  const stateLabel = (
    state: string
  ) => {
    if (
      state === "verified"
    ) {
      return "IDENTITY VERIFIED";
    }

    if (
      state === "ready"
    ) {
      return "SOURCE READY";
    }

    if (
      state === "review"
    ) {
      return "REVIEW REQUIRED";
    }

    return "RECORDS REQUIRED";
  };

  return (
    <div className={styles.traceWsShell}>
      <section className={styles.traceWsCommand}>
        <div>
          <span>
            VERIFIED PARTY RESOLUTION
          </span>
          <strong>
            Identity only after an authorized source supports it
          </strong>
          <p>
            Trace converts verified official-report parties into incident people,
            preserves source provenance, and sends uncertain identities to Sentinel.
            It does not promote a likely name into a verified identity.
          </p>
        </div>

        <div className={styles.traceWsCommandActions}>
          <div className={styles.traceWsSafetyBadge}>
            <ShieldCheck size={13} />
            SOURCE-VERIFIED
          </div>

          <div className={styles.traceWsAutoRefresh}>
            <Activity size={12} />
            AUTO · 6 SEC
          </div>

          <button
            type="button"
            onClick={onRefresh}
          >
            <RefreshCw size={13} />
            Refresh Trace
          </button>
        </div>
      </section>

      {agentMessage ? (
        <div className={styles.traceWsMessage}>
          {agentMessage}
        </div>
      ) : null}

      <section className={styles.traceWsStats}>
        <div>
          <span>VERIFIED IDENTITIES</span>
          <strong>
            {verifiedIdentityCount}
          </strong>
          <small>
            source-backed people
          </small>
        </div>

        <div>
          <span>SOURCE READY</span>
          <strong>
            {sourceReadyCount}
          </strong>
          <small>
            report has parties
          </small>
        </div>

        <div>
          <span>RECORDS REQUIRED</span>
          <strong>
            {recordsRequiredCount}
          </strong>
          <small>
            identity source missing
          </small>
        </div>

        <div>
          <span>REVIEW</span>
          <strong>
            {reviewCount}
          </strong>
          <small>
            ambiguous identity
          </small>
        </div>

        <div>
          <span>CONTACT IN SOURCE</span>
          <strong>
            {contactInSourceCount}
          </strong>
          <small>
            not externally enriched
          </small>
        </div>
      </section>

      <section className={styles.traceWsFilterBar}>
        {[
          ["all", "All"],
          ["ready", "Source Ready"],
          ["verified", "Verified"],
          ["records", "Records Required"],
          ["review", "Needs Review"],
        ].map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                filter === value
                  ? styles.traceWsFilterActive
                  : ""
              }
              onClick={() =>
                setFilter(
                  value as
                    | "all"
                    | "ready"
                    | "verified"
                    | "records"
                    | "review"
                )
              }
            >
              {label}
            </button>
          )
        )}
      </section>

      <div className={styles.traceWsGrid}>
        <section className={styles.traceWsQueue}>
          <div className={styles.traceWsSectionHead}>
            <div>
              <span>TRACE QUEUE</span>
              <strong>
                {queue.length} incident
                {queue.length === 1
                  ? ""
                  : "s"}
              </strong>
            </div>
            <small>
              official-source gate
            </small>
          </div>

          <div className={styles.traceWsQueueList}>
            {queue.length ? (
              queue.map(
                (incident) => {
                  const state =
                    getTraceState(
                      incident
                    );

                  const people =
                    peopleByIncident.get(
                      incident.id
                    ) || [];

                  const task =
                    latestTaskByIncident.get(
                      incident.id
                    );

                  return (
                    <button
                      key={incident.id}
                      type="button"
                      className={
                        selectedIncident
                          ?.id ===
                        incident.id
                          ? styles.traceWsQueueActive
                          : ""
                      }
                      onClick={() =>
                        setSelectedIncidentId(
                          incident.id
                        )
                      }
                    >
                      <div className={styles.traceWsQueueTop}>
                        <span
                          className={
                            stateClass(
                              state
                            )
                          }
                        >
                          {stateLabel(
                            state
                          )}
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

                      <div className={styles.traceWsQueueMeta}>
                        <em>
                          {people.length}
                          {" "}
                          PEOPLE
                        </em>

                        <em>
                          {task?.status
                            ? String(
                                task.status
                              ).replace(
                                /_/g,
                                " "
                              )
                            : "NO RECORD TASK"}
                        </em>
                      </div>
                    </button>
                  );
                }
              )
            ) : (
              <div className={styles.traceWsEmpty}>
                <UserRoundCheck size={22} />
                <strong>
                  No incidents in this Trace view.
                </strong>
                <p>
                  Change the filter or run Records on an incident first.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.traceWsDetail}>
          {selectedIncident ? (
            <>
              <div className={styles.traceWsDetailHead}>
                <div>
                  <span>
                    SELECTED IDENTITY TASK
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

                <div className={styles.traceWsDetailActions}>
                  <button
                    type="button"
                    disabled={
                      Boolean(
                        runningAgent
                      )
                    }
                    onClick={() =>
                      onRunTrace(
                        selectedIncident.id,
                        selectedTask?.id
                      )
                    }
                  >
                    {runningAgent ===
                    "trace" ? (
                      <RefreshCw
                        size={12}
                        className={
                          styles.spin
                        }
                      />
                    ) : (
                      <UserRoundCheck
                        size={12}
                      />
                    )}

                    {runningAgent ===
                    "trace"
                      ? "Running…"
                      : "Run Trace"}
                  </button>
                </div>
              </div>

              <div className={styles.traceWsStateRow}>
                <span
                  className={
                    stateClass(
                      selectedState
                    )
                  }
                >
                  {stateLabel(
                    selectedState
                  )}
                </span>

                <span
                  className={
                    selectedTask?.status ===
                    "official_report_found"
                      ? styles.traceWsStateGood
                      : styles.traceWsStatePending
                  }
                >
                  {selectedTask?.status ===
                  "official_report_found"
                    ? "REPORT VERIFIED"
                    : "REPORT NOT VERIFIED"}
                </span>

                <span
                  className={
                    selectedPeople.length
                      ? styles.traceWsStateGood
                      : styles.traceWsStateNeutral
                  }
                >
                  {selectedPeople.length
                    ? String(
                        selectedPeople.length
                      ) +
                      " PEOPLE STORED"
                    : "NO PEOPLE STORED"}
                </span>
              </div>

              <div className={styles.traceWsInfoGrid}>
                <div>
                  <span>IDENTITY STATUS</span>
                  <strong>
                    {String(
                      selectedIntel
                        ?.identity_status ||
                      selectedState
                    ).replace(
                      /_/g,
                      " "
                    )}
                  </strong>
                  <small>
                    intelligence state
                  </small>
                </div>

                <div>
                  <span>REPORT PARTIES</span>
                  <strong>
                    {selectedParties.length}
                  </strong>
                  <small>
                    parties in verified report
                  </small>
                </div>

                <div>
                  <span>STORED PEOPLE</span>
                  <strong>
                    {selectedPeople.length}
                  </strong>
                  <small>
                    incident people table
                  </small>
                </div>

                <div>
                  <span>REPORT #</span>
                  <strong>
                    {String(
                      selectedReport
                        .crash_report_number ||
                      selectedTask
                        ?.identifiers
                        ?.crash_report_number ||
                      "Pending"
                    )}
                  </strong>
                  <small>
                    official identifier
                  </small>
                </div>

                <div>
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
                </div>

                <div>
                  <span>NEXT ACTION</span>
                  <strong>
                    {selectedState ===
                    "records"
                      ? "Return to Records"
                      : selectedState ===
                        "review"
                      ? "Sentinel review"
                      : selectedState ===
                        "ready"
                      ? "Run Trace"
                      : "Sentinel review"}
                  </strong>
                  <small>
                    gated workflow
                  </small>
                </div>
              </div>

              <section className={styles.traceWsPeoplePanel}>
                <div className={styles.traceWsPanelHead}>
                  <div>
                    <span>VERIFIED / STORED PEOPLE</span>
                    <strong>
                      Source provenance stays attached to every person
                    </strong>
                  </div>
                </div>

                {selectedPeople.length ? (
                  <div className={styles.traceWsPeopleList}>
                    {selectedPeople.map(
                      (person) => {
                        const hasContact =
                          Boolean(
                            String(
                              person.phone ||
                              ""
                            ).trim() ||
                            String(
                              person.email ||
                              ""
                            ).trim() ||
                            String(
                              person.mailing_address ||
                              ""
                            ).trim()
                          );

                        const identityVerified =
                          Boolean(
                            String(
                              person.identity_source ||
                              ""
                            ).trim()
                          );

                        return (
                          <article
                            key={person.id}
                          >
                            <div className={styles.traceWsPersonHead}>
                              <div>
                                <span>
                                  {String(
                                    person.role ||
                                    "party"
                                  ).toUpperCase()}
                                </span>
                                <strong>
                                  {person.name ||
                                    "Unnamed party"}
                                </strong>
                              </div>

                              <em
                                className={
                                  identityVerified
                                    ? styles.traceWsIdentityVerified
                                    : styles.traceWsIdentityReview
                                }
                              >
                                {identityVerified
                                  ? "SOURCE VERIFIED"
                                  : "REVIEW"}
                              </em>
                            </div>

                            <div className={styles.traceWsPersonGrid}>
                              <div>
                                <span>PHONE</span>
                                <strong>
                                  {person.phone ||
                                    "Not in source"}
                                </strong>
                              </div>

                              <div>
                                <span>EMAIL</span>
                                <strong>
                                  {person.email ||
                                    "Not in source"}
                                </strong>
                              </div>

                              <div>
                                <span>ADDRESS</span>
                                <strong>
                                  {person.mailing_address ||
                                    "Not in source"}
                                </strong>
                              </div>

                              <div>
                                <span>CONTACT STATUS</span>
                                <strong>
                                  {hasContact
                                    ? "Present in source"
                                    : "No source contact"}
                                </strong>
                              </div>
                            </div>

                            <div className={styles.traceWsPersonFoot}>
                              <span>
                                Identity source:
                              </span>
                              <code>
                                {person.identity_source ||
                                  "Not recorded"}
                              </code>

                              <span>
                                Outreach:
                              </span>
                              <b>
                                {String(
                                  person.outreach_status ||
                                  "blocked"
                                ).replace(
                                  /_/g,
                                  " "
                                )}
                              </b>
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className={styles.traceWsEmptyCompact}>
                    <UserRoundCheck size={18} />
                    <div>
                      <strong>
                        No verified people saved yet.
                      </strong>
                      <p>
                        If Records has a verified report with parties, Run Trace to normalize and save those identities.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <div className={styles.traceWsPanels}>
                <section>
                  <div className={styles.traceWsPanelHead}>
                    <div>
                      <span>OFFICIAL REPORT SOURCE</span>
                      <strong>
                        Identity-bearing record
                      </strong>
                    </div>
                  </div>

                  <dl className={styles.traceWsDefinitionList}>
                    <div>
                      <dt>Report verified</dt>
                      <dd>
                        {selectedTask?.status ===
                        "official_report_found"
                          ? "Yes"
                          : "No"}
                      </dd>
                    </div>

                    <div>
                      <dt>Party count</dt>
                      <dd>
                        {selectedParties.length}
                      </dd>
                    </div>

                    <div>
                      <dt>Identity-bearing</dt>
                      <dd>
                        {selectedReport
                          .identity_bearing_source_available ===
                        true ||
                        selectedParties.length > 0
                          ? "Yes"
                          : "Not established"}
                      </dd>
                    </div>

                    <div>
                      <dt>Source URL</dt>
                      <dd>
                        {String(
                          selectedReport
                            .source_url ||
                          "Not recorded"
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <div className={styles.traceWsPanelHead}>
                    <div>
                      <span>TRACE GUARDRAILS</span>
                      <strong>
                        Verification boundaries
                      </strong>
                    </div>
                  </div>

                  <ul className={styles.traceWsGuardrails}>
                    <li>
                      No likely-name match becomes a verified person.
                    </li>
                    <li>
                      Contact details are preserved only when present in the authorized source.
                    </li>
                    <li>
                      External contact enrichment is not performed by this Trace stage.
                    </li>
                    <li>
                      Outreach stays blocked until downstream review.
                    </li>
                  </ul>
                </section>
              </div>

              <section className={styles.traceWsFooter}>
                <div>
                  <span>INCIDENT ID</span>
                  <code>
                    {selectedIncident.id}
                  </code>
                </div>

                <div>
                  <span>RECORD TASK</span>
                  <code>
                    {selectedTask?.id ||
                      "None"}
                  </code>
                </div>

                <div>
                  <span>RESEARCHED</span>
                  <strong>
                    {formatDateTime(
                      selectedIntel
                        ?.researched_at ||
                      selectedIntel
                        ?.updated_at
                    )}
                  </strong>
                </div>
              </section>
            </>
          ) : (
            <div className={styles.traceWsEmptyLarge}>
              <UserRoundCheck size={28} />
              <strong>
                Trace is ready.
              </strong>
              <p>
                Select an accident incident to inspect its identity-source readiness.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

`;

  source = replaceRequired(
    source,
    anchor,
    component + anchor,
    "TraceWorkstation component"
  );
}

/*
|--------------------------------------------------------------------------
| Trace CSS
|--------------------------------------------------------------------------
*/

if (!css.includes("TRACE WORKSTATION V1")) {
  css += `

/* =========================================================
   TRACE WORKSTATION V1
   ========================================================= */

.traceWsShell{display:grid;gap:10px;min-width:0}
.traceWsCommand{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 14px;border:1px solid rgba(112,199,190,.18);border-radius:11px;background:radial-gradient(circle at 0 0,rgba(112,199,190,.07),transparent 38%),linear-gradient(90deg,rgba(112,199,190,.035),rgba(7,18,27,.22))}
.traceWsCommand>div:first-child{min-width:0}
.traceWsCommand span,.traceWsSectionHead span,.traceWsPanelHead span,.traceWsInfoGrid span,.traceWsFooter span{display:block;color:#70bfb8;font-size:6px;font-weight:900;letter-spacing:.1em}
.traceWsCommand strong{display:block;margin-top:4px;color:#e1ebef;font-family:Georgia,serif;font-size:15px;font-weight:500}
.traceWsCommand p{max-width:830px;margin:5px 0 0;color:#73909d;font-size:7.5px;line-height:1.55}
.traceWsCommandActions{display:flex;align-items:center;gap:7px;flex:0 0 auto}
.traceWsCommandActions button,.traceWsDetailActions button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:7px 10px;border:1px solid rgba(112,199,190,.19);border-radius:7px;background:rgba(112,199,190,.045);color:#8dd2ca;font-size:7px;font-weight:900;cursor:pointer}
.traceWsCommandActions button:hover,.traceWsDetailActions button:hover{border-color:rgba(112,199,190,.34);background:rgba(112,199,190,.08)}
.traceWsDetailActions button:disabled{opacity:.4;cursor:not-allowed}
.traceWsSafetyBadge,.traceWsAutoRefresh{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid rgba(95,211,166,.22);border-radius:999px;background:rgba(95,211,166,.05);color:#89ddb8;font-size:6px;font-weight:900;letter-spacing:.065em}
.traceWsAutoRefresh{border-color:rgba(112,199,190,.17);background:rgba(112,199,190,.035);color:#7fc8c0}
.traceWsMessage{padding:8px 10px;border:1px solid rgba(112,199,190,.13);border-radius:8px;background:rgba(112,199,190,.025);color:#86abc0;font-size:7px}
.traceWsStats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
.traceWsStats>div{min-width:0;padding:9px 10px;border:1px solid rgba(110,154,179,.11);border-radius:8px;background:rgba(5,17,25,.28)}
.traceWsStats span{display:block;color:#688b9c;font-size:5.8px;font-weight:900;letter-spacing:.08em}
.traceWsStats strong{display:block;margin-top:4px;color:#dce9ee;font-size:16px}
.traceWsStats small{display:block;margin-top:2px;color:#55717d;font-size:6px}
.traceWsFilterBar{display:flex;gap:6px;flex-wrap:wrap;padding:2px 0}
.traceWsFilterBar button{padding:6px 8px;border:1px solid rgba(110,154,179,.11);border-radius:999px;background:rgba(255,255,255,.008);color:#698895;font-size:6px;font-weight:850;cursor:pointer}
.traceWsFilterBar button:hover,.traceWsFilterActive{border-color:rgba(112,199,190,.25)!important;background:rgba(112,199,190,.055)!important;color:#97d7cf!important}
.traceWsGrid{display:grid;grid-template-columns:minmax(250px,.72fr) minmax(0,1.75fr);gap:9px;min-width:0}
.traceWsQueue,.traceWsDetail{min-width:0;min-height:430px;padding:11px;border:1px solid rgba(110,154,179,.12);border-radius:10px;background:rgba(5,16,24,.32)}
.traceWsSectionHead,.traceWsPanelHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
.traceWsSectionHead strong,.traceWsPanelHead strong{display:block;margin-top:3px;color:#d2e1e7;font-size:9px;font-weight:700}
.traceWsSectionHead small{color:#536f7a;font-size:6px}
.traceWsQueueList{max-height:610px;overflow:auto;padding-right:2px}
.traceWsQueueList>button{width:100%;display:block;margin-bottom:6px;padding:9px;border:1px solid rgba(110,154,179,.1);border-radius:8px;background:rgba(9,27,38,.46);color:inherit;text-align:left;cursor:pointer}
.traceWsQueueList>button:hover,.traceWsQueueActive{border-color:rgba(112,199,190,.26)!important;background:rgba(112,199,190,.045)!important}
.traceWsQueueTop{display:flex;align-items:center;justify-content:space-between;gap:8px}
.traceWsQueueTop>span{padding:4px 6px;border-radius:999px;font-size:5.5px;font-weight:900;letter-spacing:.045em}
.traceWsQueueTop small{color:#52717f;font-size:5.5px}
.traceWsQueueList>button>strong{display:block;margin-top:7px;overflow:hidden;color:#d4e2e8;font-size:8px;text-overflow:ellipsis;white-space:nowrap}
.traceWsQueueList>button>p{margin:3px 0 0;color:#6a8997;font-size:6.5px;line-height:1.35}
.traceWsQueueMeta{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
.traceWsQueueMeta em{padding:3px 5px;border:1px solid rgba(110,154,179,.09);border-radius:5px;color:#638493;background:rgba(255,255,255,.007);font-size:5.3px;font-style:normal;font-weight:800;text-transform:uppercase}
.traceWsStatusVerified{color:#83deb5;border:1px solid rgba(95,211,166,.19);background:rgba(95,211,166,.045)}
.traceWsStatusReady{color:#8dd2ca;border:1px solid rgba(112,199,190,.2);background:rgba(112,199,190,.045)}
.traceWsStatusRecords{color:#dfbd74;border:1px solid rgba(226,187,103,.2);background:rgba(226,187,103,.045)}
.traceWsStatusReview{color:#cc9fdf;border:1px solid rgba(183,122,209,.2);background:rgba(183,122,209,.04)}
.traceWsDetailHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid rgba(110,154,179,.08)}
.traceWsDetailHead>div:first-child{min-width:0}
.traceWsDetailHead span{color:#70bfb8;font-size:6px;font-weight:900;letter-spacing:.1em}
.traceWsDetailHead h3{margin:4px 0 0;overflow:hidden;color:#e1e9ed;font-family:Georgia,serif;font-size:16px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}
.traceWsDetailHead p{margin:4px 0 0;color:#668692;font-size:7px}
.traceWsDetailActions{display:flex;gap:6px;flex:0 0 auto}
.traceWsStateRow{display:flex;gap:6px;flex-wrap:wrap;padding:9px 0}
.traceWsStateRow span{padding:4px 7px;border-radius:999px;font-size:5.8px;font-weight:900;letter-spacing:.055em}
.traceWsStateGood{color:#83deb5;border:1px solid rgba(95,211,166,.18);background:rgba(95,211,166,.04)}
.traceWsStatePending{color:#dfbd74;border:1px solid rgba(226,187,103,.18);background:rgba(226,187,103,.04)}
.traceWsStateNeutral{color:#7394a3;border:1px solid rgba(110,154,179,.11);background:rgba(255,255,255,.008)}
.traceWsInfoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.traceWsInfoGrid>div{min-width:0;padding:8px 9px;border:1px solid rgba(110,154,179,.09);border-radius:7px;background:rgba(255,255,255,.006)}
.traceWsInfoGrid strong{display:block;margin-top:4px;overflow:hidden;color:#cfdee4;font-size:8px;text-overflow:ellipsis;white-space:nowrap;text-transform:capitalize}
.traceWsInfoGrid small{display:block;margin-top:3px;color:#536f7b;font-size:5.8px}
.traceWsPeoplePanel{margin-top:9px;padding:9px;border:1px solid rgba(110,154,179,.09);border-radius:8px;background:rgba(7,22,31,.36)}
.traceWsPeopleList{display:grid;gap:7px}
.traceWsPeopleList article{padding:9px;border:1px solid rgba(110,154,179,.09);border-radius:8px;background:rgba(255,255,255,.007)}
.traceWsPersonHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.traceWsPersonHead span{display:block;color:#6e929f;font-size:5.5px;font-weight:900;letter-spacing:.08em}
.traceWsPersonHead strong{display:block;margin-top:3px;color:#d8e5e9;font-size:9px}
.traceWsPersonHead em{padding:4px 6px;border-radius:999px;font-size:5.3px;font-style:normal;font-weight:900}
.traceWsIdentityVerified{color:#83deb5;border:1px solid rgba(95,211,166,.18);background:rgba(95,211,166,.04)}
.traceWsIdentityReview{color:#dfbd74;border:1px solid rgba(226,187,103,.18);background:rgba(226,187,103,.04)}
.traceWsPersonGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:8px}
.traceWsPersonGrid>div{min-width:0;padding:6px;border-top:1px solid rgba(110,154,179,.07)}
.traceWsPersonGrid span{display:block;color:#5d7d89;font-size:5.3px}
.traceWsPersonGrid strong{display:block;margin-top:3px;overflow:hidden;color:#9fb8c1;font-size:6.2px;text-overflow:ellipsis;white-space:nowrap}
.traceWsPersonFoot{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:7px;color:#5f7e8a;font-size:5.5px}
.traceWsPersonFoot code{max-width:420px;overflow:hidden;color:#81a6b3;font-family:inherit;text-overflow:ellipsis;white-space:nowrap}
.traceWsPersonFoot b{color:#dfbd74;font-weight:800;text-transform:capitalize}
.traceWsPanels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
.traceWsPanels>section{min-width:0;padding:9px;border:1px solid rgba(110,154,179,.09);border-radius:8px;background:rgba(7,22,31,.36)}
.traceWsDefinitionList{margin:0}
.traceWsDefinitionList>div{display:grid;grid-template-columns:minmax(90px,.8fr) minmax(0,1.2fr);gap:8px;padding:6px 0;border-top:1px solid rgba(110,154,179,.065)}
.traceWsDefinitionList dt{color:#607f8d;font-size:6px}
.traceWsDefinitionList dd{margin:0;overflow-wrap:anywhere;color:#b8ccd4;font-size:6.5px;text-align:right}
.traceWsGuardrails{margin:0;padding-left:16px;color:#829da8;font-size:6.5px;line-height:1.55}
.traceWsGuardrails li+li{margin-top:4px}
.traceWsFooter{display:grid;grid-template-columns:1fr 1fr .7fr;gap:7px;margin-top:8px}
.traceWsFooter>div{min-width:0;padding:7px 8px;border-top:1px solid rgba(110,154,179,.07)}
.traceWsFooter code,.traceWsFooter strong{display:block;margin-top:4px;overflow:hidden;color:#7f9da9;font-size:6px;font-family:inherit;text-overflow:ellipsis;white-space:nowrap}
.traceWsEmpty,.traceWsEmptyLarge{display:grid;place-items:center;min-height:170px;padding:18px;text-align:center;color:#55747f}
.traceWsEmptyLarge{min-height:400px}
.traceWsEmptyCompact{display:flex;align-items:center;gap:10px;min-height:70px;padding:10px;color:#55747f}
.traceWsEmpty svg,.traceWsEmptyLarge svg,.traceWsEmptyCompact svg{color:#6aa89f}
.traceWsEmpty strong,.traceWsEmptyLarge strong,.traceWsEmptyCompact strong{display:block;color:#8ba7b2;font-size:8px}
.traceWsEmpty p,.traceWsEmptyLarge p,.traceWsEmptyCompact p{max-width:440px;margin:4px 0 0;color:#57737e;font-size:6.5px;line-height:1.5}
@media(max-width:1050px){.traceWsStats{grid-template-columns:repeat(3,minmax(0,1fr))}.traceWsGrid{grid-template-columns:1fr}.traceWsQueue{min-height:0}.traceWsQueueList{max-height:330px}.traceWsPersonGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.traceWsCommand,.traceWsDetailHead{align-items:flex-start;flex-direction:column}.traceWsCommandActions,.traceWsDetailActions{flex-wrap:wrap}.traceWsStats,.traceWsInfoGrid,.traceWsPanels,.traceWsFooter{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.traceWsStats,.traceWsInfoGrid,.traceWsPanels,.traceWsFooter,.traceWsPersonGrid{grid-template-columns:1fr}}
`;
}

fs.writeFileSync(pagePath, source, "utf8");
fs.writeFileSync(cssPath, css, "utf8");

console.log("Applied Trace expanded workstation UI.");

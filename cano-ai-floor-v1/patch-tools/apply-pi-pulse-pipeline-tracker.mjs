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
    "Pulse pipeline tracker patch: page.tsx not found."
  );
}

if (!fs.existsSync(cssPath)) {
  throw new Error(
    "Pulse pipeline tracker patch: CSS not found."
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
  "PULSE_PIPELINE_TRACKER_V1";

function replaceRequired(
  input,
  find,
  replacement,
  label
) {
  if (!input.includes(find)) {
    throw new Error(
      "Pulse pipeline tracker patch: anchor not found for " +
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
| Pass report tasks into Pulse / LeadEngine
|--------------------------------------------------------------------------
*/

if (
  !source.includes(
    "reportResearchTasks={workspace.reportResearchTasks || []}"
  )
) {
  source =
    replaceRequired(
      source,
`            incidentSources={workspace.incidentSources}
            searchTerm={searchTerm}`,
`            incidentSources={workspace.incidentSources}
            reportResearchTasks={workspace.reportResearchTasks || []}
            searchTerm={searchTerm}`,
      "LeadEngine report tasks prop"
    );
}

if (
  !source.includes(
    "reportResearchTasks,\n  searchTerm,"
  )
) {
  source =
    replaceRequired(
      source,
`  incidentSources,
  searchTerm,`,
`  incidentSources,
  reportResearchTasks,
  searchTerm,`,
      "LeadEngine report tasks destructure"
    );
}

if (
  !source.includes(
    "reportResearchTasks: ReportResearchTask[];"
  )
) {
  source =
    replaceRequired(
      source,
`  incidentSources: IncidentSource[];
  searchTerm: string;`,
`  incidentSources: IncidentSource[];
  reportResearchTasks: ReportResearchTask[];
  searchTerm: string;`,
      "LeadEngine report tasks type"
    );
}

/*
|--------------------------------------------------------------------------
| Add Pulse-specific filter state
|--------------------------------------------------------------------------
*/

if (
  !source.includes(
    `/* ${MARKER} */`
  )
) {
  source =
    replaceRequired(
      source,
`  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;`,
`  /* ${MARKER} */
  const [pulseFilter, setPulseFilter] =
    useState<
      | "all"
      | "pulse"
      | "records"
      | "trace"
      | "sentinel"
      | "ready"
      | "hold"
      | "blocked"
    >("all");

  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;`,
      "Pulse filter state"
    );

  /*
  |--------------------------------------------------------------------------
  | Report task + pipeline helpers
  |--------------------------------------------------------------------------
  */

  source =
    replaceRequired(
      source,
`  const boolFromMeta = (value: any) => value === true || value === "true" || value === 1;`,
`  const latestReportTaskByIncident =
    new Map<
      string,
      ReportResearchTask
    >();

  [...reportResearchTasks]
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
          !latestReportTaskByIncident.has(
            task.incident_id
          )
        ) {
          latestReportTaskByIncident.set(
            task.incident_id,
            task
          );
        }
      }
    );

  const getSentinelMeta =
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

  const getVerifiedPeople =
    (
      incidentId: string
    ) =>
      (
        peopleByIncident.get(
          incidentId
        ) || []
      ).filter(
        (person) =>
          Boolean(
            String(
              person.name ||
              ""
            ).trim()
          ) &&
          Boolean(
            String(
              person.identity_source ||
              ""
            ).trim()
          )
      );

  const getPipelineState =
    (
      incident: IncidentWatch
    ) => {
      const task =
        latestReportTaskByIncident.get(
          incident.id
        );

      const sentinel =
        getSentinelMeta(
          incident.id
        );

      const decision =
        String(
          sentinel?.decision ||
          ""
        );

      const verifiedPeople =
        getVerifiedPeople(
          incident.id
        );

      const reportVerified =
        task?.status ===
          "official_report_found" ||
        task?.result?.records_status ===
          "verified" ||
        task?.result?.official_report
          ?.verified ===
          true;

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
        "records_required"
      ) {
        return "records";
      }

      if (
        decision ===
        "trace_required"
      ) {
        return "trace";
      }

      if (
        decision ===
          "review_required" ||
        decision ===
          "representation_review"
      ) {
        return "sentinel";
      }

      if (
        reportVerified &&
        verifiedPeople.length > 0
      ) {
        return "sentinel";
      }

      if (reportVerified) {
        return "trace";
      }

      if (task) {
        return "records";
      }

      return "pulse";
    };

  const getPipelineHistory =
    (
      incident: IncidentWatch
    ) => {
      const task =
        latestReportTaskByIncident.get(
          incident.id
        );

      const sentinel =
        getSentinelMeta(
          incident.id
        );

      const decision =
        String(
          sentinel?.decision ||
          ""
        );

      const verifiedPeople =
        getVerifiedPeople(
          incident.id
        );

      const reportVerified =
        task?.status ===
          "official_report_found" ||
        task?.result?.records_status ===
          "verified" ||
        task?.result?.official_report
          ?.verified ===
          true;

      const recordsRework =
        decision ===
        "records_required";

      const traceRework =
        decision ===
        "trace_required";

      return {
        current:
          getPipelineState(
            incident
          ),

        pulse:
          "done",

        records:
          recordsRework
            ? "rework"
            : reportVerified
            ? "done"
            : task
            ? "active"
            : "pending",

        trace:
          traceRework
            ? "rework"
            : verifiedPeople.length > 0
            ? "done"
            : reportVerified
            ? "active"
            : "pending",

        sentinel:
          decision
            ? "done"
            : verifiedPeople.length > 0
            ? "active"
            : "pending",

        sentinelDecision:
          decision,

        taskStatus:
          String(
            task?.status ||
            ""
          ),

        verifiedPeopleCount:
          verifiedPeople.length
      };
    };

  const pipelineLabel =
    (
      value: string
    ) => {
      const labels: Record<
        string,
        string
      > = {
        pulse:
          "Pulse Research",

        records:
          "Records",

        trace:
          "Trace",

        sentinel:
          "Sentinel Review",

        ready:
          "Ready Human Review",

        hold:
          "Timing Hold",

        blocked:
          "Blocked"
      };

      return (
        labels[value] ||
        value.replace(
          /_/g,
          " "
        )
      );
    };

  const boolFromMeta = (value: any) => value === true || value === "true" || value === 1;`,
      "Pulse pipeline helpers"
    );

  /*
  |--------------------------------------------------------------------------
  | Search + pipeline filter the incident inventory itself
  |--------------------------------------------------------------------------
  */

  source =
    replaceRequired(
      source,
`  const sortedIncidents = [...incidents].sort(
    (a, b) =>
      (incidentTime(b.occurred_at) || 0) -
      (incidentTime(a.occurred_at) || 0)
  );`,
`  const incidentSearchTerm =
    searchTerm
      .trim()
      .toLowerCase();

  const filteredIncidentInventory =
    incidents.filter(
      (incident) => {
        const intel =
          intelligenceByIncident.get(
            incident.id
          );

        const task =
          latestReportTaskByIncident.get(
            incident.id
          );

        const sentinel =
          getSentinelMeta(
            incident.id
          );

        const pipelineState =
          getPipelineState(
            incident
          );

        const matchesFilter =
          pulseFilter ===
            "all" ||
          pipelineState ===
            pulseFilter;

        if (!matchesFilter) {
          return false;
        }

        if (!incidentSearchTerm) {
          return true;
        }

        const haystack =
          [
            incident.source,
            incident.incident_type,
            incident.county,
            incident.location,
            intel?.investigating_agency,
            intel?.agency_case_number,
            intel?.crash_report_number,
            intel?.research_status,
            task?.status,
            task?.provider,
            sentinel?.decision,
            sentinel?.next_action,
            pipelineState
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return haystack.includes(
          incidentSearchTerm
        );
      }
    );

  const sortedIncidents = [...filteredIncidentInventory].sort(
    (a, b) =>
      (incidentTime(b.occurred_at) || 0) -
      (incidentTime(a.occurred_at) || 0)
  );`,
      "Pulse filtered incident inventory"
    );

  /*
  |--------------------------------------------------------------------------
  | Add pipeline history variables to each card
  |--------------------------------------------------------------------------
  */

  source =
    replaceRequired(
      source,
`    const reportAccessible = intel?.report_status === "public" || intel?.report_status === "available";

    return (`,
`    const reportAccessible = intel?.report_status === "public" || intel?.report_status === "available";

    const pipeline =
      getPipelineHistory(
        incident
      );

    const pipelineSteps = [
      {
        key:
          "pulse",
        label:
          "Pulse",
        status:
          pipeline.pulse
      },
      {
        key:
          "records",
        label:
          "Records",
        status:
          pipeline.records
      },
      {
        key:
          "trace",
        label:
          "Trace",
        status:
          pipeline.trace
      },
      {
        key:
          "sentinel",
        label:
          "Sentinel",
        status:
          pipeline.sentinel
      }
    ];

    return (`,
      "Pulse card pipeline variables"
    );

  /*
  |--------------------------------------------------------------------------
  | Add per-case agent history UI
  |--------------------------------------------------------------------------
  */

  source =
    replaceRequired(
      source,
`        <div className={styles.incidentDates}>`,
`        {!compact ? (
          <section className={styles.casePipelineTracker}>
            <div className={styles.casePipelineTrackerHead}>
              <div>
                <span>AGENT PROGRESS</span>
                <strong>
                  Current:
                  {" "}
                  {pipelineLabel(
                    pipeline.current
                  )}
                </strong>
              </div>

              {pipeline.sentinelDecision ? (
                <em>
                  Sentinel:
                  {" "}
                  {pipeline.sentinelDecision.replace(
                    /_/g,
                    " "
                  )}
                </em>
              ) : (
                <em>
                  {pipeline.taskStatus
                    ? "Records: " +
                      pipeline.taskStatus.replace(
                        /_/g,
                        " "
                      )
                    : "Pipeline started"}
                </em>
              )}
            </div>

            <div className={styles.casePipelineSteps}>
              {pipelineSteps.map(
                (
                  step,
                  index
                ) => (
                  <div
                    key={
                      step.key
                    }
                    className={
                      step.status ===
                        "done"
                        ? styles.casePipelineDone
                        : step.status ===
                          "active"
                        ? styles.casePipelineActive
                        : step.status ===
                          "rework"
                        ? styles.casePipelineRework
                        : styles.casePipelinePending
                    }
                  >
                    <span>
                      {index + 1}
                    </span>

                    <div>
                      <strong>
                        {step.label}
                      </strong>

                      <small>
                        {step.status ===
                          "done"
                          ? "Completed"
                          : step.status ===
                            "active"
                          ? "Current"
                          : step.status ===
                            "rework"
                          ? "Rework"
                          : "Pending"}
                      </small>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        ) : null}

        <div className={styles.incidentDates}>`,
      "Pulse case pipeline tracker UI"
    );

  /*
  |--------------------------------------------------------------------------
  | Replace irrelevant lead-stage filters with accident pipeline filters
  |--------------------------------------------------------------------------
  */

  const oldFilter =
`        <div className={styles.filterRow}>
          <Filter size={14} />
          <button
            className={filter === "all" ? styles.filterActive : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {leadStages.map((stage) => (
            <button
              key={stage.value}
              className={filter === stage.value ? styles.filterActive : ""}
              onClick={() => setFilter(stage.value)}
            >
              {stage.label}
            </button>
          ))}
        </div>`;

  const newFilter =
`        <div className={styles.filterRow}>
          <Filter size={14} />

          {[
            ["all", "All"],
            ["pulse", "Pulse"],
            ["records", "Records"],
            ["trace", "Trace"],
            ["sentinel", "Sentinel"],
            ["ready", "Ready"],
            ["hold", "Timing Hold"],
            ["blocked", "Blocked"],
          ].map(
            ([value, label]) => {
              const count =
                value === "all"
                  ? incidents.length
                  : incidents.filter(
                      (incident) =>
                        getPipelineState(
                          incident
                        ) === value
                    ).length;

              return (
                <button
                  key={value}
                  className={
                    pulseFilter ===
                    value
                      ? styles.filterActive
                      : ""
                  }
                  onClick={() =>
                    setPulseFilter(
                      value as
                        | "all"
                        | "pulse"
                        | "records"
                        | "trace"
                        | "sentinel"
                        | "ready"
                        | "hold"
                        | "blocked"
                    )
                  }
                >
                  {label}
                  <span className={styles.pulseFilterCount}>
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </div>`;

  source =
    replaceRequired(
      source,
      oldFilter,
      newFilter,
      "Pulse filters"
    );
}

/*
|--------------------------------------------------------------------------
| CSS
|--------------------------------------------------------------------------
*/

if (
  !css.includes(
    "PULSE PIPELINE TRACKER V1"
  )
) {
  css += `

/* =========================================================
   PULSE PIPELINE TRACKER V1
   ========================================================= */

.pulseFilterCount{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:17px;
  height:14px;
  margin-left:5px;
  padding:0 4px;
  border:1px solid rgba(110,154,179,.12);
  border-radius:999px;
  background:rgba(255,255,255,.018);
  color:#708c97;
  font-size:5.2px;
  font-weight:900
}

.filterActive .pulseFilterCount{
  border-color:rgba(95,211,166,.18);
  background:rgba(95,211,166,.06);
  color:#91d7ba
}

.casePipelineTracker{
  margin-top:8px;
  padding:9px;
  border:1px solid rgba(110,154,179,.1);
  border-radius:8px;
  background:
    linear-gradient(
      90deg,
      rgba(95,211,166,.018),
      rgba(111,184,244,.012)
    )
}

.casePipelineTrackerHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:8px
}

.casePipelineTrackerHead span{
  display:block;
  color:#6f929d;
  font-size:5.2px;
  font-weight:900;
  letter-spacing:.09em
}

.casePipelineTrackerHead strong{
  display:block;
  margin-top:3px;
  color:#b8ccd3;
  font-size:6.5px;
  font-weight:800
}

.casePipelineTrackerHead em{
  max-width:45%;
  overflow:hidden;
  color:#7f9eaa;
  font-size:5.6px;
  font-style:normal;
  font-weight:800;
  text-overflow:ellipsis;
  text-transform:capitalize;
  white-space:nowrap
}

.casePipelineSteps{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:6px
}

.casePipelineSteps>div{
  position:relative;
  display:flex;
  align-items:center;
  gap:7px;
  min-width:0;
  padding:7px;
  border:1px solid rgba(110,154,179,.085);
  border-radius:7px;
  background:rgba(255,255,255,.005)
}

.casePipelineSteps>div>span{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
  width:18px;
  height:18px;
  border-radius:50%;
  border:1px solid rgba(110,154,179,.14);
  color:#64828e;
  font-size:5.8px;
  font-weight:900
}

.casePipelineSteps>div>div{
  min-width:0
}

.casePipelineSteps strong{
  display:block;
  overflow:hidden;
  color:#92aab3;
  font-size:6px;
  text-overflow:ellipsis;
  white-space:nowrap
}

.casePipelineSteps small{
  display:block;
  margin-top:2px;
  color:#516c77;
  font-size:5.2px
}

.casePipelineDone{
  border-color:rgba(95,211,166,.13)!important;
  background:rgba(95,211,166,.022)!important
}

.casePipelineDone>span{
  border-color:rgba(95,211,166,.23)!important;
  background:rgba(95,211,166,.055)!important;
  color:#82d8b1!important
}

.casePipelineDone strong{
  color:#92c9b2!important
}

.casePipelineActive{
  border-color:rgba(111,184,244,.22)!important;
  background:rgba(111,184,244,.04)!important;
  box-shadow:
    inset 0 0 0 1px rgba(111,184,244,.025)
}

.casePipelineActive>span{
  border-color:rgba(111,184,244,.32)!important;
  background:rgba(111,184,244,.075)!important;
  color:#92cbed!important
}

.casePipelineActive strong{
  color:#a5cce0!important
}

.casePipelineRework{
  border-color:rgba(226,187,103,.22)!important;
  background:rgba(226,187,103,.04)!important
}

.casePipelineRework>span{
  border-color:rgba(226,187,103,.3)!important;
  background:rgba(226,187,103,.07)!important;
  color:#dfbd74!important
}

.casePipelineRework strong{
  color:#cfb375!important
}

.casePipelinePending{
  opacity:.68
}

@media(max-width:900px){
  .casePipelineSteps{
    grid-template-columns:repeat(2,minmax(0,1fr))
  }
}

@media(max-width:520px){
  .casePipelineTrackerHead{
    align-items:flex-start;
    flex-direction:column
  }

  .casePipelineTrackerHead em{
    max-width:100%
  }

  .casePipelineSteps{
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
  "Applied Pulse accident filters + per-case agent pipeline tracker."
);

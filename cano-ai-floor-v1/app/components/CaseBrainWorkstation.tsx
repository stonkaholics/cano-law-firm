"use client";

import {
  ArrowLeft,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileQuestion,
  GitBranch,
  ListChecks,
  MessageCircleQuestion,
  Route,
  UserRound,
  RefreshCw,
  Loader2,
} from "lucide-react";

export type CaseBrainResult = {
  schema_version?: string;
  matter?: {
    monday_item_id?: string;
    practice_area?: string | null;
    matter_type?: string | null;
    assigned_attorney?: string | null;
    status?: string | null;
  };
  people?: {
    detainee?: Record<string, unknown> | null;
    pnc?: Record<string, unknown> | null;
    other_people?: Record<string, unknown>[];
  };
  summary?: {
    brief?: string;
    detailed?: string;
  };
  key_facts?: Array<
    | string
    | {
        fact?: string;
        source?: string;
        confidence?: "confirmed" | "reported" | "unclear" | string;
      }
  >;
  timeline?: Array<
    | string
    | {
        date_or_period?: string;
        event?: string;
        source?: string;
      }
  >;
  issues?: Array<
    | string
    | {
        issue?: string;
        type?: string;
        source?: string;
      }
  >;
  missing_information?: string[];
  contradictions?: Array<
    | string
    | {
        description?: string;
        sources?: string[];
      }
  >;
  next_questions?: string[];
  routing?: {
    recommended_specialist?: string;
    reason?: string;
  };
  review_status?: {
    attorney_review_required?: boolean;
    ready_for_specialist?: boolean;
    blocking_items?: string[];
  };
};

export type StoredCaseMatter = {
  databaseId?: string;
  matterId: string;
  mondayItemId?: string;
  caseBrainStatus?: string;
  message?: string;
  savedAt?: string;
  monday?: {
    found?: boolean;
    fieldsImported?: number;
    preview?: {
      name?: string;
      detaineeName?: string;
      pncName?: string;
      practiceArea?: string;
    };
  };
  routing?: {
    target: string;
    routedBy?: string;
    routedAt?: string;
    assignmentId?: string | null;
    status?: string;
  } | null;
  pipeline?: {
    status?: string | null;
    stage?: string | null;
    nextAgent?: string | null;
    autoEnabled?: boolean;
  } | null;
  caseBrain: CaseBrainResult;
};

export default function CaseBrainWorkstation({
  matter,
  refreshing = false,
  onRefresh,
  onMatterUpdated,
  onOpenSpecialist,
  onClose,
}: {
  matter: StoredCaseMatter | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onMatterUpdated?: (matter: StoredCaseMatter) => void;
  onOpenSpecialist?: (agentId: string) => void;
  onClose: () => void;
}) {
  if (!matter) {
    return (
      <div className="casebrain-workstation">
        <Topbar onClose={onClose} status="Ready" />
        <div className="cb-empty">
          <Brain size={34} />
          <h2>No active Case Brain matter</h2>
          <p>
            Use Santiago → Assign Matter to send a Monday matter into Case Brain.
          </p>
        </div>
      </div>
    );
  }

  const cb = matter.caseBrain || {};
  const detainee = formatPerson(cb.people?.detainee);
  const pnc = formatPerson(cb.people?.pnc);
  const routing = cb.routing?.recommended_specialist || "unknown";

  const status = String(
    matter.caseBrainStatus ||
      cb.matter?.status ||
      "review_ready"
  );

  const isProcessing = status === "case_brain_processing";
  const isError = status === "case_brain_error";

  const hasSnapshot = Boolean(
    matter.caseBrain &&
      (
        cb.summary?.brief ||
        cb.summary?.detailed ||
        cb.people?.detainee ||
        cb.people?.pnc ||
        (cb.key_facts?.length || 0) > 0 ||
        (cb.timeline?.length || 0) > 0 ||
        (cb.issues?.length || 0) > 0 ||
        cb.routing ||
        cb.review_status
      )
  );

  const displayName =
    detainee ||
    matter.monday?.preview?.detaineeName ||
    matter.monday?.preview?.name ||
    `Matter ${matter.matterId}`;

  const practiceArea =
    cb.matter?.practice_area ||
    matter.monday?.preview?.practiceArea ||
    "—";

  const statusLabel = isProcessing
    ? "Case Brain Processing"
    : isError
    ? "Case Brain Error"
    : "Review Ready";

  async function toggleAutoPipeline() {
    const mondayItemId = matter.mondayItemId || matter.matterId;
    const enabled = matter.pipeline?.autoEnabled !== false;

    const res = await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_auto",
        mondayItemId,
        enabled: !enabled,
      }),
    });

    const data = await res.json();

    if (res.ok && data?.matter) {
      onMatterUpdated?.(data.matter);
    }
  }

  return (
    <div className="casebrain-workstation">
      <Topbar onClose={onClose} status={statusLabel} />

      <div className="cb-shell">
        <section className="cb-hero">
          <div>
            <div className="cb-kicker">ACTIVE MATTER · CASE BRAIN</div>
            <h1>{displayName}</h1>
            <p>
              {isProcessing
                ? "Case Brain is analyzing this matter."
                : isError
                ? "Case Brain encountered an issue while analyzing this matter."
                : cb.summary?.brief ||
                  matter.message ||
                  "Matter analysis ready for review."}
            </p>
          </div>

          <div>
            <div className="cb-hero-stats">
              <Stat
                label="Monday Item"
                value={
                  cb.matter?.monday_item_id ||
                  matter.mondayItemId ||
                  matter.matterId
                }
              />
              <Stat label="Practice Area" value={practiceArea} />
              <Stat
                label="Next Route"
                value={hasSnapshot ? routingLabel(routing) : "Pending"}
              />
              <Stat
                label="Saved"
                value={
                  isProcessing && !hasSnapshot
                    ? "Processing"
                    : formatSaved(matter.savedAt)
                }
              />
            </div>

            <div className="cb-hero-actions">
              <button
                className="cb-refresh-btn"
                disabled={refreshing || !onRefresh}
                onClick={onRefresh}
              >
                <RefreshCw
                  className={refreshing ? "spin" : ""}
                  size={16}
                />
                {refreshing
                  ? "Refreshing Analysis..."
                  : "Refresh from Monday"}
              </button>
              <span>
                Re-pulls this exact Monday matter and reruns Case Brain using the
                latest intake data.
              </span>
            </div>
          </div>
        </section>

        <section className="cb-pipeline-card">
          <div className="cb-pipeline-head">
            <div>
              <span className="cb-kicker">AUTOMATED CASE PIPELINE</span>
              <h3>
                {matter.pipeline?.stage
                  ? pipelineStageLabel(matter.pipeline.stage)
                  : isProcessing
                  ? "Case Brain"
                  : "Awaiting Next Step"}
              </h3>
            </div>

            <button
              className={`pipeline-toggle ${
                matter.pipeline?.autoEnabled !== false ? "enabled" : ""
              }`}
              onClick={toggleAutoPipeline}
            >
              {matter.pipeline?.autoEnabled !== false
                ? "Auto Routing On"
                : "Manual Routing"}
            </button>
          </div>

          <div className="cb-pipeline-flow">
            <PipelineNode
              label="Case Brain"
              active={
                isProcessing ||
                matter.pipeline?.stage === "case_brain"
              }
              done={
                hasSnapshot &&
                matter.pipeline?.stage !== "case_brain"
              }
            />
            <PipelineArrow />
            <PipelineNode
              label="Lex Research"
              active={matter.pipeline?.stage === "research"}
              done={pipelinePast(matter.pipeline?.stage, "research")}
            />
            <PipelineArrow />
            <PipelineNode
              label="Primary Specialist"
              sublabel="Elena / Mateo"
              active={
                matter.pipeline?.stage === "habeas" ||
                matter.pipeline?.stage === "bond"
              }
              done={pipelinePast(matter.pipeline?.stage, "primary")}
            />
            <PipelineArrow />
            <PipelineNode
              label="Chronos"
              active={matter.pipeline?.stage === "timeline"}
              done={pipelinePast(matter.pipeline?.stage, "timeline")}
            />
            <PipelineArrow />
            <PipelineNode
              label="Avery"
              active={matter.pipeline?.stage === "hearing_prep"}
              done={pipelinePast(matter.pipeline?.stage, "hearing_prep")}
            />
            <PipelineArrow />
            <PipelineNode
              label="Attorney Review"
              active={matter.pipeline?.stage === "attorney_review"}
              done={false}
            />
          </div>

          <div className="cb-pipeline-next">
            <div>
              <span>NEXT STEP</span>
              <strong>
                {pipelineNextLabel(
                  matter.pipeline?.stage,
                  matter.pipeline?.nextAgent,
                  cb.routing?.recommended_specialist
                )}
              </strong>
            </div>

            {matter.pipeline?.nextAgent && onOpenSpecialist ? (
              <button
                onClick={() =>
                  onOpenSpecialist(matter.pipeline?.nextAgent || "")
                }
              >
                Open Next Agent
              </button>
            ) : matter.pipeline?.stage === "attorney_review" ? (
              <span className="attorney-gate">Attorney Review Required</span>
            ) : null}
          </div>

          <p className="cb-pipeline-copy">
            Automatic mode uses Case Brain routing to sequence the matter.
            Immigration matters run through Lex first, then the primary
            specialist, Chronos, Avery, and finally attorney review. The
            pipeline pauses when a specialist reports blocking information.
          </p>
        </section>

        {isProcessing && !hasSnapshot ? (
          <ProcessingState />
        ) : isError && !hasSnapshot ? (
          <ErrorState />
        ) : (
          <section className="cb-grid">
            <div className="cb-main">
              <Card icon={<Brain size={18} />} title="Matter Summary">
                <p className="cb-detailed">
                  {cb.summary?.detailed ||
                    "No detailed summary returned."}
                </p>
              </Card>

              <Card icon={<ListChecks size={18} />} title="Key Facts">
                <div className="cb-list">
                  {(cb.key_facts || []).map((fact, i) => {
                    if (typeof fact === "string") {
                      return (
                        <div className="cb-fact" key={i}>
                          <span className="confidence reported">
                            REPORTED
                          </span>
                          <div>
                            <strong>{fact}</strong>
                            <small>legacy Case Brain output</small>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="cb-fact" key={i}>
                        <span
                          className={`confidence ${
                            fact.confidence || "unclear"
                          }`}
                        >
                          {(fact.confidence || "unclear").toUpperCase()}
                        </span>
                        <div>
                          <strong>{fact.fact || "Fact"}</strong>
                          <small>
                            {fact.source || "source unavailable"}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card icon={<Clock3 size={18} />} title="Timeline">
                <div className="cb-timeline">
                  {(cb.timeline || []).map((entry, i) => {
                    if (typeof entry === "string") {
                      return (
                        <div className="timeline-row" key={i}>
                          <div className="timeline-dot" />
                          <div>
                            <strong>{entry}</strong>
                            <small>legacy Case Brain output</small>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="timeline-row" key={i}>
                        <div className="timeline-dot" />
                        <div>
                          <strong>
                            {entry.date_or_period || "Date unclear"}
                          </strong>
                          <p>{entry.event}</p>
                          <small>
                            {entry.source || "source unavailable"}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card
                icon={<GitBranch size={18} />}
                title="Issues for Review"
              >
                <div className="cb-simple-list">
                  {(cb.issues || []).map((issue, i) => (
                    <div key={i}>
                      <strong>
                        {typeof issue === "string"
                          ? "Issue"
                          : (issue.type || "issue").toUpperCase()}
                      </strong>
                      <span>
                        {typeof issue === "string"
                          ? issue
                          : issue.issue}
                      </span>
                      {typeof issue !== "string" && issue.source && (
                        <small>{issue.source}</small>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <aside className="cb-side">
              <Card icon={<UserRound size={18} />} title="People">
                <Info
                  label="Detainee"
                  value={detainee || "—"}
                />
                <Info label="PNC" value={pnc || "—"} />
                <Info
                  label="Other People"
                  value={String(
                    cb.people?.other_people?.length || 0
                  )}
                />
              </Card>

              <Card icon={<Route size={18} />} title="Routing">
                <div className="route-badge">
                  {routingLabel(routing)}
                </div>
                <p className="side-copy">
                  {cb.routing?.reason ||
                    "No routing reason returned."}
                </p>
              </Card>

              <Card
                icon={<FileQuestion size={18} />}
                title="Missing Information"
              >
                <div className="number-badge">
                  {cb.missing_information?.length || 0}
                </div>
                <ul className="cb-ul">
                  {(cb.missing_information || []).map(
                    (item, i) => (
                      <li key={i}>{item}</li>
                    )
                  )}
                </ul>
              </Card>

              <Card
                icon={<AlertTriangle size={18} />}
                title="Contradictions"
              >
                <div className="number-badge warning">
                  {cb.contradictions?.length || 0}
                </div>
                <ul className="cb-ul">
                  {(cb.contradictions || []).map((item, i) => (
                    <li key={i}>
                      {typeof item === "string"
                        ? item
                        : item.description}
                      {typeof item !== "string" &&
                      item.sources?.length ? (
                        <small>
                          {item.sources.join(" · ")}
                        </small>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card
                icon={<MessageCircleQuestion size={18} />}
                title="Next Questions"
              >
                <ul className="cb-ul">
                  {(cb.next_questions || []).map(
                    (item, i) => (
                      <li key={i}>{item}</li>
                    )
                  )}
                </ul>
              </Card>

              <Card
                icon={<CheckCircle2 size={18} />}
                title="Review Status"
              >
                <Info
                  label="Attorney Review"
                  value={
                    cb.review_status?.attorney_review_required
                      ? "Required"
                      : "Not Required"
                  }
                />
                <Info
                  label="Ready for Specialist"
                  value={
                    cb.review_status?.ready_for_specialist
                      ? "Yes"
                      : "No"
                  }
                />
                {(cb.review_status?.blocking_items || [])
                  .length > 0 && (
                  <>
                    <div className="cb-subtitle">
                      BLOCKING ITEMS
                    </div>
                    <ul className="cb-ul">
                      {(
                        cb.review_status?.blocking_items || []
                      ).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </aside>
          </section>
        )}
      </div>
    </div>
  );
}


function PipelineArrow() {
  return <span className="pipeline-arrow">→</span>;
}

function PipelineNode({
  label,
  sublabel,
  active,
  done,
}: {
  label: string;
  sublabel?: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={`pipeline-node ${
        active ? "active" : done ? "done" : ""
      }`}
    >
      <span />
      <strong>{label}</strong>
      {sublabel && <small>{sublabel}</small>}
    </div>
  );
}

function pipelineStageLabel(stage?: string | null) {
  const map: Record<string, string> = {
    case_brain: "Case Brain",
    research: "Lex Research",
    habeas: "Elena · Habeas",
    bond: "Mateo · Bond",
    timeline: "Chronos · Timeline",
    hearing_prep: "Avery · Hearing Prep",
    attorney_review: "Attorney Review",
  };
  return map[stage || ""] || "Awaiting Next Step";
}

function pipelineNextLabel(
  stage?: string | null,
  nextAgent?: string | null,
  recommended?: string
) {
  if (stage === "attorney_review") return "Attorney Review";
  if (nextAgent === "research") return "Lex · Research";
  if (nextAgent === "habeas") return "Elena · Habeas";
  if (nextAgent === "bond") return "Mateo · Bond";
  if (nextAgent === "timeline") return "Chronos · Timeline";
  if (nextAgent === "hearing") return "Avery · Hearing Prep";

  if (!stage && recommended === "habeas") {
    return "Lex · Research → Elena · Habeas";
  }
  if (!stage && recommended === "bond") {
    return "Lex · Research → Mateo · Bond";
  }

  return "Awaiting pipeline decision";
}

function pipelinePast(
  current?: string | null,
  target?: string
) {
  const order = [
    "case_brain",
    "research",
    "habeas",
    "bond",
    "timeline",
    "hearing_prep",
    "attorney_review",
  ];

  const currentIndex = order.indexOf(current || "");

  if (target === "primary") {
    return ["timeline", "hearing_prep", "attorney_review"].includes(
      current || ""
    );
  }

  const targetIndex = order.indexOf(target || "");
  return currentIndex > targetIndex && targetIndex >= 0;
}

function ProcessingState() {
  return (
    <section className="casebrain-processing-shell">
      <div className="casebrain-processing-card">
        <div className="casebrain-processing-icon">
          <Loader2 className="spin" size={28} />
        </div>

        <div className="cb-kicker">
          CASE BRAIN · MATTER INTELLIGENCE
        </div>
        <h2>Building matter intelligence</h2>
        <p>
          The matter has been received and Case Brain is still analyzing
          the latest Monday information. This workstation will update
          automatically when the saved analysis is ready.
        </p>

        <div className="casebrain-processing-steps">
          <ProcessingStep
            label="Matter received"
            state="done"
          />
          <ProcessingStep
            label="Monday matter identified"
            state="done"
          />
          <ProcessingStep
            label="Building matter intelligence"
            state="active"
          />
          <ProcessingStep
            label="Saving analysis to Supabase"
            state="waiting"
          />
          <ProcessingStep
            label="Attorney review ready"
            state="waiting"
          />
        </div>

        <div className="casebrain-processing-note">
          You can leave this workstation. The analysis continues in the
          background and remains shared across the Cano AI floor.
        </div>
      </div>
    </section>
  );
}

function ErrorState() {
  return (
    <section className="casebrain-processing-shell">
      <div className="casebrain-processing-card error">
        <div className="casebrain-processing-icon">
          <AlertTriangle size={28} />
        </div>

        <div className="cb-kicker">
          CASE BRAIN · ATTENTION REQUIRED
        </div>
        <h2>Analysis did not complete</h2>
        <p>
          Review Santiago Activity for the latest workflow error, correct
          the issue, then use Refresh from Monday to start Case Brain again.
        </p>
      </div>
    </section>
  );
}

function ProcessingStep({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "waiting";
}) {
  return (
    <div className={`casebrain-processing-step ${state}`}>
      <div className="casebrain-step-icon">
        {state === "done" ? (
          <CheckCircle2 size={15} />
        ) : state === "active" ? (
          <Loader2 className="spin" size={15} />
        ) : (
          <span />
        )}
      </div>
      <strong>{label}</strong>
    </div>
  );
}

function Topbar({
  onClose,
  status,
}: {
  onClose: () => void;
  status: string;
}) {
  return (
    <div className="cb-topbar">
      <div className="cb-title-row">
        <button className="ws-back" onClick={onClose}>
          <ArrowLeft size={18} />
        </button>
        <div className="cb-icon">
          <Brain size={22} />
        </div>
        <div>
          <div className="cb-kicker">
            CASE BRAIN · MATTER INTELLIGENCE
          </div>
          <h2>Case Brain Workstation</h2>
        </div>
      </div>
      <div className="cb-status">
        <span />
        {status}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cb-card">
      <div className="cb-card-title">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="cb-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="cb-info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatPerson(
  person?: Record<string, unknown> | null
) {
  if (!person) return "";
  const keys = ["name", "full_name", "fullName"];
  for (const key of keys) {
    const value = person[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function routingLabel(value: string) {
  const map: Record<string, string> = {
    habeas: "Elena · Habeas",
    bond: "Mateo · Bond",
    research: "Lex · Research",
    documents: "Docket · Documents",
    timeline: "Chronos · Timeline",
    qa: "Veritas · Filing QA",
    hearing: "Avery · Hearing Prep",
    attorney_review: "Attorney Review",
    unknown: "Unassigned",
  };
  return map[value] || value || "Unassigned";
}

function formatSaved(value?: string) {
  if (!value) return "This session";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

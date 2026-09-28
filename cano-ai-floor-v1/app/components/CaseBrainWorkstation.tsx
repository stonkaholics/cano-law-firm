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
  matterId: string;
  mondayItemId?: string;
  caseBrainStatus?: string;
  message?: string;
  savedAt?: string;
  monday?: {
    found?: boolean;
    fieldsImported?: number;
  };
  caseBrain: CaseBrainResult;
};

export default function CaseBrainWorkstation({
  matter,
  refreshing = false,
  onRefresh,
  onClose,
}: {
  matter: StoredCaseMatter | null;
  refreshing?: boolean;
  onRefresh?: () => void;
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

  return (
    <div className="casebrain-workstation">
      <Topbar onClose={onClose} status={matter.caseBrainStatus || "review_ready"} />

      <div className="cb-shell">
        <section className="cb-hero">
          <div>
            <div className="cb-kicker">ACTIVE MATTER · CASE BRAIN</div>
            <h1>{detainee || `Matter ${matter.matterId}`}</h1>
            <p>{cb.summary?.brief || matter.message || "Matter analysis ready for review."}</p>
          </div>

          <div>
            <div className="cb-hero-stats">
              <Stat label="Monday Item" value={cb.matter?.monday_item_id || matter.mondayItemId || matter.matterId} />
              <Stat label="Practice Area" value={cb.matter?.practice_area || "—"} />
              <Stat label="Next Route" value={routingLabel(routing)} />
              <Stat label="Saved" value={formatSaved(matter.savedAt)} />
            </div>

            <div className="cb-hero-actions">
              <button
                className="cb-refresh-btn"
                disabled={refreshing || !onRefresh}
                onClick={onRefresh}
              >
                <RefreshCw className={refreshing ? "spin" : ""} size={16} />
                {refreshing ? "Refreshing Analysis..." : "Refresh from Monday"}
              </button>
              <span>
                Re-pulls this exact Monday matter and reruns Case Brain using the latest intake data.
              </span>
            </div>
          </div>
        </section>

        <section className="cb-grid">
          <div className="cb-main">
            <Card icon={<Brain size={18} />} title="Matter Summary">
              <p className="cb-detailed">{cb.summary?.detailed || "No detailed summary returned."}</p>
            </Card>

            <Card icon={<ListChecks size={18} />} title="Key Facts">
              <div className="cb-list">
                {(cb.key_facts || []).map((fact, i) => {
                  if (typeof fact === "string") {
                    return (
                      <div className="cb-fact" key={i}>
                        <span className="confidence reported">REPORTED</span>
                        <div>
                          <strong>{fact}</strong>
                          <small>legacy Case Brain output</small>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="cb-fact" key={i}>
                      <span className={`confidence ${fact.confidence || "unclear"}`}>
                        {(fact.confidence || "unclear").toUpperCase()}
                      </span>
                      <div>
                        <strong>{fact.fact || "Fact"}</strong>
                        <small>{fact.source || "source unavailable"}</small>
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
                        <strong>{entry.date_or_period || "Date unclear"}</strong>
                        <p>{entry.event}</p>
                        <small>{entry.source || "source unavailable"}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card icon={<GitBranch size={18} />} title="Issues for Review">
              <div className="cb-simple-list">
                {(cb.issues || []).map((issue, i) => (
                  <div key={i}>
                    <strong>
                      {typeof issue === "string"
                        ? "Issue"
                        : (issue.type || "issue").toUpperCase()}
                    </strong>
                    <span>{typeof issue === "string" ? issue : issue.issue}</span>
                    {typeof issue !== "string" && issue.source && <small>{issue.source}</small>}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <aside className="cb-side">
            <Card icon={<UserRound size={18} />} title="People">
              <Info label="Detainee" value={detainee || "—"} />
              <Info label="PNC" value={pnc || "—"} />
              <Info
                label="Other People"
                value={String(cb.people?.other_people?.length || 0)}
              />
            </Card>

            <Card icon={<Route size={18} />} title="Routing">
              <div className="route-badge">{routingLabel(routing)}</div>
              <p className="side-copy">{cb.routing?.reason || "No routing reason returned."}</p>
            </Card>

            <Card icon={<FileQuestion size={18} />} title="Missing Information">
              <div className="number-badge">{cb.missing_information?.length || 0}</div>
              <ul className="cb-ul">
                {(cb.missing_information || []).map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </Card>

            <Card icon={<AlertTriangle size={18} />} title="Contradictions">
              <div className="number-badge warning">{cb.contradictions?.length || 0}</div>
              <ul className="cb-ul">
                {(cb.contradictions || []).map((item, i) => (
                  <li key={i}>
                    {typeof item === "string" ? item : item.description}
                    {typeof item !== "string" && item.sources?.length ? (
                      <small>{item.sources.join(" · ")}</small>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>

            <Card icon={<MessageCircleQuestion size={18} />} title="Next Questions">
              <ul className="cb-ul">
                {(cb.next_questions || []).map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </Card>

            <Card icon={<CheckCircle2 size={18} />} title="Review Status">
              <Info
                label="Attorney Review"
                value={cb.review_status?.attorney_review_required ? "Required" : "Not Required"}
              />
              <Info
                label="Ready for Specialist"
                value={cb.review_status?.ready_for_specialist ? "Yes" : "No"}
              />
              {(cb.review_status?.blocking_items || []).length > 0 && (
                <>
                  <div className="cb-subtitle">BLOCKING ITEMS</div>
                  <ul className="cb-ul">
                    {(cb.review_status?.blocking_items || []).map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </>
              )}
            </Card>
          </aside>
        </section>
      </div>
    </div>
  );
}

function Topbar({ onClose, status }: { onClose: () => void; status: string }) {
  return (
    <div className="cb-topbar">
      <div className="cb-title-row">
        <button className="ws-back" onClick={onClose}><ArrowLeft size={18} /></button>
        <div className="cb-icon"><Brain size={22} /></div>
        <div>
          <div className="cb-kicker">CASE BRAIN · MATTER INTELLIGENCE</div>
          <h2>Case Brain Workstation</h2>
        </div>
      </div>
      <div className="cb-status"><span />{status.replaceAll("_", " ")}</div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="cb-card">
      <div className="cb-card-title">{icon}<span>{title}</span></div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="cb-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="cb-info"><span>{label}</span><strong>{value}</strong></div>;
}

function formatPerson(person?: Record<string, unknown> | null) {
  if (!person) return "";
  const keys = ["name", "full_name", "fullName"];
  for (const key of keys) {
    const value = person[key];
    if (typeof value === "string" && value.trim()) return value.trim();
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

"use client";

import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Layers3,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";
import type {
  SpecialistAgentId,
  SpecialistState,
} from "./SpecialistWorkstation";

const TEAM: Array<{
  id: SpecialistAgentId;
  name: string;
  role: string;
}> = [
  { id: "research", name: "Lex", role: "Research" },
  { id: "habeas", name: "Elena", role: "Habeas" },
  { id: "bond", name: "Mateo", role: "Bond" },
  { id: "timeline", name: "Chronos", role: "Timeline" },
  { id: "hearing", name: "Avery", role: "Hearing Prep" },
  { id: "qa", name: "Veritas", role: "Filing QA" },
];

export default function IntelligenceManagerWorkstation({
  matter,
  states,
  onClose,
  onOpenAgent,
  onUpdated,
}: {
  matter: StoredCaseMatter | null;
  states: Record<string, SpecialistState>;
  onClose: () => void;
  onOpenAgent: (agentId: SpecialistAgentId) => void;
  onUpdated?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const atlas = states.synthesis || {};
  const output = atlas.output;

  const matterName = useMemo(() => {
    return String(
      matter?.caseBrain?.people?.detainee?.name ||
        matter?.caseBrain?.people?.detainee?.full_name ||
        matter?.monday?.preview?.detaineeName ||
        matter?.monday?.preview?.name ||
        matter?.matterId ||
        "No Active Matter"
    );
  }, [matter]);

  async function refreshAtlas() {
    if (!matter || running) return;

    setRunning(true);
    setError("");

    try {
      const mondayItemId =
        matter.mondayItemId || matter.matterId;

      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mondayItemId,
          agentId: "synthesis",
          triggerType: atlas?.run ? "refresh" : "manual",
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to refresh Atlas."
        );
      }

      const startedAt = Date.now();

      while (Date.now() - startedAt < 120000) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2500)
        );

        const stateRes = await fetch(
          `/api/agents/state?mondayItemId=${encodeURIComponent(
            mondayItemId
          )}`,
          { cache: "no-store" }
        );
        const stateData = await stateRes.json();

        const nextAtlas = stateData?.agents?.synthesis;
        if (
          nextAtlas?.run?.status === "review_ready" ||
          nextAtlas?.run?.status === "needs_review" ||
          nextAtlas?.run?.status === "error"
        ) {
          onUpdated?.();
          return;
        }
      }

      onUpdated?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh Atlas."
      );
    } finally {
      setRunning(false);
    }
  }

  const completedCount = TEAM.filter(
    (agent) => Boolean(states[agent.id]?.output)
  ).length;

  const blockerCount =
    output?.readiness?.blocking_items?.length || 0;

  return (
    <div className="atlas-workstation">
      <header className="atlas-topbar">
        <div className="atlas-title">
          <button className="ws-back" onClick={onClose}>
            <ArrowLeft size={18} />
          </button>
          <div className="atlas-icon">
            <BrainCircuit size={22} />
          </div>
          <div>
            <span className="ws-eyebrow">
              ATLAS · MATTER INTELLIGENCE MANAGER
            </span>
            <h2>Intelligence Manager</h2>
          </div>
        </div>

        <div className={`specialist-status ${atlas?.run?.status || "ready"}`}>
          <span />
          {(atlas?.run?.status || "ready").replaceAll("_", " ")}
        </div>
      </header>

      <main className="atlas-shell">
        {!matter ? (
          <div className="specialist-empty">
            <CircleAlert size={30} />
            <h3>No active matter</h3>
            <p>Select a shared matter from Matter Center.</p>
          </div>
        ) : (
          <>
            <section className="atlas-hero">
              <div>
                <span className="ws-eyebrow">ACTIVE INTELLIGENCE DOSSIER</span>
                <h1>{matterName}</h1>
                <p>
                  Atlas compiles Case Brain and every completed specialist
                  analysis without replacing the original records.
                </p>
              </div>

              <button
                className="specialist-run-btn"
                disabled={running}
                onClick={refreshAtlas}
              >
                {running || atlas?.run?.status === "working" ? (
                  <>
                    <Loader2 className="spin" size={16} />
                    Compiling...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Refresh Intelligence
                  </>
                )}
              </button>
            </section>

            {error && (
              <div className="specialist-error">
                <CircleAlert size={16} />
                {error}
              </div>
            )}

            <section className="atlas-metrics">
              <Metric
                label="Specialists Complete"
                value={`${completedCount}/${TEAM.length}`}
              />
              <Metric
                label="Current Pipeline"
                value={
                  matter.pipeline?.stage?.replaceAll("_", " ") ||
                  "Awaiting stage"
                }
              />
              <Metric
                label="Team Blockers"
                value={String(blockerCount)}
              />
              <Metric
                label="Attorney Review"
                value={
                  output?.readiness?.attorney_review_required
                    ? "Required"
                    : "Pending"
                }
              />
            </section>

            <section className="atlas-grid">
              <div className="atlas-main">
                <div className="atlas-card atlas-summary">
                  <div className="atlas-card-title">
                    <BrainCircuit size={17} />
                    Executive Intelligence Brief
                  </div>

                  {output?.executive_summary ? (
                    <p>{output.executive_summary}</p>
                  ) : (
                    <div className="atlas-awaiting">
                      <Loader2
                        className={
                          atlas?.run?.status === "working"
                            ? "spin"
                            : ""
                        }
                        size={20}
                      />
                      <div>
                        <strong>
                          {atlas?.run?.status === "working"
                            ? "Atlas is compiling the current dossier"
                            : "No intelligence synthesis yet"}
                        </strong>
                        <span>
                          Atlas automatically refreshes as Case Brain and
                          specialists complete. You can also refresh it manually.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {(output?.sections || []).map((section, index) => (
                  <div className="atlas-card" key={`${section.title}-${index}`}>
                    <div className="atlas-card-title">
                      <Layers3 size={16} />
                      {section.title || "Intelligence"}
                    </div>

                    <div className="atlas-section-items">
                      {(section.items || []).map((item, itemIndex) => (
                        <div className="atlas-intel-item" key={itemIndex}>
                          <div className="atlas-intel-head">
                            <strong>{item.label}</strong>
                            <span
                              className={`confidence ${
                                item.confidence || "analysis"
                              }`}
                            >
                              {(item.confidence || "analysis").toUpperCase()}
                            </span>
                          </div>
                          <p>{item.detail}</p>
                          <small>{item.source || "Atlas synthesis"}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <aside className="atlas-side">
                <div className="atlas-card">
                  <div className="atlas-card-title">
                    <Users size={16} />
                    Specialist Records
                  </div>

                  <div className="atlas-team-list">
                    {TEAM.map((agent) => {
                      const state = states[agent.id];
                      const status =
                        state?.run?.status ||
                        (state?.output ? "review_ready" : "not_run");

                      return (
                        <button
                          className="atlas-agent-row"
                          key={agent.id}
                          onClick={() => onOpenAgent(agent.id)}
                        >
                          <span className={`atlas-agent-dot ${status}`} />
                          <div>
                            <strong>
                              {agent.name} · {agent.role}
                            </strong>
                            <small>{status.replaceAll("_", " ")}</small>
                            {state?.output?.executive_summary && (
                              <p>
                                {state.output.executive_summary.slice(0, 180)}
                                {state.output.executive_summary.length > 180
                                  ? "…"
                                  : ""}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <AtlasList
                  title="Top Blockers"
                  items={output?.readiness?.blocking_items || []}
                />
                <AtlasList
                  title="Team Next Actions"
                  items={output?.next_actions || []}
                />
                <AtlasList
                  title="Open Questions"
                  items={output?.open_questions || []}
                />
                <AtlasList
                  title="Warnings"
                  items={output?.warnings || []}
                />
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="atlas-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AtlasList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="atlas-card">
      <div className="atlas-card-title">{title}</div>
      {items.length ? (
        <ul className="atlas-list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="specialist-none">None currently listed.</p>
      )}
    </div>
  );
}

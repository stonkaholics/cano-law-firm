"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Play,
  RefreshCw,
  AlertTriangle,
  Layers3,
  CircleHelp,
  ListChecks,
  Users,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";

export type SpecialistAgentId =
  | "habeas"
  | "bond"
  | "research"
  | "timeline"
  | "qa"
  | "hearing"
  | "synthesis";

export type SpecialistState = {
  run?: {
    id: string;
    agent_id: SpecialistAgentId;
    agent_name: string;
    status: string;
    started_at: string;
    completed_at?: string | null;
    error_message?: string | null;
  } | null;
  output?: SpecialistOutput | null;
};

export type SpecialistOutput = {
  schema_version?: string;
  agent_id?: SpecialistAgentId;
  title?: string;
  executive_summary?: string;
  readiness?: {
    status?: "review_ready" | "needs_information" | "not_ready" | string;
    attorney_review_required?: boolean;
    blocking_items?: string[];
  };
  sections?: Array<{
    title?: string;
    items?: Array<{
      label?: string;
      detail?: string;
      source?: string;
      confidence?: string;
    }>;
  }>;
  next_actions?: string[];
  open_questions?: string[];
  warnings?: string[];
};

const CONFIG: Record<
  SpecialistAgentId,
  { name: string; role: string; action: string }
> = {
  habeas: {
    name: "Elena",
    role: "Habeas Research Specialist",
    action: "Run Habeas Analysis",
  },
  bond: {
    name: "Mateo",
    role: "Immigration Bond Specialist",
    action: "Run Bond Analysis",
  },
  research: {
    name: "Lex",
    role: "Legal Research Specialist",
    action: "Start Research",
  },
  timeline: {
    name: "Chronos",
    role: "Timeline & Deadline Specialist",
    action: "Build Timeline",
  },
  qa: {
    name: "Veritas",
    role: "Filing QA Specialist",
    action: "Run QA Review",
  },
  hearing: {
    name: "Avery",
    role: "Hearing Prep Specialist",
    action: "Build Hearing Prep",
  },
  synthesis: {
    name: "Atlas",
    role: "Matter Intelligence Manager",
    action: "Compile Intelligence",
  },
};

export default function SpecialistWorkstation({
  agentId,
  matter,
  initialState,
  onClose,
  onStateUpdated,
  onSelectMatter,
}: {
  agentId: SpecialistAgentId;
  matter: StoredCaseMatter | null;
  initialState?: SpecialistState | null;
  onClose: () => void;
  onSelectMatter?: (matter: StoredCaseMatter) => void;
  onStateUpdated?: (
    agentId: SpecialistAgentId,
    state: SpecialistState
  ) => void;
}) {
  const config = CONFIG[agentId];
  const [state, setState] = useState<SpecialistState>(
    initialState || {}
  );
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<any[]>([]);

  const detaineeName = useMemo(() => {
    return String(
      matter?.caseBrain?.people?.detainee?.name ||
      matter?.caseBrain?.people?.detainee?.full_name ||
      matter?.matterId ||
      "No Active Matter"
    );
  }, [matter]);

  async function loadQueue() {
    try {
      const res = await fetch(
        `/api/agents/queue?agentId=${encodeURIComponent(agentId)}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (res.ok && data?.ok !== false) {
        setQueue(Array.isArray(data.queue) ? data.queue : []);
      }
    } catch {}
  }

  async function loadState() {
    if (!matter) return;

    try {
      const mondayItemId =
        matter.mondayItemId || matter.matterId;

      const res = await fetch(
        `/api/agents/state?mondayItemId=${encodeURIComponent(
          mondayItemId
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to load specialist state."
        );
      }

      const next = data?.agents?.[agentId] || {};
      setState(next);
      onStateUpdated?.(agentId, next);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load specialist state."
      );
    }
  }

  async function ensureRoute() {
    if (!matter) return;

    const routeLabels: Record<SpecialistAgentId, string> = {
      habeas: "Elena · Habeas",
      bond: "Mateo · Bond",
      research: "Lex · Research",
      timeline: "Chronos · Timeline",
      qa: "Veritas · Filing QA",
      hearing: "Avery · Hearing Prep",
      synthesis: "Atlas · Matter Intelligence",
    };

    await fetch("/api/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mondayItemId:
          matter.mondayItemId || matter.matterId,
        target: routeLabels[agentId],
        routedBy: "Santiago",
      }),
    });
  }

  async function runAgent() {
    if (!matter || starting) return;

    setStarting(true);
    setError("");

    try {
      await ensureRoute();

      const mondayItemId =
        matter.mondayItemId || matter.matterId;

      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mondayItemId,
          agentId,
          triggerType: state?.run ? "refresh" : "manual",
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || `Unable to start ${config.name}.`
        );
      }

      const runId = data.runId;
      const startedAt = Date.now();

      setState({
        ...state,
        run: {
          id: runId,
          agent_id: agentId,
          agent_name: config.name,
          status: "working",
          started_at: new Date().toISOString(),
        },
      });

      while (Date.now() - startedAt < 120000) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2500)
        );

        const statusRes = await fetch(
          `/api/agents/state?mondayItemId=${encodeURIComponent(
            mondayItemId
          )}`,
          { cache: "no-store" }
        );

        const statusData = await statusRes.json();

        if (!statusRes.ok || statusData?.ok === false) continue;

        const latest = statusData?.agents?.[agentId] || {};

        setState(latest);
        onStateUpdated?.(agentId, latest);

        const status = latest?.run?.status;

        if (
          status === "review_ready" ||
          status === "needs_review" ||
          status === "error"
        ) {
          return;
        }
      }

      await loadState();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to run ${config.name}.`
      );
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    loadState();
    loadQueue();

    const interval = window.setInterval(() => {
      loadState();
      loadQueue();
    }, 10000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matter?.matterId, agentId]);

  const status =
    state?.run?.status ||
    (state?.output ? "review_ready" : "ready");

  return (
    <div className="specialist-workstation">
      <div className="specialist-topbar">
        <div className="specialist-title-row">
          <button className="ws-back" onClick={onClose}>
            <ArrowLeft size={18} />
          </button>

          <div>
            <div className="ws-kicker">
              {config.name.toUpperCase()} · {config.role.toUpperCase()}
            </div>
            <h2>{config.name} Workstation</h2>
          </div>
        </div>

        <div className={`specialist-status ${status}`}>
          <span />
          {status.replaceAll("_", " ")}
        </div>
      </div>

      <div className="specialist-shell">
        {!matter ? (
          <div className="specialist-empty">
            <AlertTriangle size={30} />
            <h3>No active Case Brain matter</h3>
            <p>
              Assign a Monday matter through Santiago before running a specialist.
            </p>
          </div>
        ) : (
          <>
            <section className="specialist-hero">
              <div>
                <span className="ws-eyebrow">ACTIVE MATTER</span>
                <h1>{detaineeName}</h1>
                <p>
                  {matter.caseBrain?.summary?.brief ||
                    "Case Brain matter loaded."}
                </p>
              </div>

              <button
                className="specialist-run-btn"
                disabled={starting}
                onClick={runAgent}
              >
                {starting ||
                state?.run?.status === "working" ? (
                  <>
                    <Loader2 className="spin" size={17} />
                    {config.name} Working...
                  </>
                ) : state?.output ? (
                  <>
                    <RefreshCw size={17} />
                    Refresh Analysis
                  </>
                ) : (
                  <>
                    <Play size={17} />
                    {config.action}
                  </>
                )}
              </button>
            </section>

            <section className="specialist-queue-card">
              <div className="specialist-queue-head">
                <div>
                  <span className="ws-eyebrow">MATTER QUEUE</span>
                  <h3>{config.name}'s matters</h3>
                </div>
                <span>{queue.length} tracked</span>
              </div>

              {queue.length === 0 ? (
                <p className="specialist-none">
                  No matters have been sent to {config.name} yet.
                </p>
              ) : (
                <div className="specialist-queue-list">
                  {queue.slice(0, 8).map((item) => {
                    const current =
                      item?.matter?.matterId === matter?.matterId;

                    return (
                      <button
                        key={item.run.id}
                        className={`specialist-queue-row ${
                          current ? "current" : ""
                        }`}
                        onClick={() => {
                          if (item.matter) {
                            onSelectMatter?.(item.matter);
                          }
                        }}
                      >
                        <Users size={15} />
                        <div>
                          <strong>{item.name}</strong>
                          <span>
                            {(item.run.status || "ready").replaceAll("_", " ")}
                            {item.pncName ? ` · PNC ${item.pncName}` : ""}
                          </span>
                        </div>
                        <ChevronRight size={14} />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {error && (
              <div className="specialist-error">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}

            {state?.run?.status === "working" && (
              <div className="specialist-working-card">
                <Loader2 className="spin" size={18} />
                <div>
                  <strong>{config.name} is analyzing the matter</strong>
                  <span>
                    You can leave this workstation. The result will be saved to
                    Supabase and remain available across computers.
                  </span>
                </div>
              </div>
            )}

            {!state?.output ? (
              <div className="specialist-empty compact">
                <Layers3 size={30} />
                <h3>No completed {config.name} analysis yet</h3>
                <p>
                  Run this specialist to create the first shared output for the
                  active matter.
                </p>
              </div>
            ) : (
              <SpecialistOutputView output={state.output} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SpecialistOutputView({
  output,
}: {
  output: SpecialistOutput;
}) {
  return (
    <div className="specialist-output-grid">
      <section className="specialist-main-column">
        <div className="specialist-card summary">
          <div className="specialist-card-title">
            <CheckCircle2 size={17} />
            {output.title || "Specialist Analysis"}
          </div>
          <p>{output.executive_summary}</p>
        </div>

        {(output.sections || []).map((section, index) => (
          <div className="specialist-card" key={`${section.title}-${index}`}>
            <div className="specialist-card-title">
              <Layers3 size={16} />
              {section.title || "Analysis"}
            </div>

            <div className="specialist-items">
              {(section.items || []).map((item, itemIndex) => (
                <div className="specialist-item" key={itemIndex}>
                  <div className="specialist-item-top">
                    <strong>{item.label}</strong>
                    <span className={`confidence ${item.confidence || "analysis"}`}>
                      {(item.confidence || "analysis").toUpperCase()}
                    </span>
                  </div>
                  <p>{item.detail}</p>
                  <small>{item.source || "analysis"}</small>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <aside className="specialist-side-column">
        <SideList
          title="Blocking Items"
          items={output.readiness?.blocking_items || []}
        />
        <SideList
          title="Next Actions"
          items={output.next_actions || []}
        />
        <SideList
          title="Open Questions"
          items={output.open_questions || []}
          icon="question"
        />
        <SideList
          title="Warnings"
          items={output.warnings || []}
          icon="warning"
        />
      </aside>
    </div>
  );
}

function SideList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon?: "question" | "warning";
}) {
  return (
    <section className="specialist-card side">
      <div className="specialist-card-title">
        {icon === "question" ? (
          <CircleHelp size={16} />
        ) : (
          <ListChecks size={16} />
        )}
        {title}
      </div>
      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="specialist-none">None currently listed.</p>
      )}
    </section>
  );
}

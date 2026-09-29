"use client";

import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock3,
  Search,
  Users,
  X,
  ChevronRight,
  RefreshCw,
  Route,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";
import type { SpecialistState } from "./SpecialistWorkstation";

export type MatterQueueItem = StoredCaseMatter & {
  record?: {
    databaseId?: string;
    matterName?: string | null;
    detaineeName?: string | null;
    pncName?: string | null;
    practiceArea?: string | null;
    matterType?: string | null;
    assignedAttorney?: string | null;
    status?: string | null;
    currentRoute?: string | null;
    updatedAt?: string | null;
    createdAt?: string | null;
  };
  specialists?: Record<string, SpecialistState>;
};

const AGENT_LABELS: Record<string, string> = {
  habeas: "Elena",
  bond: "Mateo",
  research: "Lex",
  timeline: "Chronos",
  qa: "Veritas",
  hearing: "Avery",
};

export default function MatterCenter({
  matters,
  selectedMatterId,
  loading,
  onRefresh,
  onSelect,
  onOpenCaseBrain,
  onClose,
}: {
  matters: MatterQueueItem[];
  selectedMatterId?: string | null;
  loading?: boolean;
  onRefresh: () => void;
  onSelect: (matter: MatterQueueItem) => void;
  onOpenCaseBrain: (matter: MatterQueueItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "processing" | "review_ready" | "attention"
  >("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return matters.filter((matter) => {
      const status = matter.caseBrainStatus || "";
      const specialistValues = Object.values(
        matter.specialists || {}
      );

      const hasAttention = specialistValues.some(
        (state) =>
          state?.run?.status === "needs_review" ||
          state?.run?.status === "error"
      );

      const matchesFilter =
        filter === "all" ||
        (filter === "processing" &&
          (status === "case_brain_processing" ||
            specialistValues.some(
              (state) => state?.run?.status === "working"
            ))) ||
        (filter === "review_ready" &&
          status === "review_ready") ||
        (filter === "attention" &&
          (status === "case_brain_error" || hasAttention));

      if (!matchesFilter) return false;
      if (!q) return true;

      const haystack = [
        displayName(matter),
        matter.record?.pncName,
        matter.record?.practiceArea,
        matter.record?.currentRoute,
        matter.mondayItemId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [matters, query, filter]);

  const counts = useMemo(() => {
    const processing = matters.filter((matter) => {
      if (matter.caseBrainStatus === "case_brain_processing") {
        return true;
      }

      return Object.values(matter.specialists || {}).some(
        (state) => state?.run?.status === "working"
      );
    }).length;

    const reviewReady = matters.filter(
      (matter) => matter.caseBrainStatus === "review_ready"
    ).length;

    return {
      total: matters.length,
      processing,
      reviewReady,
    };
  }, [matters]);

  return (
    <div className="matter-center">
      <header className="matter-center-topbar">
        <div>
          <span className="ws-eyebrow">CANO CENTRAL · SHARED MATTERS</span>
          <h2>Matter Center</h2>
          <p>
            Monitor multiple Case Brain matters and specialist jobs at the same
            time. Selecting a matter changes the command-center context without
            stopping work on any other matter.
          </p>
        </div>

        <div className="matter-center-top-actions">
          <button className="icon-text-btn" onClick={onRefresh}>
            <RefreshCw className={loading ? "spin" : ""} size={15} />
            Refresh
          </button>
          <button className="ws-back" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
      </header>

      <div className="matter-center-shell">
        <section className="matter-center-stats">
          <MatterStat
            icon={<Users size={17} />}
            label="Stored Matters"
            value={counts.total}
          />
          <MatterStat
            icon={<Activity size={17} />}
            label="Processing"
            value={counts.processing}
          />
          <MatterStat
            icon={<CheckCircle2 size={17} />}
            label="Case Brain Ready"
            value={counts.reviewReady}
          />
        </section>

        <section className="matter-center-controls">
          <div className="matter-center-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search detainee, PNC, practice area, route, Monday ID..."
            />
          </div>

          <div className="matter-center-filters">
            {[
              ["all", "All"],
              ["processing", "Processing"],
              ["review_ready", "Review Ready"],
              ["attention", "Needs Attention"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id as typeof filter)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="matter-board">
          {filtered.length === 0 ? (
            <div className="matter-center-empty">
              <Brain size={30} />
              <h3>No matching matters</h3>
              <p>
                Assign matters through Santiago and they will appear here as
                shared records.
              </p>
            </div>
          ) : (
            filtered.map((matter) => {
              const selected =
                (matter.mondayItemId || matter.matterId) ===
                selectedMatterId;

              return (
                <article
                  className={`matter-card ${selected ? "selected" : ""}`}
                  key={matter.databaseId || matter.matterId}
                >
                  <div className="matter-card-head">
                    <div>
                      <span className="matter-card-status">
                        <StatusDot status={matter.caseBrainStatus} />
                        {(matter.caseBrainStatus || "ready").replaceAll(
                          "_",
                          " "
                        )}
                      </span>
                      <h3>{displayName(matter)}</h3>
                      <p>
                        {matter.record?.practiceArea || "Practice area pending"}
                        {matter.record?.pncName
                          ? ` · PNC ${matter.record.pncName}`
                          : ""}
                      </p>
                    </div>

                    {selected && (
                      <span className="matter-selected-badge">
                        ACTIVE VIEW
                      </span>
                    )}
                  </div>

                  <div className="matter-card-meta">
                    <Meta
                      label="Monday Item"
                      value={matter.mondayItemId || matter.matterId}
                    />
                    <Meta
                      label="Pipeline"
                      value={
                        matter.pipeline?.stage
                          ? matter.pipeline.stage.replaceAll("_", " ")
                          : matter.record?.currentRoute ||
                            matter.routing?.target ||
                            "Unassigned"
                      }
                    />
                    <Meta
                      label="Updated"
                      value={formatTime(
                        matter.record?.updatedAt || matter.savedAt
                      )}
                    />
                  </div>

                  <div className="matter-agent-strip">
                    {Object.entries(AGENT_LABELS).map(
                      ([agentId, label]) => {
                        const state =
                          matter.specialists?.[agentId];
                        const runStatus =
                          state?.run?.status || "ready";

                        return (
                          <div
                            className={`matter-agent-pill ${runStatus}`}
                            key={agentId}
                          >
                            <span />
                            <strong>{label}</strong>
                            <small>
                              {runStatus.replaceAll("_", " ")}
                            </small>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="matter-card-actions">
                    <button
                      className="secondary-btn"
                      onClick={() => onSelect(matter)}
                    >
                      <Route size={14} />
                      Make Active
                    </button>

                    <button
                      className="primary-btn compact"
                      onClick={() => onOpenCaseBrain(matter)}
                    >
                      Open Case Brain
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

function displayName(matter: MatterQueueItem) {
  return String(
    matter.caseBrain?.people?.detainee?.name ||
      matter.caseBrain?.people?.detainee?.full_name ||
      matter.record?.detaineeName ||
      matter.record?.matterName ||
      matter.monday?.preview?.detaineeName ||
      matter.monday?.preview?.name ||
      `Matter ${matter.matterId}`
  );
}

function MatterStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="matter-stat">
      <div>{icon}</div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="matter-meta">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusDot({ status }: { status?: string }) {
  if (status === "case_brain_processing") {
    return <Clock3 size={12} />;
  }
  if (status === "case_brain_error") {
    return <AlertTriangle size={12} />;
  }
  return <CheckCircle2 size={12} />;
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

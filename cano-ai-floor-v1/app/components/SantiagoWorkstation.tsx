"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Search,
  AlertTriangle,
  Loader2,
  Database,
  FileText,
  Play,
  RefreshCw,
  MessageSquareMore,
  Send,
  Brain,
} from "lucide-react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";

export type SantiagoMatter = {
  id: string;
  name: string;
  practiceArea?: string;
  matterType?: string;
  attorney?: string;
  status?: string;
  pncName?: string;
  detaineeName?: string;
  aNumber?: string;
  detentionFacility?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  contactMethod?: string;
  dateAdded?: string;
  notesPreview?: string;
  mondayItemId?: string;
  referredBy?: string;
  referredSource?: string;
};

type StartResult = {
  ok: boolean;
  matterId?: string;
  mondayItemId?: string;
  caseBrainStatus?: string;
  monday?: {
    found: boolean;
    fieldsImported?: number;
  };
  caseBrain?: StoredCaseMatter["caseBrain"];
  warning?: string | null;
  message?: string;
};

export default function SantiagoWorkstation({
  initialTab = "intake",
  onClose,
  onCaseBrainReady,
}: {
  initialTab?: "intake" | "dispatch" | "activity";
  onClose: () => void;
  onCaseBrainReady?: (matter: StoredCaseMatter) => void;
}) {
  const [tab, setTab] = useState<"intake" | "dispatch" | "activity">(initialTab);
  const [query, setQuery] = useState("");
  const [matters, setMatters] = useState<SantiagoMatter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<StartResult | null>(null);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => matters.find((m) => m.id === selectedId) ?? null,
    [matters, selectedId]
  );

  async function searchMatters(nextQuery = query) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/santiago/matters?q=${encodeURIComponent(nextQuery.trim())}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Unable to load Monday matters.");
      }

      setMatters(Array.isArray(data.matters) ? data.matters : []);
    } catch (err) {
      setMatters([]);
      setError(
        err instanceof Error ? err.message : "Unable to load Monday matters."
      );
    } finally {
      setLoading(false);
    }
  }

  async function startMatter() {
    if (!selected) return;

    setStarting(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/santiago/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId: selected.id,
          mondayItemId: selected.mondayItemId || selected.id,
          preview: selected,
        }),
      });

      const data: StartResult = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(
          data?.warning || "Matter could not be assigned."
        );
      }

      setResult(data);

      if (data.caseBrain) {
        const stored: StoredCaseMatter = {
          matterId: String(data.matterId || selected.id),
          mondayItemId: String(data.mondayItemId || selected.mondayItemId || selected.id),
          caseBrainStatus: data.caseBrainStatus || "review_ready",
          message: data.message,
          monday: data.monday,
          caseBrain: data.caseBrain,
          savedAt: new Date().toISOString(),
        };

        try {
          localStorage.setItem("cano_active_case_brain_matter", JSON.stringify(stored));
        } catch {}

        window.dispatchEvent(
          new CustomEvent("cano-casebrain-updated", { detail: stored })
        );

        onCaseBrainReady?.(stored);
      }
    } catch (err) {
      setResult({
        ok: false,
        warning:
          err instanceof Error
            ? err.message
            : "Unable to reach the assign-matter workflow.",
      });
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    searchMatters("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="santiago-workstation">
      <div className="ws-topbar">
        <div className="ws-title-group">
          <button className="ws-back" onClick={onClose}>
            <ArrowLeft size={18} />
          </button>

          <div className="ws-agent-badge">
            <MessageSquareMore size={22} />
          </div>

          <div>
            <div className="ws-kicker">SANTIAGO · AI OFFICE COORDINATOR</div>
            <h2>Coordinator Workstation</h2>
          </div>
        </div>

        <div className="ws-status">
          <span />
          Ready
        </div>
      </div>

      <div className="ws-tabs">
        <button className={tab === "intake" ? "active" : ""} onClick={() => setTab("intake")}>
          Matter Intake
        </button>
        <button className={tab === "dispatch" ? "active" : ""} onClick={() => setTab("dispatch")}>
          Dispatch
        </button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>
          Activity
        </button>
      </div>

      {tab === "intake" && (
        <div className="ws-content">
          <section className="ws-left">
            <div className="ws-section-head">
              <div>
                <span className="ws-eyebrow">LIVE MONDAY CLIENT LIST</span>
                <h3>Assign a matter</h3>
              </div>
              <button className="icon-button" onClick={() => searchMatters()} aria-label="Refresh Monday matters">
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="matter-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchMatters();
                }}
                placeholder="Search name, PNC, A-number, phone..."
              />
              <button onClick={() => searchMatters()}>Search</button>
            </div>

            {error && (
              <div className="ws-error">
                <AlertTriangle size={17} />
                <span>{error}</span>
              </div>
            )}

            <div className="matter-list">
              {loading && (
                <div className="matter-empty">
                  <Loader2 className="spin" size={18} />
                  Pulling current clients from Monday...
                </div>
              )}

              {!loading &&
                matters.map((matter) => (
                  <button
                    key={matter.id}
                    className={`matter-row ${selectedId === matter.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedId(matter.id);
                      setResult(null);
                    }}
                  >
                    <div>
                      <strong>{matter.name}</strong>
                      <span>
                        {[matter.practiceArea, matter.detentionFacility]
                          .filter(Boolean)
                          .join(" · ") || "Monday Matter"}
                      </span>
                    </div>
                    <small>{matter.pncName || matter.status || "Current"}</small>
                  </button>
                ))}

              {!loading && !error && matters.length === 0 && (
                <div className="matter-empty">
                  No Monday matters matched this search.
                </div>
              )}
            </div>
          </section>

          <section className="ws-right">
            {!selected ? (
              <div className="select-placeholder">
                <Database size={30} />
                <h3>Select a Monday matter</h3>
                <p>
                  Choose a current client to review the available Monday data
                  before pushing it into the Cano AI matter pipeline.
                </p>
              </div>
            ) : (
              <>
                <div className="selected-matter-head">
                  <div>
                    <span className="ws-eyebrow">SELECTED MATTER</span>
                    <h3>{selected.name}</h3>
                    <p>
                      {[selected.practiceArea, selected.matterType]
                        .filter(Boolean)
                        .join(" · ") || "Monday Client"}
                    </p>
                  </div>
                  <div className="matter-status-pill">
                    {selected.status || "Monday"}
                  </div>
                </div>

                <div className="matter-facts">
                  <Fact label="PNC" value={selected.pncName || "—"} />
                  <Fact label="Detainee" value={selected.detaineeName || selected.name} />
                  <Fact label="A-Number" value={selected.aNumber || "—"} />
                  <Fact label="Facility" value={selected.detentionFacility || "—"} />
                  <Fact label="Phone" value={selected.phone || "—"} />
                  <Fact label="Email" value={selected.email || "—"} />
                  <Fact label="Language" value={selected.preferredLanguage || "—"} />
                  <Fact label="Contact Method" value={selected.contactMethod || "—"} />
                  <Fact label="Monday Item" value={selected.mondayItemId || selected.id} />
                </div>

                {selected.notesPreview && (
                  <div className="notes-preview">
                    <span>SHORT CASE SUMMARY</span>
                    <p>{selected.notesPreview}</p>
                  </div>
                )}

                {result && (
                  <div className={`start-result ${result.ok ? "success" : "error"}`}>
                    <div className="start-result-head">
                      {result.ok ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
                      <strong>
                        {result.message ||
                          (result.ok ? "Matter assigned" : "Matter could not be assigned")}
                      </strong>
                    </div>
                    {result.monday && (
                      <p>
                        Monday: {result.monday.found
                          ? `${result.monday.fieldsImported ?? "Available"} fields imported`
                          : "matter not found"}
                      </p>
                    )}
                    {result.caseBrainStatus && <p>Case Brain status: {result.caseBrainStatus}</p>}
                    {result.caseBrain && (
                      <button
                        className="open-casebrain-result"
                        onClick={() => {
                          const raw = localStorage.getItem("cano_active_case_brain_matter");
                          if (!raw) return;
                          try {
                            onCaseBrainReady?.(JSON.parse(raw));
                          } catch {}
                        }}
                      >
                        <Brain size={17} />
                        Open Case Brain Matter
                      </button>
                    )}
                    {result.warning && <p>{result.warning}</p>}
                  </div>
                )}

                <button className="start-casebrain" disabled={starting} onClick={startMatter}>
                  {starting ? (
                    <>
                      <Loader2 className="spin" size={18} />
                      Running Case Brain...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Assign Matter to Case Brain
                    </>
                  )}
                </button>

                <p className="ws-help">
                  The returned Case Brain analysis is stored locally in V1 so the Case Brain workstation can open it immediately. Database persistence comes next.
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "dispatch" && (
        <div className="ws-placeholder-tab">
          <Send size={32} />
          <h3>Dispatch Center</h3>
          <p>
            Santiago will use this area to route Case Brain matters to Elena,
            Mateo, Lex, Docket, Chronos, Veritas, and Avery.
          </p>
        </div>
      )}

      {tab === "activity" && (
        <div className="ws-placeholder-tab">
          <FileText size={32} />
          <h3>Coordinator Activity</h3>
          <p>
            This will show Monday pulls, Case Brain assignments, routing,
            failures, Slack commands, and later Dropbox synchronization events.
          </p>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

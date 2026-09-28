"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Search, AlertTriangle, Loader2,
  FolderSearch2, Database, FileText, Play, RefreshCw, MessageSquareMore
} from "lucide-react";

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
  notesPreview?: string;
  mondayItemId?: string;
  dropboxFolder?: string | null;
};

type StartResult = {
  ok: boolean;
  matterId?: string;
  caseBrainStatus?: string;
  monday?: { found: boolean; fieldsImported?: number };
  dropbox?: { found: boolean; fileCount?: number; folder?: string | null };
  warning?: string | null;
  message?: string;
};

export default function SantiagoWorkstation({
  initialTab = "intake",
  onClose,
}: {
  initialTab?: "intake" | "dispatch" | "activity";
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"intake" | "dispatch" | "activity">(initialTab);
  const [query, setQuery] = useState("");
  const [matters, setMatters] = useState<SantiagoMatter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<StartResult | null>(null);

  const selected = useMemo(
    () => matters.find((m) => m.id === selectedId) ?? null,
    [matters, selectedId]
  );

  async function searchMatters(nextQuery = query) {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/santiago/matters?q=${encodeURIComponent(nextQuery.trim())}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setMatters(Array.isArray(data.matters) ? data.matters : []);
    } finally {
      setLoading(false);
    }
  }

  async function startMatter() {
    if (!selected) return;
    setStarting(true);
    setResult(null);
    try {
      const res = await fetch("/api/santiago/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId: selected.id,
          mondayItemId: selected.mondayItemId,
        }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, warning: "Unable to reach the intake workflow." });
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => { searchMatters(""); }, []);

  return (
    <div className="santiago-workstation">
      <div className="ws-topbar">
        <div className="ws-title-group">
          <button className="ws-back" onClick={onClose}><ArrowLeft size={18} /></button>
          <div className="ws-agent-badge"><MessageSquareMore size={22} /></div>
          <div>
            <div className="ws-kicker">SANTIAGO · AI OFFICE COORDINATOR</div>
            <h2>Coordinator Workstation</h2>
          </div>
        </div>
        <div className="ws-status"><span />Ready</div>
      </div>

      <div className="ws-tabs">
        <button className={tab === "intake" ? "active" : ""} onClick={() => setTab("intake")}>Matter Intake</button>
        <button className={tab === "dispatch" ? "active" : ""} onClick={() => setTab("dispatch")}>Dispatch</button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>Activity</button>
      </div>

      {tab === "intake" && (
        <div className="ws-content">
          <section className="ws-left">
            <div className="ws-section-head">
              <div>
                <span className="ws-eyebrow">MONDAY MATTERS</span>
                <h3>Assign a matter to Case Brain</h3>
              </div>
              <button className="icon-button" onClick={() => searchMatters()}><RefreshCw size={16} /></button>
            </div>

            <div className="matter-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") searchMatters(); }}
                placeholder="Search client, detainee, A-number..."
              />
              <button onClick={() => searchMatters()}>Search</button>
            </div>

            <div className="matter-list">
              {loading && <div className="matter-empty"><Loader2 className="spin" size={18} />Loading Monday matters...</div>}
              {!loading && matters.map((matter) => (
                <button
                  key={matter.id}
                  className={`matter-row ${selectedId === matter.id ? "selected" : ""}`}
                  onClick={() => { setSelectedId(matter.id); setResult(null); }}
                >
                  <div>
                    <strong>{matter.name}</strong>
                    <span>{[matter.practiceArea, matter.matterType].filter(Boolean).join(" · ") || "Matter"}</span>
                  </div>
                  <small>{matter.status || "Active"}</small>
                </button>
              ))}
              {!loading && matters.length === 0 && (
                <div className="matter-empty">No matters found. Search by client, detainee, or A-number.</div>
              )}
            </div>
          </section>

          <section className="ws-right">
            {!selected ? (
              <div className="select-placeholder">
                <Database size={30} />
                <h3>Select a Monday matter</h3>
                <p>Santiago will pull the matter data, look for the corresponding Dropbox folder, then prepare the matter for Case Brain.</p>
              </div>
            ) : (
              <>
                <div className="selected-matter-head">
                  <div>
                    <span className="ws-eyebrow">SELECTED MATTER</span>
                    <h3>{selected.name}</h3>
                    <p>{[selected.practiceArea, selected.matterType].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="matter-status-pill">{selected.status || "Active"}</div>
                </div>

                <div className="matter-facts">
                  <Fact label="Attorney" value={selected.attorney || "—"} />
                  <Fact label="PNC" value={selected.pncName || "—"} />
                  <Fact label="Detainee" value={selected.detaineeName || selected.name} />
                  <Fact label="A-Number" value={selected.aNumber || "—"} />
                  <Fact label="Facility" value={selected.detentionFacility || "—"} />
                  <Fact label="Monday Item" value={selected.mondayItemId || selected.id} />
                </div>

                <div className="source-checks">
                  <div className="source-card">
                    <div className="source-card-icon"><Database size={18} /></div>
                    <div><strong>Monday Data</strong><span>Intake fields, matter metadata, and attorney notes</span></div>
                    <CheckCircle2 size={18} className="ok-icon" />
                  </div>

                  <div className="source-card">
                    <div className="source-card-icon"><FolderSearch2 size={18} /></div>
                    <div>
                      <strong>Dropbox Documents</strong>
                      <span>{selected.dropboxFolder || "Folder lookup occurs when the matter starts"}</span>
                    </div>
                    <span className="pending-chip">CHECK ON START</span>
                  </div>
                </div>

                {selected.notesPreview && (
                  <div className="notes-preview">
                    <span>ATTORNEY NOTES PREVIEW</span>
                    <p>{selected.notesPreview}</p>
                  </div>
                )}

                {result && (
                  <div className={`start-result ${result.ok ? "success" : "error"}`}>
                    <div className="start-result-head">
                      {result.ok ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
                      <strong>{result.message || (result.ok ? "Matter intake started" : "Matter could not be started")}</strong>
                    </div>
                    {result.monday && <p>Monday: {result.monday.found ? `${result.monday.fieldsImported ?? 0} fields imported` : "not found"}</p>}
                    {result.dropbox && <p>Dropbox: {result.dropbox.found ? `${result.dropbox.fileCount ?? 0} documents found` : "documents pending"}</p>}
                    {result.warning && <p>{result.warning}</p>}
                  </div>
                )}

                <button className="start-casebrain" disabled={starting} onClick={startMatter}>
                  {starting ? <><Loader2 className="spin" size={18} />Preparing matter...</> : <><Play size={18} />Start Case Brain</>}
                </button>

                <p className="ws-help">
                  If the Dropbox folder cannot be found, the matter will still be created and marked <strong>Documents Pending</strong>.
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "dispatch" && (
        <div className="ws-placeholder-tab">
          <MessageSquareMore size={32} />
          <h3>Dispatch Center</h3>
          <p>This is where Santiago will route tasks to Elena, Mateo, Docket, Chronos, Veritas, and the rest of the AI team.</p>
        </div>
      )}

      {tab === "activity" && (
        <div className="ws-placeholder-tab">
          <FileText size={32} />
          <h3>Coordinator Activity</h3>
          <p>This tab will show matter creation, routing, Dropbox syncs, agent assignments, failures, and Slack-triggered activity.</p>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="fact"><span>{label}</span><strong>{value}</strong></div>;
}

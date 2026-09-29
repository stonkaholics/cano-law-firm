"use client";

import {
  ArrowLeft,
  BrainCircuit,
  ChevronDown,
  CircleAlert,
  FilePenLine,
  Layers3,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";
import type { SpecialistAgentId, SpecialistState } from "./SpecialistWorkstation";

const TEAM: Array<{ id: SpecialistAgentId; name: string; role: string }> = [
  { id: "research", name: "Lex", role: "Research" },
  { id: "habeas", name: "Elena", role: "Habeas" },
  { id: "bond", name: "Mateo", role: "Bond" },
  { id: "timeline", name: "Chronos", role: "Timeline" },
  { id: "hearing", name: "Avery", role: "Hearing Prep" },
  { id: "qa", name: "Veritas", role: "Filing QA" },
];

export default function IntelligenceManagerWorkstation({
  matter, states, onClose, onOpenAgent, onOpenDrafting, onUpdated,
}: {
  matter: StoredCaseMatter | null;
  states: Record<string, SpecialistState>;
  onClose: () => void;
  onOpenAgent: (agentId: SpecialistAgentId) => void;
  onOpenDrafting?: () => void;
  onUpdated?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const atlas = states.synthesis || {};
  const output = atlas.output;

  const matterName = useMemo(() => String(
    matter?.caseBrain?.people?.detainee?.name ||
    matter?.caseBrain?.people?.detainee?.full_name ||
    matter?.monday?.preview?.detaineeName ||
    matter?.monday?.preview?.name ||
    matter?.matterId || "No Active Matter"
  ), [matter]);

  async function refreshAtlas() {
    if (!matter || running) return;
    setRunning(true); setError("");
    try {
      const mondayItemId = matter.mondayItemId || matter.matterId;
      const res = await fetch("/api/agents/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mondayItemId, agentId: "synthesis", triggerType: atlas?.run ? "refresh" : "manual" }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Unable to refresh Atlas.");
      const started = Date.now();
      while (Date.now() - started < 120000) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const stateRes = await fetch(`/api/agents/state?mondayItemId=${encodeURIComponent(mondayItemId)}`, { cache: "no-store" });
        const stateData = await stateRes.json();
        const next = stateData?.agents?.synthesis;
        if (["review_ready", "needs_review", "error"].includes(next?.run?.status)) { onUpdated?.(); return; }
      }
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh Atlas.");
    } finally { setRunning(false); }
  }

  const completedCount = TEAM.filter((a) => Boolean(states[a.id]?.output)).length;
  const blockerCount = output?.readiness?.blocking_items?.length || 0;
  const topBlockers = (output?.readiness?.blocking_items || []).slice(0, 4);
  const topActions = (output?.next_actions || []).slice(0, 4);

  return (
    <div className="atlas-workstation atlas-clean">
      <header className="atlas-topbar">
        <div className="atlas-title">
          <button className="ws-back" onClick={onClose}><ArrowLeft size={18}/></button>
          <div className="atlas-icon"><BrainCircuit size={22}/></div>
          <div><span className="ws-eyebrow">ATLAS · MATTER INTELLIGENCE MANAGER</span><h2>Intelligence Manager</h2></div>
        </div>
        <div className={`specialist-status ${atlas?.run?.status || "ready"}`}><span />{(atlas?.run?.status || "ready").replaceAll("_", " ")}</div>
      </header>

      <main className="atlas-shell">
        {!matter ? (
          <div className="specialist-empty"><CircleAlert size={30}/><h3>No active matter</h3><p>Select a shared matter from Matter Center.</p></div>
        ) : (
          <>
            <section className="atlas-hero">
              <div><span className="ws-eyebrow">ACTIVE INTELLIGENCE DOSSIER</span><h1>{matterName}</h1><p>A concise attorney dashboard first. Expand only the sections you need.</p></div>
              <div className="atlas-hero-actions">
                {onOpenDrafting && <button className="atlas-draft-btn" onClick={onOpenDrafting}><FilePenLine size={15}/>Open Draft Manager</button>}
                <button className="specialist-run-btn" disabled={running} onClick={refreshAtlas}>{running || atlas?.run?.status === "working" ? <><Loader2 className="spin" size={16}/>Compiling...</> : <><RefreshCw size={16}/>Refresh Intelligence</>}</button>
              </div>
            </section>

            {error && <div className="specialist-error"><CircleAlert size={16}/>{error}</div>}

            {atlas?.run?.status === "working" && output && (
              <div className="atlas-refresh-banner">
                <Loader2 className="spin" size={14}/>
                Atlas is refreshing in the background. The last completed dossier
                remains visible until the new synthesis is saved.
              </div>
            )}

            <section className="atlas-metrics">
              <Metric label="Specialists Complete" value={`${completedCount}/${TEAM.length}`} />
              <Metric label="Current Pipeline" value={matter.pipeline?.stage?.replaceAll("_", " ") || "Awaiting stage"} />
              <Metric label="Team Blockers" value={String(blockerCount)} />
              <Metric label="Attorney Review" value={output?.readiness?.attorney_review_required ? "Required" : "Pending"} />
            </section>

            <section className="atlas-priority-grid">
              <div className="atlas-card atlas-summary">
                <div className="atlas-card-title"><BrainCircuit size={17}/>Executive Intelligence Brief</div>
                {output?.executive_summary ? <p>{output.executive_summary}</p> : <div className="atlas-awaiting"><Loader2 className={atlas?.run?.status === "working" ? "spin" : ""} size={20}/><div><strong>{atlas?.run?.status === "working" ? "Atlas is compiling" : "No intelligence synthesis yet"}</strong><span>Run or refresh Atlas after specialists complete.</span></div></div>}
              </div>

              <div className="atlas-priority-side">
                <PriorityCard title="Top blockers" items={topBlockers} total={blockerCount} />
                <PriorityCard title="Next actions" items={topActions} total={output?.next_actions?.length || 0} />
              </div>
            </section>

            <section className="atlas-accordion-stack">
              {(output?.sections || []).map((section, index) => (
                <AtlasAccordion key={`${section.title}-${index}`} title={section.title || "Intelligence"} count={section.items?.length || 0}>
                  <div className="atlas-section-items">
                    {(section.items || []).map((item, itemIndex) => (
                      <div className="atlas-intel-item" key={itemIndex}>
                        <div className="atlas-intel-head"><strong>{item.label}</strong><span className={`confidence ${item.confidence || "analysis"}`}>{(item.confidence || "analysis").toUpperCase()}</span></div>
                        <p>{item.detail}</p><small>{item.source || "Atlas synthesis"}</small>
                      </div>
                    ))}
                  </div>
                </AtlasAccordion>
              ))}

              <AtlasAccordion title="Specialist records" count={TEAM.length}>
                <div className="atlas-specialist-compact-grid">
                  {TEAM.map((agent) => {
                    const state = states[agent.id];
                    const status = state?.run?.status || (state?.output ? "review_ready" : "not_run");
                    return <button className="atlas-agent-compact" key={agent.id} onClick={() => onOpenAgent(agent.id)}><span className={`atlas-agent-dot ${status}`}/><div><strong>{agent.name}</strong><small>{agent.role} · {status.replaceAll("_", " ")}</small></div></button>;
                  })}
                </div>
              </AtlasAccordion>

              <AtlasAccordion title="Open questions" count={output?.open_questions?.length || 0}><SimpleList items={output?.open_questions || []}/></AtlasAccordion>
              <AtlasAccordion title="Warnings" count={output?.warnings?.length || 0}><SimpleList items={output?.warnings || []}/></AtlasAccordion>
              <AtlasAccordion title="All blockers" count={blockerCount}><SimpleList items={output?.readiness?.blocking_items || []}/></AtlasAccordion>
              <AtlasAccordion title="All next actions" count={output?.next_actions?.length || 0}><SimpleList items={output?.next_actions || []}/></AtlasAccordion>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="atlas-metric"><span>{label}</span><strong>{value}</strong></div>; }

function PriorityCard({ title, items, total }: { title: string; items: string[]; total: number }) {
  return <div className="atlas-card atlas-priority-card"><div className="atlas-card-title">{title}<span className="atlas-count">{total}</span></div>{items.length ? <ul>{items.map((item,i)=><li key={i}>{item}</li>)}</ul> : <p className="specialist-none">None currently listed.</p>}</div>;
}

function AtlasAccordion({ title, count, defaultOpen=false, children }: { title: string; count: number; defaultOpen?: boolean; children: React.ReactNode }) {
  return <details className="atlas-accordion" open={defaultOpen}><summary><div><Layers3 size={15}/><strong>{title}</strong><span>{count}</span></div><ChevronDown size={16}/></summary><div className="atlas-accordion-body">{children}</div></details>;
}

function SimpleList({ items }: { items: string[] }) { return items.length ? <ul className="atlas-list">{items.map((item,i)=><li key={i}>{item}</li>)}</ul> : <p className="specialist-none">None currently listed.</p>; }

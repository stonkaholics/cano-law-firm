"use client";

import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  FilePenLine,
  Loader2,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";
import type { SpecialistState } from "./SpecialistWorkstation";

type DraftType = "habeas" | "bond_motion";

export default function DraftManagerWorkstation({
  matter,
  states,
  onClose,
  onUpdated,
}: {
  matter: StoredCaseMatter | null;
  states: Record<string, SpecialistState>;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [draftType, setDraftType] = useState<DraftType>("habeas");
  const [running, setRunning] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const state = states.drafting || {};
  const output: any = state.output || null;
  const draft = output?.draft || null;

  const matterName = useMemo(() => String(
    matter?.caseBrain?.people?.detainee?.name ||
    matter?.caseBrain?.people?.detainee?.full_name ||
    matter?.monday?.preview?.detaineeName ||
    matter?.monday?.preview?.name ||
    matter?.matterId ||
    "No Active Matter"
  ), [matter]);

  async function generate() {
    if (!matter || running) return;
    setRunning(true); setError("");
    try {
      const mondayItemId = matter.mondayItemId || matter.matterId;
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mondayItemId,
          agentId: "drafting",
          triggerType: state?.run ? "refresh" : "manual",
          options: { draftType },
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Unable to start Scribe.");

      const started = Date.now();
      while (Date.now() - started < 180000) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const r = await fetch(`/api/agents/state?mondayItemId=${encodeURIComponent(mondayItemId)}`, { cache: "no-store" });
        const d = await r.json();
        const next = d?.agents?.drafting;
        if (["review_ready", "needs_review", "error"].includes(next?.run?.status)) {
          onUpdated?.();
          return;
        }
      }
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate draft.");
    } finally {
      setRunning(false);
    }
  }

  async function review(decision: "approved" | "needs_changes") {
    if (!matter || reviewing) return;
    setReviewing(true); setError("");
    try {
      const mondayItemId = matter.mondayItemId || matter.matterId;
      const res = await fetch("/api/drafts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mondayItemId, decision }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Unable to save attorney decision.");
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save attorney decision.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="draft-workstation">
      <header className="atlas-topbar">
        <div className="atlas-title">
          <button className="ws-back" onClick={onClose}><ArrowLeft size={18} /></button>
          <div className="atlas-icon"><FilePenLine size={22} /></div>
          <div>
            <span className="ws-eyebrow">SCRIBE · LEGAL DRAFTING MANAGER</span>
            <h2>Draft Review Center</h2>
          </div>
        </div>
        <div className={`specialist-status ${state?.run?.status || "ready"}`}>
          <span />{(state?.run?.status || "ready").replaceAll("_", " ")}
        </div>
      </header>

      <main className="draft-shell">
        {!matter ? (
          <div className="specialist-empty"><CircleAlert size={30}/><h3>No active matter</h3><p>Select a shared matter first.</p></div>
        ) : (
          <>
            <section className="draft-hero">
              <div>
                <span className="ws-eyebrow">ATTORNEY WORK PRODUCT · ACTIVE MATTER</span>
                <h1>{matterName}</h1>
                <p>Scribe creates a working draft from Case Brain, specialist analysis, verified authority, and firm templates when supplied. Nothing is filed automatically.</p>
              </div>
              <div className="draft-actions-top">
                <select value={draftType} onChange={(e) => setDraftType(e.target.value as DraftType)}>
                  <option value="habeas">Habeas Corpus Draft</option>
                  <option value="bond_motion">Bond Motion Draft</option>
                </select>
                <button className="specialist-run-btn" onClick={generate} disabled={running}>
                  {running || state?.run?.status === "working" ? <><Loader2 className="spin" size={16}/>Drafting...</> : <><FilePenLine size={16}/>{draft ? "Regenerate Draft" : "Generate Draft"}</>}
                </button>
              </div>
            </section>

            <div className="draft-warning"><ShieldAlert size={16}/><span>Attorney review is mandatory. Any case used in the draft remains subject to the firm's citator review before filing.</span></div>
            {error && <div className="specialist-error"><CircleAlert size={16}/>{error}</div>}

            {!draft ? (
              <section className="draft-empty-card">
                <FilePenLine size={30}/><h3>No working draft yet</h3>
                <p>Choose Habeas or Bond Motion and generate a draft after the research agents have completed. When Mariela's firm-authored samples are added, Scribe can use them as structural/style references.</p>
              </section>
            ) : (
              <>
                <section className="draft-review-bar">
                  <div>
                    <span>ATTORNEY REVIEW STATUS</span>
                    <strong>{String(draft.approval_status || "pending_attorney_review").replaceAll("_", " ")}</strong>
                  </div>
                  <div className="draft-review-actions">
                    <button className="draft-needs-btn" disabled={reviewing} onClick={() => review("needs_changes")}><XCircle size={15}/>Needs Changes</button>
                    <button className="draft-approve-btn" disabled={reviewing} onClick={() => review("approved")}><CheckCircle2 size={15}/>Approve Draft</button>
                  </div>
                </section>

                <section className="draft-meta-grid">
                  <div><span>Document</span><strong>{String(draft.document_type || draftType).replaceAll("_", " ")}</strong></div>
                  <div><span>Template</span><strong>{String(draft.template_status || "no_template_supplied").replaceAll("_", " ")}</strong></div>
                  <div><span>Placeholders</span><strong>{draft.placeholders?.length || 0}</strong></div>
                  <div><span>Authority Checks</span><strong>{draft.authority_checklist?.length || 0}</strong></div>
                </section>

                <details className="draft-review-details" open>
                  <summary>Working Draft · {draft.title || "Untitled"}</summary>
                  <div className="draft-document">{draft.markdown || "No draft text returned."}</div>
                </details>

                <details className="draft-review-details">
                  <summary>Attorney Input Needed ({draft.placeholders?.length || 0})</summary>
                  <ul>{(draft.placeholders || []).map((item: string, i: number) => <li key={i}>{item}</li>)}</ul>
                </details>

                <details className="draft-review-details">
                  <summary>Authority Checklist ({draft.authority_checklist?.length || 0})</summary>
                  <div className="draft-authority-list">{(draft.authority_checklist || []).map((item: any, i: number) => <div key={i}><strong>{item.authority}</strong><span>{String(item.status || "").replaceAll("_", " ")}</span><p>{item.note}</p></div>)}</div>
                </details>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

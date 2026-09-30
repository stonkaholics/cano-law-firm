"use client";

import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  FilePenLine,
  FileDown,
  ExternalLink,
  Loader2,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";
import type { SpecialistState } from "./SpecialistWorkstation";

type DraftType = "habeas" | "bond_motion";

const INLINE_PLACEHOLDER_MAP: Record<
  string,
  { short: string; detail: string }
> = {
  "ATTORNEY INPUT NEEDED: CONFIRM DIVISION": {
    short: "DIVISION TBD",
    detail: "Confirm the correct federal court division before filing.",
  },
  "ATTORNEY INPUT NEEDED: CORRECT DISTRICT": {
    short: "DISTRICT TBD",
    detail: "Confirm the correct federal district before filing.",
  },
  "ATTORNEY INPUT NEEDED: CONFIRM DISTRICT": {
    short: "DISTRICT TBD",
    detail: "Confirm the correct federal district before filing.",
  },
  "ATTORNEY INPUT NEEDED: PETITIONER FULL NAME": {
    short: "PETITIONER NAME TBD",
    detail: "Confirm the petitioner's full legal name.",
  },
  "ATTORNEY INPUT NEEDED: PRIMARY CUSTODIAN NAME AND TITLE": {
    short: "RESPONDENT TBD",
    detail: "Confirm the proper habeas respondent name and title.",
  },
  "ATTORNEY INPUT NEEDED: CIVIL ACTION NUMBER": {
    short: "CASE NO. TBD",
    detail: "Insert the civil action number once assigned.",
  },
  "ATTORNEY INPUT NEEDED: CASE NUMBER": {
    short: "CASE NO. TBD",
    detail: "Insert the case number once assigned.",
  },
  "ATTORNEY INPUT NEEDED: CONFIRM A-NUMBER": {
    short: "A-NUMBER TBD",
    detail: "Confirm the correct A-number.",
  },
  "ATTORNEY INPUT NEEDED: CONFIRM DETENTION DATE": {
    short: "DETENTION DATE TBD",
    detail: "Confirm the operative detention date from the record.",
  },
  "ATTORNEY INPUT NEEDED: CONFIRM REQUESTED RELIEF": {
    short: "RELIEF TBD",
    detail: "Confirm the final requested relief before filing.",
  },
  "ATTORNEY INPUT NEEDED: VERIFICATION DATE": {
    short: "DATE TBD",
    detail: "Insert the verification date.",
  },
};

function normalizePlaceholderKey(raw: string) {
  return String(raw || "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function shortPlaceholderLabel(raw: string) {
  const normalized = normalizePlaceholderKey(raw);
  const mapped = INLINE_PLACEHOLDER_MAP[normalized];
  if (mapped) return mapped.short;

  const cleaned = normalized
    .replace(/^ATTORNEY INPUT NEEDED:\s*/i, "")
    .replace(/^(CONFIRM|INSERT|PROVIDE|VERIFY)\s+/i, "")
    .trim();

  if (!cleaned) return "INPUT TBD";
  if (/\bTBD\b$/i.test(cleaned)) return cleaned;
  if (cleaned.length <= 26) return `${cleaned} TBD`;

  const firstMeaningful = cleaned
    .split(/[,;:–—-]/)[0]
    .trim()
    .slice(0, 24)
    .trim();

  return `${firstMeaningful || "INPUT"} TBD`;
}

function placeholderDetail(raw: string) {
  const normalized = normalizePlaceholderKey(raw);
  return INLINE_PLACEHOLDER_MAP[normalized]?.detail || String(raw || "")
    .replace(/^\[?ATTORNEY INPUT NEEDED:\s*/i, "")
    .replace(/\]$/, "")
    .trim();
}



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
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [error, setError] = useState("");
  const [attorneyInputs, setAttorneyInputs] = useState<Record<string, string>>({});
  const [inputSaved, setInputSaved] = useState(false);
  const [activePlaceholder, setActivePlaceholder] = useState<string | null>(null);
  const state = states.drafting || {};
  const output: any = state.output || null;
  const draft = output?.draft || null;

  const verifiedAuthorities = useMemo(() => {
    return ["research", "habeas", "bond"].flatMap((agentId) =>
      states[agentId]?.output?.authorities || []
    );
  }, [states]);

  function sourceForChecklist(authorityName?: string) {
    const needle = String(authorityName || "").trim().toLowerCase();
    if (!needle) return null;

    return (
      verifiedAuthorities.find((authority) => {
        const citation = String(authority?.citation || "").toLowerCase();
        const title = String(authority?.title || "").toLowerCase();
        return (
          (citation && (needle.includes(citation) || citation.includes(needle))) ||
          (title && (needle.includes(title) || title.includes(needle)))
        );
      }) || null
    );
  }

  const placeholders = useMemo(
    () => (Array.isArray(draft?.placeholders) ? draft.placeholders : []),
    [draft]
  );

  const mondayItemId = matter?.mondayItemId || matter?.matterId || "";
  const inputStorageKey = mondayItemId
    ? `cano_draft_attorney_inputs_${mondayItemId}`
    : "";

  useEffect(() => {
    if (!inputStorageKey || typeof window === "undefined") {
      setAttorneyInputs({});
      return;
    }

    try {
      const saved = window.localStorage.getItem(inputStorageKey);
      setAttorneyInputs(saved ? JSON.parse(saved) : {});
    } catch {
      setAttorneyInputs({});
    }
  }, [inputStorageKey]);

  function saveAttorneyInputs(next = attorneyInputs) {
    if (!inputStorageKey || typeof window === "undefined") return;
    window.localStorage.setItem(inputStorageKey, JSON.stringify(next));
    setInputSaved(true);
    window.setTimeout(() => setInputSaved(false), 1400);
  }

  function updateAttorneyInput(key: string, value: string) {
    const next = { ...attorneyInputs, [key]: value };
    setAttorneyInputs(next);
    if (inputStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(inputStorageKey, JSON.stringify(next));
    }
  }

  const completedInputs = placeholders.filter(
    (item: string) => String(attorneyInputs[item] || "").trim().length > 0
  ).length;

  function normalizePlaceholder(value: string) {
    return String(value || "")
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function placeholderAliases(item: string) {
    const normalized = normalizePlaceholder(item);
    const short = normalizePlaceholder(shortPlaceholderLabel(item));
    const cleaned = normalizePlaceholder(
      String(item || "")
        .replace(/^\[?ATTORNEY INPUT NEEDED:\s*/i, "")
        .replace(/^\[?ATTORNEY \/ RESEARCH INPUT NEEDED:\s*/i, "")
        .replace(/\]$/, "")
        .replace(/^(confirm|insert|provide|verify)\s+/i, "")
        .trim()
    );

    return Array.from(new Set([normalized, short, cleaned].filter(Boolean)));
  }

  function resolvePlaceholderFromDraft(part: string) {
    const normalized = normalizePlaceholder(part);

    const exact = placeholders.find((item: string) =>
      placeholderAliases(item).includes(normalized)
    );
    if (exact) return exact;

    // Scribe sometimes emits the compact display token directly, e.g.
    // [DIVISION TBD], [RESPONDENT TBD], [CASE NO. TBD]. Match those back
    // to the original draft.placeholders entry so the yellow editor survives
    // regeneration and compact-caption formatting.
    const compactNeedle = normalized
      .replace(/^attorney input needed:\s*/i, "")
      .replace(/^attorney \/ research input needed:\s*/i, "")
      .replace(/^(confirm|insert|provide|verify)\s+/i, "")
      .trim();

    const fuzzy = placeholders.find((item: string) =>
      placeholderAliases(item).some((alias) => {
        const compactAlias = alias
          .replace(/^attorney input needed:\s*/i, "")
          .replace(/^attorney \/ research input needed:\s*/i, "")
          .replace(/^(confirm|insert|provide|verify)\s+/i, "")
          .trim();

        return (
          compactAlias === compactNeedle ||
          compactAlias.replace(/\btbd\b$/i, "").trim() ===
            compactNeedle.replace(/\btbd\b$/i, "").trim()
        );
      })
    );

    return fuzzy || part;
  }

  function isEditablePlaceholderToken(part: string) {
    if (!/^\[[^\]\n]+\]$/.test(part)) return false;

    const resolved = resolvePlaceholderFromDraft(part);
    if (placeholders.includes(resolved)) return true;

    return /^\[(ATTORNEY INPUT NEEDED:|ATTORNEY \/ RESEARCH INPUT NEEDED:)/i.test(part);
  }

  function scrollToInputEditor(focusPlaceholder?: string) {
    const editor = document.getElementById("attorney-input-editor");
    editor?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (!focusPlaceholder) return;

    const index = placeholders.findIndex(
      (item: string) =>
        normalizePlaceholder(item) ===
        normalizePlaceholder(focusPlaceholder)
    );

    if (index >= 0) {
      window.setTimeout(() => {
        const field = document.getElementById(
          `attorney-input-${index}`
        ) as HTMLTextAreaElement | null;
        field?.focus();
      }, 450);
    }
  }

  function openPlaceholderEditor(part: string) {
    setActivePlaceholder(resolvePlaceholderFromDraft(part));
  }

  function renderHighlightedDraft(markdown: string) {
    // Split on every bracket token, then only convert recognized unresolved
    // draft.placeholders into interactive pills. This supports both the full
    // [ATTORNEY INPUT NEEDED: ...] form and compact tokens such as
    // [DIVISION TBD], [RESPONDENT TBD], and [CASE NO. TBD].
    const parts = String(markdown || "").split(/(\[[^\]\n]{2,180}\])/g);

    return parts.map((part, index) => {
      if (!isEditablePlaceholderToken(part)) {
        return <span key={index}>{part}</span>;
      }

      const key = resolvePlaceholderFromDraft(part);
      const completed = Boolean(String(attorneyInputs[key] || "").trim());

      return (
        <button
          className={`draft-placeholder-highlight ${completed ? "completed" : ""}`}
          key={index}
          type="button"
          title={placeholderDetail(key)}
          onClick={() => openPlaceholderEditor(part)}
        >
          [{shortPlaceholderLabel(key)}]
        </button>
      );
    });
  }

  const matterName = useMemo(() => String(
    matter?.caseBrain?.people?.detainee?.name ||
    matter?.caseBrain?.people?.detainee?.full_name ||
    matter?.monday?.preview?.detaineeName ||
    matter?.monday?.preview?.name ||
    matter?.matterId ||
    "No Active Matter"
  ), [matter]);

  async function generate(useAttorneyInputs = false) {
    if (!matter || running) return;
    setRunning(true); setError("");

    if (useAttorneyInputs) {
      saveAttorneyInputs();
    }
    try {
      const mondayItemId = matter.mondayItemId || matter.matterId;
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mondayItemId,
          agentId: "drafting",
          triggerType: state?.run ? "refresh" : "manual",
          options: {
            draftType,
            draftingMode: "full_motion",
            targetLength:
              draftType === "habeas"
                ? "5500-8500 words; aim for roughly 16-20 substantive pages when the supplied record genuinely supports that length"
                : "3000-5000 words",
            attorneyWorkProduct: true,
            attorneyInputs: useAttorneyInputs
              ? Object.fromEntries(
                  Object.entries(attorneyInputs).filter(
                    ([, value]) => String(value || "").trim().length > 0
                  )
                )
              : {},
            attorneyInputInstructions: useAttorneyInputs
              ? [
                  "Treat each attorney input as attorney-supplied matter information.",
                  "Use the supplied value to resolve the matching ATTORNEY INPUT NEEDED placeholder.",
                  "Remove resolved placeholder language from the regenerated draft.",
                  "Do not alter unrelated facts merely because attorney input was supplied.",
                  "If an attorney input creates a conflict with existing matter data, preserve and flag that conflict for attorney review rather than silently resolving it."
                ]
              : [],
            draftingRequirements: [
              "Return a complete attorney-editable pleading, not an outline.",
              "Draft substantive prose for each section using the supplied matter record and specialist analyses.",
              "Use ATTORNEY INPUT NEEDED placeholders only for facts that are actually missing.",
              "Do not leave section-level notes telling the attorney to insert or adapt text later.",
              "Use only authorities present in verified research inputs and preserve all citator-review warnings.",
              "Include adverse facts, contradictions, and uncertainty where relevant.",
              "Treat Case Brain and verified specialist outputs as the controlling factual record; raw intake remains provenance only.",
              "Do not state a detention statute, final-order posture, respondent, district, division, venue, hearing history, or custody classification as established unless the supplied record actually verifies it.",
              "When custody authority is unresolved between 8 U.S.C. sections 1225, 1226, and 1231, draft alternative theories conditionally and label the unresolved predicate rather than collapsing them into one conclusion.",
              "Do not state that due process categorically requires a bond hearing, a particular burden of proof, or a particular evidentiary standard unless verified authority supplied for the governing jurisdiction supports that exact proposition.",
              "Do not request immediate release, a bond hearing, fees, injunctions, or any other specific remedy as a settled filing position unless the record and verified authority support it; use an attorney decision placeholder when strategy remains open.",
              "Use Supreme Court and governing circuit authority before persuasive district-court authority. Clearly label persuasive cases as persuasive.",
              "Never use Constitution Annotated, a treatise, a blog, or a secondary source as a substitute for available primary authority. Secondary sources may orient the discussion but should not carry a dispositive proposition when primary authority is supplied.",
              "Every material legal proposition in the argument should be traceable to an authority in draft.authority_checklist.",
              "Every quoted proposition must come from supplied source text. If exact source text is unavailable, paraphrase without quotation marks.",
              "Use careful record-language such as 'the supplied record does not show' instead of broad claims such as 'there is no evidence' when the system only lacks documents.",
              "Do not add detention-condition allegations, family facts, supervision history, community ties, compliance history, or similar equities unless actually supplied.",
              "Before finalizing the draft, run an internal consistency pass for names, A-number, dates, detention facility, court, district, division, detention statute, procedural posture, requested relief, and paragraph numbering.",
              "The prayer for relief must track only arguments actually developed in the pleading and must preserve unresolved strategic choices for attorney review.",
              "When request.firmDraftingProfile is supplied, treat it as Cano Law Firm's controlling STYLE + STRUCTURE profile for habeas drafting. Never copy exemplar client facts into the active matter.",
              "The five firm petitions are drafting exemplars only. The court order is a separate outcome reference and must not be cited as authority unless it also appears in verified authority research.",
              "When the Cano habeas profile is supplied, set draft.template_status to cano_habeas_exemplars_v1.",
            ],
          },
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

  async function exportDraft(format: "docx" | "pdf") {
    if (!matter || !draft || exporting) return;
    setExporting(format);
    setError("");

    try {
      const mondayItemId = matter.mondayItemId || matter.matterId;
      const res = await fetch(
        `/api/drafts/export?mondayItemId=${encodeURIComponent(
          mondayItemId
        )}&format=${format}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Unable to export ${format.toUpperCase()}.`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename =
        match?.[1] ||
        `${matterName.replace(/[^a-z0-9]+/gi, "-")}-draft.${format}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to export draft."
      );
    } finally {
      setExporting(null);
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
                <button className="specialist-run-btn" onClick={() => generate(false)} disabled={running}>
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
                    <button
                      className="draft-input-jump-btn"
                      type="button"
                      onClick={() => scrollToInputEditor()}
                    >
                      <FilePenLine size={15}/>
                      Review Inputs ({placeholders.length - completedInputs})
                    </button>
                    <button className="draft-export-btn" disabled={Boolean(exporting)} onClick={() => exportDraft("docx")}>
                      {exporting === "docx" ? <Loader2 className="spin" size={15}/> : <FileDown size={15}/>}
                      DOCX
                    </button>
                    <button className="draft-export-btn" disabled={Boolean(exporting)} onClick={() => exportDraft("pdf")}>
                      {exporting === "pdf" ? <Loader2 className="spin" size={15}/> : <FileDown size={15}/>}
                      PDF
                    </button>
                    <button className="draft-needs-btn" disabled={reviewing} onClick={() => review("needs_changes")}><XCircle size={15}/>Needs Changes</button>
                    <button className="draft-approve-btn" disabled={reviewing} onClick={() => review("approved")}><CheckCircle2 size={15}/>Approve Draft</button>
                  </div>
                </section>

                <section className="draft-meta-grid">
                  <div><span>Document</span><strong>{String(draft.document_type || draftType).replaceAll("_", " ")}</strong></div>
                  <div><span>Template</span><strong>{String(draft.template_status || "no_template_supplied").replaceAll("_", " ")}</strong></div>
                  <div><span>Placeholders</span><strong>{placeholders.length}</strong></div>
                  <div><span>Authority Checks</span><strong>{draft.authority_checklist?.length || 0}</strong></div>
                </section>

                <details className="draft-review-details" open>
                  <summary>Working Draft · {draft.title || "Untitled"}</summary>
                  <div className="draft-document">{renderHighlightedDraft(draft.markdown || "No draft text returned.")}</div>
                </details>

                <details
                  className="draft-review-details draft-input-editor"
                  id="attorney-input-editor"
                  open
                >
                  <summary>
                    Attorney Input Editor ({completedInputs}/{placeholders.length} completed)
                  </summary>

                  <div className="draft-input-editor-head">
                    <div>
                      <strong>Fill the missing facts here</strong>
                      <span>
                        These values save in this browser automatically. When ready,
                        regenerate Scribe and the completed inputs are sent back into
                        the matter draft so resolved placeholders can disappear.
                      </span>
                    </div>

                    <div className="draft-input-editor-actions">
                      <button
                        className="draft-input-save-btn"
                        onClick={() => saveAttorneyInputs()}
                        type="button"
                      >
                        <Save size={14}/>
                        {inputSaved ? "Saved" : "Save Inputs"}
                      </button>

                      <button
                        className="draft-input-regenerate-btn"
                        onClick={() => generate(true)}
                        disabled={running || completedInputs === 0}
                        type="button"
                      >
                        {running ? (
                          <Loader2 className="spin" size={14}/>
                        ) : (
                          <Sparkles size={14}/>
                        )}
                        Regenerate With Inputs
                      </button>
                    </div>
                  </div>

                  {placeholders.length ? (
                    <div className="draft-input-grid">
                      {placeholders.map((item: string, i: number) => {
                        const value = attorneyInputs[item] || "";
                        return (
                          <div
                            className={`draft-input-card ${value.trim() ? "complete" : ""}`}
                            id={`attorney-input-card-${i}`}
                            key={i}
                          >
                            <div className="draft-input-card-number">{i + 1}</div>
                            <div className="draft-input-card-body">
                              <label htmlFor={`attorney-input-${i}`}>
                                {placeholderDetail(item)}
                              </label>
                              <textarea
                                id={`attorney-input-${i}`}
                                value={value}
                                onChange={(event) =>
                                  updateAttorneyInput(item, event.target.value)
                                }
                                placeholder="Attorney input..."
                                rows={3}
                              />
                              <span>
                                {value.trim()
                                  ? "Ready to integrate on regeneration"
                                  : "Still unresolved"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="draft-input-complete">
                      <CheckCircle2 size={18}/>
                      No unresolved attorney-input placeholders are listed.
                    </div>
                  )}
                </details>

                {activePlaceholder ? (
                  <div
                    className="draft-quick-input-backdrop"
                    onMouseDown={(event) => {
                      if (event.currentTarget === event.target) {
                        setActivePlaceholder(null);
                      }
                    }}
                  >
                    <section
                      className="draft-quick-input"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Attorney input"
                    >
                      <div className="draft-quick-input-head">
                        <div>
                          <span>ATTORNEY INPUT</span>
                          <h3>
                            {placeholderDetail(activePlaceholder)}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActivePlaceholder(null)}
                          aria-label="Close"
                        >
                          <X size={16}/>
                        </button>
                      </div>

                      <textarea
                        autoFocus
                        rows={5}
                        value={attorneyInputs[activePlaceholder] || ""}
                        onChange={(event) =>
                          updateAttorneyInput(
                            activePlaceholder,
                            event.target.value
                          )
                        }
                        placeholder="Type the attorney-supplied information here..."
                      />

                      <div className="draft-quick-input-status">
                        {String(attorneyInputs[activePlaceholder] || "").trim()
                          ? "Saved locally and ready to integrate"
                          : "This placeholder is still unresolved"}
                      </div>

                      <div className="draft-quick-input-actions">
                        <button
                          className="draft-input-save-btn"
                          type="button"
                          onClick={() => {
                            saveAttorneyInputs();
                            setActivePlaceholder(null);
                          }}
                        >
                          <Save size={14}/>
                          Save & Continue
                        </button>

                        <button
                          className="draft-quick-jump-btn"
                          type="button"
                          onClick={() => {
                            const target = activePlaceholder;
                            setActivePlaceholder(null);
                            scrollToInputEditor(target);
                          }}
                        >
                          <FilePenLine size={14}/>
                          Open in Input Editor
                        </button>

                        <button
                          className="draft-input-regenerate-btn"
                          type="button"
                          disabled={
                            running ||
                            !String(
                              attorneyInputs[activePlaceholder] || ""
                            ).trim()
                          }
                          onClick={() => {
                            setActivePlaceholder(null);
                            generate(true);
                          }}
                        >
                          {running ? (
                            <Loader2 className="spin" size={14}/>
                          ) : (
                            <Sparkles size={14}/>
                          )}
                          Regenerate With Inputs
                        </button>
                      </div>
                    </section>
                  </div>
                ) : null}

                <details className="draft-review-details draft-authority-details" open>
                  <summary>Authority Checklist ({draft.authority_checklist?.length || 0})</summary>
                  <div className="draft-authority-list">
                    {(draft.authority_checklist || []).map((item: any, i: number) => {
                      const source = sourceForChecklist(item.authority);
                      return (
                        <div key={i}>
                          <strong>{item.authority}</strong>
                          <span>{String(item.status || "").replaceAll("_", " ")}</span>
                          <p>{item.note}</p>
                          {source?.url ? (
                            <a
                              className="draft-authority-source-link"
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Verify source
                              <ExternalLink size={12}/>
                            </a>
                          ) : null}
                          {source?.relevance ? (
                            <p className="draft-authority-relevance">
                              <b>Why it may apply:</b> {source.relevance}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </details>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

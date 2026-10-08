"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  FileDown,
  FilePenLine,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";
import styles from "./GovernmentResponseWorkstation.module.css";

type ResponseType =
  | "habeas_return"
  | "habeas_opposition"
  | "motion_to_dismiss"
  | "bond_opposition"
  | "other";

type RebuttalState = {
  run?: {
    id?: string;
    status?: string;
    started_at?: string;
    completed_at?: string | null;
    error_message?: string | null;
  } | null;
  output?: {
    title?: string;
    executive_summary?: string;
    readiness?: {
      status?: string;
      attorney_review_required?: boolean;
      blocking_items?: string[];
    };
    warnings?: string[];
    next_actions?: string[];
    open_questions?: string[];
    draft?: {
      document_type?: string;
      title?: string;
      markdown?: string;
      approval_status?: string;
      template_status?: string;
      placeholders?: string[];
      authority_checklist?: Array<{
        authority?: string;
        status?: string;
        note?: string;
      }>;
    } | null;
  } | null;
};

const RESPONSE_TYPES: Array<{
  value: ResponseType;
  label: string;
}> = [
  { value: "habeas_return", label: "Government Return / Response to Habeas" },
  { value: "habeas_opposition", label: "Opposition to Habeas / Petition" },
  { value: "motion_to_dismiss", label: "Government Motion to Dismiss" },
  { value: "bond_opposition", label: "Government Bond Opposition" },
  { value: "other", label: "Other Government Filing" },
];

function clean(value: unknown) {
  return String(value || "").trim();
}

export default function GovernmentResponseWorkstation({
  matter,
  onClose,
}: {
  matter: StoredCaseMatter | null;
  onClose: () => void;
}) {
  const mondayItemId = clean(matter?.mondayItemId || matter?.matterId);
  const storageKey = mondayItemId
    ? `cano_government_response_${mondayItemId}`
    : "";

  const [responseType, setResponseType] =
    useState<ResponseType>("habeas_return");
  const [governmentResponseText, setGovernmentResponseText] = useState("");
  const [attorneyInstructions, setAttorneyInstructions] = useState("");
  const [state, setState] = useState<RebuttalState>({});
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [error, setError] = useState("");

  const output = state.output || null;
  const draft = output?.draft || null;
  const status =
    clean(state.run?.status) ||
    (draft?.markdown ? "review_ready" : "ready");

  const detaineeName = useMemo(
    () =>
      clean(
        matter?.caseBrain?.people?.detainee?.name ||
          matter?.caseBrain?.people?.detainee?.full_name ||
          matter?.monday?.preview?.detaineeName ||
          matter?.monday?.preview?.name ||
          mondayItemId ||
          "No Active Matter"
      ),
    [matter, mondayItemId]
  );

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (
        RESPONSE_TYPES.some(
          (item) => item.value === parsed?.responseType
        )
      ) {
        setResponseType(parsed.responseType);
      }

      setGovernmentResponseText(
        clean(parsed?.governmentResponseText)
      );
      setAttorneyInstructions(
        clean(parsed?.attorneyInstructions)
      );
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        responseType,
        governmentResponseText,
        attorneyInstructions,
      })
    );
  }, [
    storageKey,
    responseType,
    governmentResponseText,
    attorneyInstructions,
  ]);

  async function loadState() {
    if (!mondayItemId) return;

    setLoading(true);

    try {
      const res = await fetch(
        `/api/agents/state?mondayItemId=${encodeURIComponent(
          mondayItemId
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to load Rhea."
        );
      }

      setState(data?.agents?.rebuttal || {});
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Rhea."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mondayItemId]);

  async function runRebuttal() {
    if (!matter || !mondayItemId || running) return;

    const pasted = clean(governmentResponseText);

    if (pasted.length < 100) {
      setError(
        "Paste the government's substantive filing before running Rhea."
      );
      return;
    }

    setRunning(true);
    setError("");

    try {
      const res = await fetch("/api/rebuttal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mondayItemId,
          agentId: "rebuttal",
          triggerType: state.run ? "refresh" : "manual",
          options: {
            responseType,
            governmentResponseText: pasted,
            attorneyInstructions: clean(attorneyInstructions),
            draftingMode: "government_response_reply",
            requestedOutput: "complete_reply_draft",
            attorneyWorkProduct: true,
            draftingRequirements: [
              "Analyze the government filing point by point before drafting.",
              "Treat government statements as assertions unless independently verified.",
              "Compare the filing against Case Brain and prior specialist work, including the original Scribe draft.",
              "Identify concessions, factual disputes, procedural defenses, cited authority, adverse points, and unanswered original arguments.",
              "Do not invent facts, holdings, citations, quotations, deadlines, docket events, or procedural history.",
              "Use verified authority research for independent legal propositions and preserve citator-review warnings.",
              "Draft a complete attorney-editable response/reply, not an outline.",
              "Use ATTORNEY INPUT NEEDED placeholders only for genuinely missing filing information.",
              "Nothing is filed automatically. The result remains pending attorney review.",
            ],
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to start Rhea."
        );
      }

      const startedAt = Date.now();

      while (Date.now() - startedAt < 180000) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 2500)
        );

        const stateRes = await fetch(
          `/api/agents/state?mondayItemId=${encodeURIComponent(
            mondayItemId
          )}`,
          { cache: "no-store" }
        );

        const stateData = await stateRes.json();

        if (!stateRes.ok || stateData?.ok === false) {
          continue;
        }

        const next = stateData?.agents?.rebuttal || {};
        setState(next);

        const nextStatus = clean(next?.run?.status);

        if (
          ["review_ready", "needs_review", "error"].includes(
            nextStatus
          )
        ) {
          if (nextStatus === "error") {
            setError(
              clean(next?.run?.error_message) ||
                "Rhea returned an error."
            );
          }
          return;
        }
      }

      await loadState();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to run Rhea."
      );
    } finally {
      setRunning(false);
    }
  }

  async function exportDraft(format: "docx" | "pdf") {
    if (!draft?.markdown || !mondayItemId || exporting) return;

    setExporting(format);
    setError("");

    try {
      const res = await fetch(
        `/api/rebuttal/export?mondayItemId=${encodeURIComponent(
          mondayItemId
        )}&format=${format}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        let message = "Unable to export the response draft.";

        try {
          const data = await res.json();
          message = data?.error || message;
        } catch {}

        throw new Error(message);
      }

      const blob = await res.blob();
      const disposition =
        res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        match?.[1] || `Cano-Government-Response.${format}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to export the response draft."
      );
    } finally {
      setExporting(null);
    }
  }

  function clearInput() {
    if (
      !window.confirm(
        "Clear the pasted government response and attorney instructions for this matter?"
      )
    ) {
      return;
    }

    setGovernmentResponseText("");
    setAttorneyInstructions("");

    if (storageKey) {
      window.localStorage.removeItem(storageKey);
    }
  }

  return (
    <div className={styles.backdrop}>
      <section className={styles.workstation}>
        <header className={styles.topbar}>
          <div className={styles.titleRow}>
            <button
              className={styles.backButton}
              onClick={onClose}
              aria-label="Close Rhea"
            >
              <ArrowLeft size={18} />
            </button>

            <div className={styles.agentIcon}>
              <FilePenLine size={24} />
            </div>

            <div>
              <div className={styles.kicker}>
                RHEA · GOVERNMENT RESPONSE & REBUTTAL
              </div>
              <h2>Government Response Workstation</h2>
              <p>
                Paste the government's filing, compare it against the
                active matter and prior legal work, then generate an
                attorney-review reply.
              </p>
            </div>
          </div>

          <div className={styles.status}>
            <span />
            {status.replaceAll("_", " ")}
          </div>
        </header>

        {!matter ? (
          <div className={styles.empty}>
            <AlertTriangle size={30} />
            <h3>No active Case Brain matter</h3>
            <p>
              Select or assign a matter before preparing a response.
            </p>
          </div>
        ) : (
          <div className={styles.shell}>
            <aside className={styles.inputColumn}>
              <section className={styles.matterCard}>
                <span>ACTIVE MATTER</span>
                <strong>{detaineeName}</strong>
                <p>
                  {matter.caseBrain?.summary?.brief ||
                    "Case Brain loaded."}
                </p>
              </section>

              <section className={styles.formCard}>
                <div className={styles.sectionHead}>
                  <div>
                    <span>GOVERNMENT FILING</span>
                    <h3>Paste the response</h3>
                  </div>

                  <button
                    type="button"
                    className={styles.clearButton}
                    onClick={clearInput}
                    disabled={
                      !governmentResponseText &&
                      !attorneyInstructions
                    }
                  >
                    <Trash2 size={13} />
                    Clear
                  </button>
                </div>

                <label className={styles.field}>
                  <span>Filing type</span>
                  <select
                    value={responseType}
                    onChange={(event) =>
                      setResponseType(
                        event.target.value as ResponseType
                      )
                    }
                  >
                    {RESPONSE_TYPES.map((item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Government response text</span>
                  <textarea
                    className={styles.responseTextarea}
                    value={governmentResponseText}
                    onChange={(event) =>
                      setGovernmentResponseText(
                        event.target.value
                      )
                    }
                    placeholder="Paste the United States' return, opposition, motion to dismiss, DHS position, or other government response here..."
                  />
                  <small>
                    {governmentResponseText.length.toLocaleString()}{" "}
                    characters
                  </small>
                </label>

                <label className={styles.field}>
                  <span>Attorney instructions (optional)</span>
                  <textarea
                    className={styles.instructionsTextarea}
                    value={attorneyInstructions}
                    onChange={(event) =>
                      setAttorneyInstructions(
                        event.target.value
                      )
                    }
                    placeholder="Example: Focus heavily on the government's jurisdiction argument and preserve the requested relief from our original petition."
                  />
                </label>

                <div className={styles.inputFooter}>
                  <div>
                    <ClipboardPaste size={14} />
                    <span>
                      Paste is saved locally to this active matter.
                    </span>
                  </div>

                  <button
                    className={styles.runButton}
                    disabled={
                      running ||
                      governmentResponseText.trim().length < 100
                    }
                    onClick={runRebuttal}
                  >
                    {running || status === "working" ? (
                      <>
                        <Loader2
                          size={15}
                          className={styles.spin}
                        />
                        Rhea Working...
                      </>
                    ) : draft?.markdown ? (
                      <>
                        <RefreshCw size={15} />
                        Regenerate Reply
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        Analyze & Draft Reply
                      </>
                    )}
                  </button>
                </div>
              </section>

              <section className={styles.guardrailCard}>
                <ShieldAlert size={16} />
                <div>
                  <strong>Attorney review required</strong>
                  <p>
                    Rhea does not file or send anything. Government
                    statements remain assertions unless independently
                    verified, and case authority remains subject to
                    citator review.
                  </p>
                </div>
              </section>
            </aside>

            <main className={styles.outputColumn}>
              <div className={styles.outputHead}>
                <div>
                  <span>ATTORNEY WORK PRODUCT</span>
                  <h3>
                    {draft?.title ||
                      output?.title ||
                      "Government Response Analysis"}
                  </h3>
                </div>

                <div className={styles.exportActions}>
                  <button
                    disabled={
                      !draft?.markdown || Boolean(exporting)
                    }
                    onClick={() => void exportDraft("docx")}
                  >
                    {exporting === "docx" ? (
                      <Loader2
                        className={styles.spin}
                        size={14}
                      />
                    ) : (
                      <FileDown size={14} />
                    )}
                    DOCX
                  </button>

                  <button
                    disabled={
                      !draft?.markdown || Boolean(exporting)
                    }
                    onClick={() => void exportDraft("pdf")}
                  >
                    {exporting === "pdf" ? (
                      <Loader2
                        className={styles.spin}
                        size={14}
                      />
                    ) : (
                      <FileDown size={14} />
                    )}
                    PDF
                  </button>
                </div>
              </div>

              {error ? (
                <div className={styles.errorBox}>
                  <AlertTriangle size={16} />
                  {error}
                </div>
              ) : null}

              {loading && !output ? (
                <div className={styles.emptyOutput}>
                  <Loader2
                    className={styles.spin}
                    size={25}
                  />
                  <h4>Loading Rhea</h4>
                </div>
              ) : draft?.markdown ? (
                <>
                  <section className={styles.summaryCard}>
                    <CheckCircle2 size={18} />
                    <div>
                      <span>RESPONSE STRATEGY</span>
                      <p>
                        {output?.executive_summary ||
                          "Reply draft prepared for attorney review."}
                      </p>
                    </div>
                  </section>

                  {output?.readiness?.blocking_items?.length ? (
                    <section className={styles.blockers}>
                      <span>BLOCKING / REVIEW ITEMS</span>
                      <ul>
                        {output.readiness.blocking_items.map(
                          (item, index) => (
                            <li key={`${item}-${index}`}>
                              {item}
                            </li>
                          )
                        )}
                      </ul>
                    </section>
                  ) : null}

                  <section className={styles.draftCard}>
                    <div className={styles.draftLabel}>
                      <Scale size={15} />
                      DRAFT REPLY / RESPONSE
                    </div>
                    <pre>{draft.markdown}</pre>
                  </section>

                  {draft.authority_checklist?.length ? (
                    <section className={styles.authorities}>
                      <span>AUTHORITY CHECKLIST</span>
                      {draft.authority_checklist.map(
                        (authority, index) => (
                          <div
                            key={`${authority.authority}-${index}`}
                          >
                            <strong>
                              {authority.authority}
                            </strong>
                            <em>
                              {clean(authority.status).replaceAll(
                                "_",
                                " "
                              )}
                            </em>
                            <p>{authority.note}</p>
                          </div>
                        )
                      )}
                    </section>
                  ) : null}
                </>
              ) : (
                <div className={styles.emptyOutput}>
                  <FilePenLine size={30} />
                  <h4>Paste the government response</h4>
                  <p>
                    Rhea will compare it to Case Brain, prior
                    specialist research, and the existing drafting
                    work before preparing an attorney-review reply.
                  </p>
                </div>
              )}
            </main>
          </div>
        )}
      </section>
    </div>
  );
}

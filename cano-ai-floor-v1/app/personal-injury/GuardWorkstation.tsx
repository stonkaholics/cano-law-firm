"use client";

import {
  CheckCircle2,
  Clock3,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./GuardWorkstation.module.css";

type GuardDraft = {
  id: string;
  referral_prospect_id?: string | null;
  subject?: string;
  message_summary?: string;
  status?: string;
  approved_by?: string;
  approved_at?: string | null;
  created_at?: string;
  metadata?: Record<string, any>;
  prospect?: {
    organization_name?: string;
    practice_area?: string;
    city?: string;
    state?: string;
  } | null;
};

type GuardReview = {
  id: string;
  review_type?: string;
  subject_type?: string;
  subject_id?: string;
  status?: string;
  notes?: string;
  reviewed_by?: string;
  reviewed_at?: string | null;
  metadata?: Record<string, any>;
};

type GuardState = {
  ok: boolean;
  drafts: GuardDraft[];
  reviews: GuardReview[];
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function fullBody(draft?: GuardDraft | null) {
  if (!draft) return "";
  return clean(
    draft.metadata?.body ||
    draft.message_summary ||
    ""
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function reviewForDraft(
  reviews: GuardReview[],
  draftId: string
) {
  return (
    reviews.find(
      (review) =>
        review.subject_id === draftId &&
        clean(review.metadata?.agent).toLowerCase() === "guard"
    ) || null
  );
}

export default function GuardWorkstationBridge() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GuardState>({
    ok: true,
    drafts: [],
    reviews: [],
  });
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadState = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/pi/guard/state?ts=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to load Guard review queue."
        );
      }

      const next: GuardState = {
        ok: true,
        drafts: Array.isArray(data.drafts)
          ? (data.drafts as GuardDraft[])
          : [],
        reviews: Array.isArray(data.reviews)
          ? (data.reviews as GuardReview[])
          : [],
      };

      setState(next);
      setError("");
      return next;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Guard review queue."
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const pollForReview = useCallback(
    (draftId: string, startedAt: string) => {
      stopPolling();
      let attempts = 0;
      const startMs = new Date(startedAt).getTime();

      const check = async () => {
        attempts += 1;
        const next = await loadState();
        if (!next) return;

        const review = next.reviews.find((item) => {
          if (item.subject_id !== draftId) return false;
          if (clean(item.metadata?.agent).toLowerCase() !== "guard") {
            return false;
          }

          const created =
            item.reviewed_at ||
            item.metadata?.generated_at ||
            "";

          if (!created || !Number.isFinite(startMs)) {
            return true;
          }

          const reviewMs = new Date(created).getTime();
          return !Number.isFinite(reviewMs) || reviewMs >= startMs - 5000;
        });

        if (review) {
          setRunningId(null);
          setSelectedId(draftId);
          setNotice(
            "Guard completed the AI review. Human approval is still required."
          );
          stopPolling();
          return;
        }

        if (attempts >= 30) {
          setRunningId(null);
          setError(
            "Guard accepted the review, but no review record appeared within about 90 seconds. Check the Guard branch in n8n."
          );
          stopPolling();
        }
      };

      void check();
      pollRef.current = window.setInterval(
        () => void check(),
        3000
      );
    },
    [loadState, stopPolling]
  );

  const runGuardReview = useCallback(
    async (draftId: string) => {
      if (runningId) return;

      setRunningId(draftId);
      setError("");
      setNotice("Guard is reviewing the outreach draft.");

      try {
        const response = await fetch(
          "/api/pi/guard/run",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              outreachEventId: draftId,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || data?.ok === false) {
          throw new Error(
            data?.error || "Unable to start Guard review."
          );
        }

        pollForReview(
          draftId,
          clean(data.startedAt) ||
            new Date().toISOString()
        );
      } catch (caught) {
        setRunningId(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to start Guard review."
        );
      }
    },
    [pollForReview, runningId]
  );

  const regenerateWithGuardEdits = useCallback(
    async (draftId: string) => {
      if (regeneratingId) return;

      setRegeneratingId(draftId);
      setError("");
      setNotice(
        "Sending Guard feedback back to Reach for a revised draft…"
      );

      try {
        const response = await fetch(
          "/api/pi/guard/regenerate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              outreachEventId: draftId,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || data?.ok === false) {
          throw new Error(
            data?.error ||
            "Unable to send Guard edits back to Reach."
          );
        }

        const startedAt =
          clean(data.startedAt) ||
          new Date().toISOString();

        let attempts = 0;

        stopPolling();

        const check = async () => {
          attempts += 1;

          const next = await loadState();

          if (!next) return;

          const revised =
            next.drafts.find(
              (draft) =>
                clean(
                  draft.metadata?.revision_of
                ) === draftId &&
                new Date(
                  draft.created_at || 0
                ).getTime() >=
                  new Date(startedAt).getTime() - 5000
            ) || null;

          if (revised) {
            setRegeneratingId(null);
            setSelectedId(revised.id);
            setNotice(
              "Reach created a revised draft using Guard's required edits. Run Guard Review again on the new version."
            );
            stopPolling();
            return;
          }

          if (attempts >= 30) {
            setRegeneratingId(null);
            setError(
              "Reach accepted the revision request, but the revised draft did not appear within about 90 seconds. Check the Reach branch in n8n."
            );
            stopPolling();
          }
        };

        void check();

        pollRef.current = window.setInterval(
          () => void check(),
          3000
        );
      } catch (caught) {
        setRegeneratingId(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to regenerate the Reach draft."
        );
      }
    },
    [
      loadState,
      regeneratingId,
      stopPolling,
    ]
  );

  const humanDecision = useCallback(
    async (
      draftId: string,
      decision: "approved" | "rejected"
    ) => {
      setError("");
      setNotice(
        decision === "approved"
          ? "Saving human approval…"
          : "Saving rejection…"
      );

      try {
        const response = await fetch(
          "/api/pi/guard/decision",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              outreachEventId: draftId,
              decision,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || data?.ok === false) {
          throw new Error(
            data?.error || "Unable to save Guard decision."
          );
        }

        await loadState();

        setNotice(
          decision === "approved"
            ? "Approved by human reviewer. Email sending remains disabled until the next PI-only send patch."
            : "Draft rejected. Reach can regenerate a replacement."
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to save Guard decision."
        );
      }
    },
    [loadState]
  );

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest("button");
      if (!button) return;

      const label = clean(button.textContent)
        .replace(/\s+/g, " ")
        .toLowerCase();

      const isGuardDesk =
        label.includes("guard") &&
        label.includes("compliance") &&
        !label.includes("review open items");

      if (!isGuardDesk) return;

      event.preventDefault();
      event.stopPropagation();

      setOpen(true);
      setNotice("");
      setError("");
      setSelectedId(null);
      void loadState();
    };

    document.addEventListener("click", handler, true);

    return () => {
      document.removeEventListener("click", handler, true);
      stopPolling();
    };
  }, [loadState, stopPolling]);

  const pending = useMemo(
    () =>
      state.drafts.filter(
        (draft) =>
          clean(draft.status).toLowerCase() === "draft"
      ),
    [state.drafts]
  );

  const approved = useMemo(
    () =>
      state.drafts.filter(
        (draft) =>
          clean(draft.status).toLowerCase() === "approved"
      ),
    [state.drafts]
  );

  const rejected = useMemo(
    () =>
      state.drafts.filter(
        (draft) =>
          clean(draft.status).toLowerCase() === "rejected"
      ),
    [state.drafts]
  );

  const selected =
    state.drafts.find(
      (draft) => draft.id === selectedId
    ) || pending[0] || approved[0] || rejected[0] || null;

  const selectedReview = selected
    ? reviewForDraft(state.reviews, selected.id)
    : null;

  if (!open) return null;

  const recommendation = clean(
    selectedReview?.metadata?.recommendation ||
    selectedReview?.status
  ).toLowerCase();

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          stopPolling();
          setOpen(false);
        }
      }}
    >
      <section className={styles.workstation}>
        <header className={styles.header}>
          <div className={styles.identity}>
            <div className={styles.iconBox}>
              <ShieldCheck size={25} />
            </div>

            <div>
              <div className={styles.statusLine}>
                <span />
                GUARD · COMPLIANCE + QA
              </div>
              <h2>Guard Workstation</h2>
              <p>
                Reviews Reach drafts for quality, source integrity, professional tone,
                unsupported claims, and outreach-risk flags. Guard recommends; a human
                reviewer makes the actual approval decision.
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.refreshButton}
              onClick={() => void loadState()}
              disabled={loading}
            >
              <RefreshCw
                size={14}
                className={loading ? styles.spin : ""}
              />
              Refresh
            </button>

            <button
              className={styles.closeButton}
              onClick={() => {
                stopPolling();
                setOpen(false);
              }}
              aria-label="Close Guard Workstation"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className={styles.missionGrid}>
          <div>
            <span>GUARD REVIEW</span>
            <div className={styles.chips}>
              <em>Professional referral outreach only</em>
              <em>Check unsupported claims</em>
              <em>Check recipient/source integrity</em>
              <em>Check tone + sender identity</em>
            </div>
          </div>

          <div>
            <span>CONTROL RULE</span>
            <div className={styles.chips}>
              <em>AI recommends</em>
              <em>Human approves or rejects</em>
              <em>No external send from Guard</em>
              <em>Approval is audit logged</em>
            </div>
          </div>
        </div>

        <div className={styles.stats}>
          <div>
            <span>PENDING DRAFTS</span>
            <strong>{pending.length}</strong>
          </div>
          <div>
            <span>AI REVIEWS</span>
            <strong>{state.reviews.length}</strong>
          </div>
          <div>
            <span>APPROVED</span>
            <strong>{approved.length}</strong>
          </div>
          <div>
            <span>REJECTED</span>
            <strong>{rejected.length}</strong>
          </div>
        </div>

        {notice ? (
          <div className={styles.notice}>
            <Sparkles size={14} />
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className={styles.error}>
            <XCircle size={14} />
            {error}
          </div>
        ) : null}

        <div className={styles.body}>
          <aside className={styles.queue}>
            <div className={styles.queueHead}>
              <div>
                <span>REACH → GUARD</span>
                <h3>Review Queue</h3>
              </div>
              <b>{pending.length}</b>
            </div>

            <div className={styles.queueList}>
              {state.drafts.length ? (
                state.drafts.map((draft) => {
                  const review = reviewForDraft(
                    state.reviews,
                    draft.id
                  );

                  return (
                    <button
                      key={draft.id}
                      className={`${styles.queueRow} ${
                        selected?.id === draft.id
                          ? styles.queueRowActive
                          : ""
                      }`}
                      onClick={() => setSelectedId(draft.id)}
                    >
                      <div className={styles.queueIcon}>
                        <Mail size={14} />
                      </div>

                      <div>
                        <strong>
                          {draft.prospect?.organization_name ||
                            draft.metadata?.organization_name ||
                            "Referral Prospect"}
                        </strong>
                        <span>
                          {draft.subject || "Untitled Reach draft"}
                        </span>
                        <small>
                          {formatDate(draft.created_at)}
                        </small>
                      </div>

                      <div className={styles.queueBadges}>
                        <em>{clean(draft.status) || "draft"}</em>
                        {review ? <em>reviewed</em> : null}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className={styles.empty}>
                  <ShieldCheck size={23} />
                  <h4>No Reach drafts yet</h4>
                  <p>
                    Reach drafts appear here automatically for Guard review.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <main className={styles.review}>
            {selected ? (
              <>
                <div className={styles.reviewHead}>
                  <div>
                    <span>OUTREACH REVIEW</span>
                    <h3>
                      {selected.prospect?.organization_name ||
                        selected.metadata?.organization_name ||
                        "Referral Outreach"}
                    </h3>
                    <p>
                      {selected.metadata?.recipient_name || "Recipient"}
                      {selected.metadata?.recipient_email
                        ? ` · ${selected.metadata.recipient_email}`
                        : ""}
                    </p>
                  </div>

                  <div className={styles.reviewHeadBadges}>
                    {selected.metadata?.revision_of ? (
                      <div className={styles.revisionPill}>
                        REVISED
                      </div>
                    ) : null}

                    <div className={styles.statusPill}>
                      {clean(selected.status) || "draft"}
                    </div>
                  </div>
                </div>

                <div className={styles.field}>
                  <label>SUBJECT</label>
                  <div>{selected.subject || "No subject"}</div>
                </div>

                <div className={styles.field}>
                  <label>EMAIL BODY</label>
                  <div className={styles.emailBody}>
                    {fullBody(selected) || "No full email body stored."}
                  </div>
                </div>

                <div className={styles.metaGrid}>
                  <div>
                    <span>LANE</span>
                    <strong>
                      {clean(selected.metadata?.referral_lane) || "general"}
                    </strong>
                  </div>
                  <div>
                    <span>REACH CONFIDENCE</span>
                    <strong>
                      {Number(selected.metadata?.confidence || 0)}%
                    </strong>
                  </div>
                  <div>
                    <span>CREATED</span>
                    <strong>{formatDate(selected.created_at)}</strong>
                  </div>
                </div>

                <section className={styles.guardPanel}>
                  <div className={styles.guardPanelHead}>
                    <div>
                      <span>AI GUARD REVIEW</span>
                      <h4>
                        {selectedReview
                          ? "Review Complete"
                          : "Not Reviewed Yet"}
                      </h4>
                    </div>

                    <div className={styles.guardActions}>
                      {selectedReview ? (
                        <button
                          className={styles.regenerateButton}
                          onClick={() =>
                            void regenerateWithGuardEdits(selected.id)
                          }
                          disabled={
                            Boolean(regeneratingId) ||
                            Boolean(runningId) ||
                            clean(selected.status).toLowerCase() !== "draft"
                          }
                        >
                          {regeneratingId === selected.id ? (
                            <RefreshCw
                              size={13}
                              className={styles.spin}
                            />
                          ) : (
                            <WandSparkles size={13} />
                          )}
                          {regeneratingId === selected.id
                            ? "Regenerating…"
                            : "Regenerate With Guard Edits"}
                        </button>
                      ) : null}

                      <button
                        onClick={() => void runGuardReview(selected.id)}
                        disabled={
                          Boolean(runningId) ||
                          Boolean(regeneratingId) ||
                          clean(selected.status).toLowerCase() !== "draft"
                        }
                      >
                        {runningId === selected.id ? (
                          <RefreshCw
                            size={13}
                            className={styles.spin}
                          />
                        ) : (
                          <ShieldCheck size={13} />
                        )}
                        {runningId === selected.id
                          ? "Guard Reviewing…"
                          : selectedReview
                          ? "Run Again"
                          : "Run Guard Review"}
                      </button>
                    </div>
                  </div>

                  {selectedReview ? (
                    <>
                      <div
                        className={`${styles.recommendation} ${
                          recommendation === "approve" ||
                          recommendation === "approved"
                            ? styles.recommendApprove
                            : recommendation === "block" ||
                              recommendation === "reject" ||
                              recommendation === "rejected"
                            ? styles.recommendBlock
                            : styles.recommendReview
                        }`}
                      >
                        <ShieldCheck size={15} />
                        <div>
                          <span>GUARD RECOMMENDATION</span>
                          <strong>
                            {clean(
                              selectedReview.metadata?.recommendation
                            ) ||
                              clean(selectedReview.status) ||
                              "needs review"}
                          </strong>
                        </div>
                      </div>

                      <div className={styles.reviewSummary}>
                        {selectedReview.notes ||
                          clean(selectedReview.metadata?.summary) ||
                          "Guard did not return review notes."}
                      </div>

                      <div className={styles.flags}>
                        {(Array.isArray(selectedReview.metadata?.flags)
                          ? selectedReview.metadata?.flags
                          : []
                        ).map((flag: any, index: number) => (
                          <div key={`${String(flag)}-${index}`}>
                            <span>{index + 1}</span>
                            <p>{String(flag)}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className={styles.guardEmpty}>
                      Guard has not analyzed this draft yet. Run the review before
                      making the human approval decision.
                    </div>
                  )}
                </section>

                <div className={styles.humanDecision}>
                  <div>
                    <span>HUMAN DECISION</span>
                    <p>
                      Guard's output is advisory. A person must explicitly approve
                      or reject the outreach before it can ever be sent.
                    </p>
                  </div>

                  <div className={styles.decisionButtons}>
                    <button
                      className={styles.rejectButton}
                      onClick={() =>
                        void humanDecision(selected.id, "rejected")
                      }
                      disabled={
                        clean(selected.status).toLowerCase() !== "draft"
                      }
                    >
                      <XCircle size={14} />
                      Reject
                    </button>

                    <button
                      className={styles.approveButton}
                      onClick={() =>
                        void humanDecision(selected.id, "approved")
                      }
                      disabled={
                        !selectedReview ||
                        clean(selected.status).toLowerCase() !== "draft"
                      }
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </button>
                  </div>
                </div>

                <div className={styles.sendLocked}>
                  <Clock3 size={14} />
                  Guard can now send required edits back to Reach for a revised draft. Approval is still stored separately, and email sending remains disabled until the next PI-only send patch.
                </div>
              </>
            ) : (
              <div className={styles.emptyLarge}>
                <ShieldCheck size={28} />
                <h3>Select a Reach draft</h3>
                <p>
                  Guard reviews approved professional referral outreach before a
                  human decides whether it may proceed.
                </p>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

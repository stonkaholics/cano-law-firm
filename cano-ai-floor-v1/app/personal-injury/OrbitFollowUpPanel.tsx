"use client";

import {
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  MessageSquareReply,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TimerReset,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./OrbitFollowUpPanel.module.css";

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

function formatDate(
  value: string
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/New_York",
      month:
        "short",
      day:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    }
  ).format(
    date
  );
}

type ReplyRow = {
  id: string;
  referral_prospect_id?: string | null;
  organization_name: string;
  contact_name: string;
  contact_email: string;
  subject: string;
  body: string;
  received_at: string;
  intent: string;
  priority: string;
  needs_response: boolean;
  recommended_action: string;
  response_draft_status: string;
  status: string;
};

type FollowUpRow = {
  prospect_id: string;
  organization_name: string;
  recipient_email: string;
  subject: string;
  sent_at: string;
  days_waiting: number;
  follow_up_due: boolean;
  outreach_event_id: string;
};

type Dashboard = {
  ok: boolean;
  counts: {
    replies: number;
    needs_response: number;
    follow_up_due: number;
    waiting: number;
  };
  integrations: {
    titan_inbox: {
      configured: boolean;
      user: string;
      host: string;
    };
  };
  replies: ReplyRow[];
  follow_ups: FollowUpRow[];
  error?: string;
};

type CadenceSequence = {
  prospect_id: string;
  organization_name: string;
  recipient_email: string;
  current_contact_name: string;
  next_contact_name: string;
  next_contact_email: string;
  latest_sent_at: string;
  days_waiting: number;
  next_due_at: string;
  followups_sent: number;
  next_followup_number: number;
  max_followups: number;
  interval_days: number;
  pending_draft_id?: string | null;
  exhausted: boolean;
  should_prepare: boolean;
  should_close: boolean;
  status: string;
};

type CadenceDashboard = {
  config: {
    intervalDays: number;
    maxFollowUps: number;
  };
  counts: {
    active: number;
    due: number;
    drafts_ready: number;
    close_loop_due: number;
  };
  sequences: CadenceSequence[];
};

export default function OrbitFollowUpPanel() {
  const [
    data,
    setData,
  ] =
    useState<Dashboard | null>(
      null
    );

  const [
    cadence,
    setCadence,
  ] =
    useState<CadenceDashboard | null>(
      null
    );

  const [
    selectedReplyId,
    setSelectedReplyId,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState("");

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const load =
    useCallback(
      async (
        preserveNotice =
          false
      ) => {
        if (!preserveNotice) {
          setNotice("");
        }

        const [
          replyResponse,
          cadenceResponse,
        ] =
          await Promise.all([
            fetch(
              `/api/pi/orbit/replies?t=${Date.now()}`,
              {
                cache:
                  "no-store",
              }
            ),

            fetch(
              `/api/pi/orbit/cadence?t=${Date.now()}`,
              {
                cache:
                  "no-store",
              }
            ),
          ]);

        const [
          replyJson,
          cadenceJson,
        ] =
          await Promise.all([
            replyResponse.json(),
            cadenceResponse.json(),
          ]);

        if (
          !replyResponse.ok ||
          replyJson?.ok ===
            false
        ) {
          throw new Error(
            replyJson?.error ||
            "Unable to load Orbit follow-up queue."
          );
        }

        if (
          !cadenceResponse.ok ||
          cadenceJson?.ok ===
            false
        ) {
          throw new Error(
            cadenceJson?.error ||
            "Unable to load Orbit cadence."
          );
        }

        setData(
          replyJson
        );

        setCadence(
          cadenceJson
        );

        if (
          !selectedReplyId &&
          replyJson
            ?.replies?.[0]
        ) {
          setSelectedReplyId(
            replyJson
              .replies[0]
              .id
          );
        }
      },
      [
        selectedReplyId,
      ]
    );

  const syncInbox =
    useCallback(
      async (
        quiet =
          false
      ) => {
        if (busy) {
          return;
        }

        setBusy(
          "sync"
        );

        if (!quiet) {
          setNotice(
            "Orbit is checking Titan Mail for replies…"
          );
        }

        try {
          const response =
            await fetch(
              "/api/pi/orbit/inbox/sync",
              {
                method:
                  "POST",
                cache:
                  "no-store",
              }
            );

          const result =
            await response.json();

          if (
            !response.ok ||
            result?.ok ===
              false
          ) {
            throw new Error(
              result?.error ||
              "Titan inbox sync failed."
            );
          }

          await load(
            true
          );

          setNotice(
            result
              ?.matched_replies
              ? `Orbit found ${result.matched_replies} new referral repl${
                  result.matched_replies ===
                  1
                    ? "y"
                    : "ies"
                } and matched them back to Reach.`
              : "Titan inbox checked. No new matched referral replies."
          );
        } catch (
          error
        ) {
          setNotice(
            error instanceof
            Error
              ? error.message
              : "Titan inbox sync failed."
          );
        } finally {
          setBusy("");
        }
      },
      [
        busy,
        load,
      ]
    );

  const runCadence =
    useCallback(
      async () => {
        if (busy) {
          return;
        }

        setBusy(
          "cadence"
        );

        setNotice(
          "Orbit is checking every active outreach sequence and preparing anything due…"
        );

        try {
          const response =
            await fetch(
              "/api/pi/orbit/cadence/run",
              {
                method:
                  "POST",
                cache:
                  "no-store",
              }
            );

          const result =
            await response.json();

          if (
            !response.ok ||
            result?.ok ===
              false
          ) {
            throw new Error(
              result?.error ||
              "Orbit cadence run failed."
            );
          }

          await load(
            true
          );

          setNotice(
            `Cadence checked ${result.checked || 0} active sequences. ${
              result.prepared || 0
            } follow-up draft request(s) prepared and ${
              result.closed || 0
            } completed sequence(s) closed/rotated.`
          );
        } catch (
          error
        ) {
          setNotice(
            error instanceof
            Error
              ? error.message
              : "Orbit cadence run failed."
          );
        } finally {
          setBusy("");
        }
      },
      [
        busy,
        load,
      ]
    );

  useEffect(() => {
    void load()
      .then(
        () =>
          syncInbox(
            true
          )
      )
      .catch(
        (error) =>
          setNotice(
            error instanceof
            Error
              ? error.message
              : "Unable to load Orbit follow-up queue."
          )
      );

    const handler =
      () => {
        void Promise.all([
          syncInbox(),
          runCadence(),
        ]);
      };

    window.addEventListener(
      "cano-orbit-run",
      handler
    );

    return () =>
      window.removeEventListener(
        "cano-orbit-run",
        handler
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected =
    useMemo(
      () =>
        data
          ?.replies
          ?.find(
            (row) =>
              row.id ===
              selectedReplyId
          ) ||
        data
          ?.replies?.[0] ||
        null,
      [
        data,
        selectedReplyId,
      ]
    );

  async function replyAction(
    action:
      | "mark_resolved"
      | "reopen"
      | "draft_reply"
  ) {
    if (!selected) {
      return;
    }

    setBusy(
      action
    );
    setNotice("");

    try {
      const response =
        await fetch(
          "/api/pi/orbit/replies",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,
                reply_id:
                  selected.id,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        result?.ok ===
          false
      ) {
        throw new Error(
          result?.error ||
          "Orbit action failed."
        );
      }

      setNotice(
        action ===
          "draft_reply"
          ? "Orbit sent this reply to n8n for drafting. The result returns to Reach as a Guard + human-review draft."
          : action ===
            "mark_resolved"
          ? "Reply marked resolved."
          : "Reply reopened."
      );

      if (
        action !==
        "draft_reply"
      ) {
        await load(
          true
        );
      }
    } catch (
      error
    ) {
      setNotice(
        error instanceof
        Error
          ? error.message
          : "Orbit action failed."
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section
      className={
        styles.wrap
      }
    >
      <div
        className={
          styles.heading
        }
      >
        <div>
          <span>
            ORBIT · FOLLOW-UP AUTOMATION
          </span>
          <h4>
            Referral Relationship Tracker
          </h4>
          <p>
            Titan replies, no-response cadence, three-touch follow-up sequencing, contact rotation, and meeting suppression in one place.
          </p>
        </div>

        <div
          className={
            styles.topActions
          }
        >
          <button
            type="button"
            onClick={() =>
              void syncInbox()
            }
            disabled={
              Boolean(
                busy
              )
            }
          >
            <RefreshCw
              size={13}
              className={
                busy ===
                  "sync"
                  ? styles.spin
                  : ""
              }
            />
            Sync Titan Inbox
          </button>

          <button
            type="button"
            onClick={() =>
              void runCadence()
            }
            disabled={
              Boolean(
                busy
              )
            }
          >
            <TimerReset
              size={13}
              className={
                busy ===
                  "cadence"
                  ? styles.spin
                  : ""
              }
            />
            Run Follow-Up Engine
          </button>
        </div>
      </div>

      <div
        className={
          styles.cadenceBanner
        }
      >
        <div>
          <span>
            ACTIVE CADENCE
          </span>
          <strong>
            Every{" "}
            {cadence
              ?.config
              ?.intervalDays ||
              3}{" "}
            days
          </strong>
        </div>

        <div>
          <span>
            MAX FOLLOW-UPS
          </span>
          <strong>
            {cadence
              ?.config
              ?.maxFollowUps ||
              3}
          </strong>
        </div>

        <div>
          <span>
            RULE
          </span>
          <strong>
            No reply + no meeting
          </strong>
        </div>

        <div>
          <span>
            AFTER FINAL TOUCH
          </span>
          <strong>
            Rotate contact
          </strong>
        </div>
      </div>

      <div
        className={
          styles.stats
        }
      >
        <div>
          <Inbox
            size={14}
          />
          <span>
            REPLIES
          </span>
          <strong>
            {data
              ?.counts
              ?.replies ||
              0}
          </strong>
        </div>

        <div>
          <MessageSquareReply
            size={14}
          />
          <span>
            NEED RESPONSE
          </span>
          <strong>
            {data
              ?.counts
              ?.needs_response ||
              0}
          </strong>
        </div>

        <div>
          <Clock3
            size={14}
          />
          <span>
            CADENCE DUE
          </span>
          <strong>
            {cadence
              ?.counts
              ?.due ||
              0}
          </strong>
        </div>

        <div>
          <Mail
            size={14}
          />
          <span>
            DRAFTS READY
          </span>
          <strong>
            {cadence
              ?.counts
              ?.drafts_ready ||
              0}
          </strong>
        </div>
      </div>

      {notice ? (
        <div
          className={
            styles.notice
          }
        >
          {notice}
        </div>
      ) : null}

      <div
        className={
          styles.cadenceSection
        }
      >
        <div
          className={
            styles.sectionHeader
          }
        >
          <div>
            <span>
              AUTOMATIC OUTREACH CADENCE
            </span>
            <h5>
              Three-Touch Follow-Up Queue
            </h5>
          </div>

          <small>
            Orbit prepares drafts only. Guard + human approval still control every send.
          </small>
        </div>

        {!cadence
          ?.sequences
          ?.length ? (
          <div
            className={
              styles.empty
            }
          >
            No active no-response sequences yet.
          </div>
        ) : (
          <div
            className={
              styles.sequenceGrid
            }
          >
            {cadence.sequences
              .slice(
                0,
                18
              )
              .map(
                (row) => (
                  <div
                    key={
                      row.prospect_id
                    }
                    className={`${styles.sequenceCard} ${
                      row.should_close
                        ? styles.closeDue
                        : row.should_prepare
                        ? styles.sequenceDue
                        : ""
                    }`}
                  >
                    <div
                      className={
                        styles.sequenceTop
                      }
                    >
                      <div>
                        <strong>
                          {row.organization_name ||
                            row.recipient_email}
                        </strong>

                        <span>
                          {row.current_contact_name
                            ? `${row.current_contact_name} · `
                            : ""}
                          {row.recipient_email}
                        </span>
                      </div>

                      <em>
                        {row.status
                          .replace(
                            /_/g,
                            " "
                          )}
                      </em>
                    </div>

                    <div
                      className={
                        styles.sequenceMeter
                      }
                    >
                      {Array.from({
                        length:
                          row.max_followups,
                      }).map(
                        (
                          _,
                          index
                        ) => (
                          <span
                            key={
                              `${row.prospect_id}-${index}`
                            }
                            className={
                              index <
                              row.followups_sent
                                ? styles.touchDone
                                : index ===
                                    row.followups_sent &&
                                  row.pending_draft_id
                                ? styles.touchDraft
                                : ""
                            }
                          >
                            {index +
                              1}
                          </span>
                        )
                      )}
                    </div>

                    <div
                      className={
                        styles.sequenceMeta
                      }
                    >
                      <span>
                        {row.followups_sent}/
                        {row.max_followups} sent
                      </span>

                      <span>
                        {row.pending_draft_id
                          ? "Draft waiting for review"
                          : row.exhausted
                          ? `Final wait: ${row.days_waiting}d`
                          : `Next: follow-up ${row.next_followup_number}`}
                      </span>

                      <span>
                        {row.should_close
                          ? "Close loop now"
                          : row.should_prepare
                          ? "Due now"
                          : `Due ${formatDate(
                              row.next_due_at
                            )}`}
                      </span>
                    </div>

                    {row.should_close ? (
                      <div
                        className={
                          styles.rotationNote
                        }
                      >
                        <RotateCcw
                          size={12}
                        />
                        {row.next_contact_email
                          ? `Next contact: ${
                              row.next_contact_name
                                ? `${row.next_contact_name} · `
                                : ""
                            }${row.next_contact_email}`
                          : "No second contact is available. Orbit will close the firm sequence."}
                      </div>
                    ) : null}
                  </div>
                )
              )}
          </div>
        )}
      </div>

      <div
        className={
          styles.grid
        }
      >
        <div
          className={
            styles.queue
          }
        >
          <div
            className={
              styles.queueTitle
            }
          >
            INBOUND REPLIES
          </div>

          {!data
            ?.replies
            ?.length ? (
            <div
              className={
                styles.empty
              }
            >
              No matched replies yet.
            </div>
          ) : (
            data.replies.map(
              (row) => (
                <button
                  key={
                    row.id
                  }
                  type="button"
                  className={`${styles.replyRow} ${
                    selected
                      ?.id ===
                    row.id
                      ? styles.active
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedReplyId(
                      row.id
                    )
                  }
                >
                  <div>
                    <strong>
                      {row.organization_name ||
                        row.contact_name ||
                        row.contact_email ||
                        "Referral reply"}
                    </strong>

                    <span
                      className={
                        row.priority ===
                          "high"
                          ? styles.high
                          : ""
                      }
                    >
                      {row.intent
                        .replace(
                          /_/g,
                          " "
                        )}
                    </span>
                  </div>

                  <small>
                    {row.contact_email}
                  </small>

                  <p>
                    {row.subject}
                  </p>

                  <em>
                    {formatDate(
                      row.received_at
                    )}
                  </em>
                </button>
              )
            )
          )}
        </div>

        <div
          className={
            styles.detail
          }
        >
          {!selected ? (
            <div
              className={
                styles.emptyDetail
              }
            >
              Select a reply to review it.
            </div>
          ) : (
            <>
              <div
                className={
                  styles.replyHero
                }
              >
                <div>
                  <span>
                    {selected.intent
                      .replace(
                        /_/g,
                        " "
                      )}
                  </span>

                  <h5>
                    {selected.organization_name ||
                      selected.contact_name ||
                      selected.contact_email}
                  </h5>

                  <p>
                    {selected.contact_name
                      ? `${selected.contact_name} · `
                      : ""}
                    {selected.contact_email}
                  </p>
                </div>

                <div
                  className={
                    styles.actions
                  }
                >
                  {selected.needs_response &&
                  selected.status !==
                    "resolved" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void replyAction(
                          "draft_reply"
                        )
                      }
                      disabled={
                        Boolean(
                          busy
                        )
                      }
                    >
                      <Sparkles
                        size={13}
                      />
                      Draft Reply
                    </button>
                  ) : null}

                  {selected.status ===
                    "resolved" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void replyAction(
                          "reopen"
                        )
                      }
                      disabled={
                        Boolean(
                          busy
                        )
                      }
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void replyAction(
                          "mark_resolved"
                        )
                      }
                      disabled={
                        Boolean(
                          busy
                        )
                      }
                    >
                      <CheckCircle2
                        size={13}
                      />
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              <div
                className={
                  styles.recommendation
                }
              >
                <span>
                  ORBIT NEXT ACTION
                </span>
                <p>
                  {selected.recommended_action ||
                    "Review and respond appropriately."}
                </p>
              </div>

              <div
                className={
                  styles.messageBody
                }
              >
                <span>
                  {selected.subject}
                </span>
                <pre>
                  {selected.body}
                </pre>
              </div>

              <div
                className={
                  styles.draftStatus
                }
              >
                Reply draft:{" "}
                <strong>
                  {selected.response_draft_status
                    .replace(
                      /_/g,
                      " "
                    )}
                </strong>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

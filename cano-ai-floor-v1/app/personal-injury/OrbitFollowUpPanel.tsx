"use client";

import {
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  MessageSquareReply,
  RefreshCw,
  Sparkles,
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

export default function OrbitFollowUpPanel() {
  const [
    data,
    setData,
  ] =
    useState<Dashboard | null>(
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

        const response =
          await fetch(
            `/api/pi/orbit/replies?t=${Date.now()}`,
            {
              cache:
                "no-store",
            }
          );

        const next =
          await response.json();

        if (
          !response.ok ||
          next?.ok ===
            false
        ) {
          throw new Error(
            next?.error ||
            "Unable to load Orbit follow-up queue."
          );
        }

        setData(
          next
        );

        if (
          !selectedReplyId &&
          next
            ?.replies?.[0]
        ) {
          setSelectedReplyId(
            next
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
                } and matched ${
                  result.matched_replies
                } to Reach outreach.`
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
        void syncInbox();
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
          ? "Orbit sent this reply to the n8n Orbit branch for drafting. The result will return to Reach as a Guard + human-review draft."
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
            ORBIT · EMAIL FOLLOW-UP
          </span>
          <h4>
            Referral Reply Tracker
          </h4>
          <p>
            Titan Mail replies are threaded back to the original Reach outreach, prioritized, and queued for human-reviewed follow-up.
          </p>
        </div>

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
            FOLLOW-UP DUE
          </span>
          <strong>
            {data
              ?.counts
              ?.follow_up_due ||
              0}
          </strong>
        </div>

        <div>
          <Mail
            size={14}
          />
          <span>
            TITAN INBOX
          </span>
          <strong>
            {data
              ?.integrations
              ?.titan_inbox
              ?.configured
              ? "Connected"
              : "Setup"}
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

      <div
        className={
          styles.followups
        }
      >
        <div
          className={
            styles.queueTitle
          }
        >
          NO-REPLY FOLLOW-UP QUEUE
        </div>

        {!data
          ?.follow_ups
          ?.length ? (
          <div
            className={
              styles.empty
            }
          >
            No outstanding sent outreach.
          </div>
        ) : (
          <div
            className={
              styles.followupGrid
            }
          >
            {data.follow_ups
              .slice(
                0,
                12
              )
              .map(
                (row) => (
                  <div
                    key={
                      row
                        .outreach_event_id
                    }
                    className={
                      row
                        .follow_up_due
                        ? styles.dueCard
                        : styles.waitCard
                    }
                  >
                    <strong>
                      {row.organization_name ||
                        row.recipient_email}
                    </strong>

                    <span>
                      {row.recipient_email}
                    </span>

                    <small>
                      Sent{" "}
                      {formatDate(
                        row.sent_at
                      )}
                      {" · "}
                      {row.days_waiting} day
                      {row.days_waiting ===
                      1
                        ? ""
                        : "s"}{" "}
                      waiting
                    </small>

                    <em>
                      {row.follow_up_due
                        ? "FOLLOW-UP DUE"
                        : "WAITING"}
                    </em>
                  </div>
                )
              )}
          </div>
        )}
      </div>
    </section>
  );
}

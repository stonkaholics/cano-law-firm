"use client";

import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  Phone,
  RefreshCw,
  Unlink2,
  ClipboardList,
  Sparkles,
  UserRound,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./ReferralMeetingWorkstation.module.css";

type Meeting = {
  id: string;
  referral_prospect_id?: string | null;
  invitee_name: string;
  invitee_email: string;
  invitee_phone: string;
  organization_name: string;
  website: string;
  practice_areas: string[];
  start_at: string;
  end_at: string;
  timezone: string;
  status: string;
  calendar_status: string;
  conflict_detected: boolean;
  conflict_events: Array<{
    summary?: string;
    start?: string;
    end?: string;
  }>;
  alternative_slots: Array<{
    start: string;
    end: string;
    scheduling_url?: string;
    source?: string;
  }>;
  conflict_email_subject: string;
  conflict_email_body: string;
  conflict_outreach_event_id?: string | null;
  brief: Record<string, any>;
  source_payload?: Record<string, any>;
};

type OutreachCandidate = {
  id: string;
  referral_prospect_id?: string | null;
  organization_name: string;
  recipient_name: string;
  recipient_email: string;
  subject: string;
  status: string;
  sent_at: string;
  message_summary: string;
};

type Payload = {
  ok: boolean;
  meetings: Meeting[];
  counts: {
    total: number;
    conflicts: number;
    booked: number;
  };
  integrations: {
    calendly: boolean;
    titan: boolean;
    meeting_brief_ai: boolean;
  };
  outreach_candidates: OutreachCandidate[];
  error?: string;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function asArray(value: unknown) {
  return Array.isArray(value)
    ? value
    : [];
}

function formatTime(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/New_York",
      weekday:
        "short",
      month:
        "short",
      day:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
      timeZoneName:
        "short",
    }
  ).format(
    new Date(value)
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: unknown;
}) {
  const rows =
    asArray(items)
      .map(clean)
      .filter(Boolean);

  if (!rows.length) {
    return null;
  }

  return (
    <section
      className={
        styles.briefSection
      }
    >
      <h4>{title}</h4>
      <ul>
        {rows.map(
          (
            row,
            index
          ) => (
            <li
              key={`${title}-${index}`}
            >
              {row}
            </li>
          )
        )}
      </ul>
    </section>
  );
}

export default function ReferralMeetingWorkstation() {
  const [
    data,
    setData,
  ] =
    useState<Payload | null>(
      null
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    action,
    setAction,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    outreachSelection,
    setOutreachSelection,
  ] =
    useState("");

  async function load(
    preserveMessage = false
  ) {
    setLoading(true);

    if (!preserveMessage) {
      setMessage("");
    }

    try {
      const response =
        await fetch(
          "/api/pi/referral-meetings",
          {
            cache:
              "no-store",
          }
        );

      const next =
        await response.json();

      if (
        !response.ok ||
        next?.ok === false
      ) {
        throw new Error(
          next?.error ||
          "Unable to load referral meetings."
        );
      }

      setData(next);

      if (
        !selectedId &&
        next?.meetings?.[0]
      ) {
        setSelectedId(
          next
            .meetings[0]
            .id
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load referral meetings."
      );
    } finally {
      setLoading(false);
    }
  }

  async function syncCalendly(
    source = "manual"
  ) {
    if (action) {
      return;
    }

    setAction(
      "sync_calendly"
    );

    setMessage(
      source === "open"
        ? "Checking Calendly and Titan…"
        : "Orbit is checking Calendly, Titan Calendar, and the meeting queue…"
    );

    try {
      /*
      |--------------------------------------------------------------------------
      | SELF-HEALING WEBHOOK SETUP
      |--------------------------------------------------------------------------
      |
      | Opening/running Orbit makes sure the Calendly webhook exists. This means
      | the user does not need to manually POST the bootstrap endpoint.
      |--------------------------------------------------------------------------
      */

      const bootstrap =
        await fetch(
          "/api/pi/referral-meetings/calendly/bootstrap",
          {
            method:
              "POST",
            cache:
              "no-store",
          }
        );

      const bootstrapData =
        await bootstrap.json();

      if (
        !bootstrap.ok ||
        bootstrapData
          ?.ok === false
      ) {
        throw new Error(
          bootstrapData
            ?.error ||
          "Calendly webhook setup failed."
        );
      }

      /*
      |--------------------------------------------------------------------------
      | RECOVERY / POLL SYNC
      |--------------------------------------------------------------------------
      |
      | This immediately imports meetings that were already booked before the
      | webhook existed, then the webhook handles future bookings in real time.
      |--------------------------------------------------------------------------
      */

      const sync =
        await fetch(
          "/api/pi/referral-meetings/calendly/sync",
          {
            method:
              "POST",
            cache:
              "no-store",
          }
        );

      const syncData =
        await sync.json();

      if (
        !sync.ok ||
        syncData?.ok ===
          false
      ) {
        throw new Error(
          syncData?.error ||
          "Calendly meeting sync failed."
        );
      }

      await load(
        true
      );

      const recovered =
        Number(
          syncData
            ?.recovered ||
          0
        );

      const failed =
        Number(
          syncData
            ?.failed ||
          0
        );

      setMessage(
        recovered > 0
          ? `Orbit synced ${recovered} referral meeting${
              recovered === 1
                ? ""
                : "s"
            }. Calendly webhook is active and Titan sync was processed.${
              failed
                ? ` ${failed} item(s) need review.`
                : ""
            }`
          : "Orbit is synced. Calendly webhook is active and there are no new referral meetings to import."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Orbit sync failed."
      );
    } finally {
      setAction("");
    }
  }

  useEffect(() => {
    void syncCalendly(
      "open"
    );

    const handler =
      () => {
        void syncCalendly(
          "run_button"
        );
      };

    window.addEventListener(
      "cano-orbit-run",
      handler
    );

    return () => {
      window.removeEventListener(
        "cano-orbit-run",
        handler
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected =
    useMemo(
      () =>
        data?.meetings?.find(
          (row) =>
            row.id ===
            selectedId
        ) ||
        data?.meetings?.[0] ||
        null,
      [
        data,
        selectedId,
      ]
    );

  const calendlyIntake =
    useMemo(
      () => {
        const source =
          selected
            ?.source_payload &&
          typeof selected
            .source_payload ===
            "object"
            ? selected
                .source_payload
            : {};

        const intake =
          source
            ?.calendly_intake &&
          typeof source
            .calendly_intake ===
            "object"
            ? source
                .calendly_intake
            : {};

        const invitee =
          source
            ?.calendly_invitee &&
          typeof source
            .calendly_invitee ===
            "object"
            ? source
                .calendly_invitee
            : {};

        const questions =
          Array.isArray(
            intake
              ?.questions_and_answers
          )
            ? intake
                .questions_and_answers
            : Array.isArray(
                invitee
                  ?.questions_and_answers
              )
            ? invitee
                .questions_and_answers
            : [];

        return {
          phone:
            clean(
              selected
                ?.invitee_phone
            ) ||
            clean(
              intake?.phone
            ) ||
            clean(
              invitee
                ?.text_reminder_number
            ) ||
            clean(
              invitee
                ?.phone_number
            ) ||
            clean(
              invitee?.phone
            ),

          questions:
            questions
              .map(
                (row: any) => ({
                  question:
                    clean(
                      row?.question
                    ),
                  answer:
                    clean(
                      row?.answer
                    ),
                })
              )
              .filter(
                (row: any) =>
                  row.question &&
                  row.answer
              ),
        };
      },
      [
        selected,
      ]
    );

  const outreachLink =
    useMemo(
      () => {
        const source =
          selected
            ?.source_payload &&
          typeof selected
            .source_payload ===
            "object"
            ? selected
                .source_payload
            : {};

        return source
          ?.outreach_link &&
          typeof source
            .outreach_link ===
            "object"
            ? source
                .outreach_link
            : {};
      },
      [
        selected,
      ]
    );

  const outreachCandidates =
    Array.isArray(
      data
        ?.outreach_candidates
    )
      ? data!
          .outreach_candidates
      : [];

  const linkedOutreach =
    outreachCandidates.find(
      (row) =>
        row.id ===
        clean(
          outreachLink
            ?.outreach_event_id
        )
    ) ||
    null;

  const exactEmailCandidate =
    outreachCandidates.find(
      (row) =>
        clean(
          row.recipient_email
        )
          .toLowerCase() ===
        clean(
          selected
            ?.invitee_email
        )
          .toLowerCase()
    ) ||
    null;

  useEffect(() => {
    if (!selected) {
      setOutreachSelection("");
      return;
    }

    setOutreachSelection(
      clean(
        outreachLink
          ?.outreach_event_id
      ) ||
      exactEmailCandidate
        ?.id ||
      ""
    );
  }, [
    selected?.id,
    outreachLink
      ?.outreach_event_id,
    exactEmailCandidate
      ?.id,
  ]);

  async function runAction(
    name:
      | "regenerate_brief"
      | "recheck_calendar"
      | "create_conflict_reach_draft"
      | "unlink_outreach"
  ) {
    if (!selected) {
      return;
    }

    setAction(name);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/pi/referral-meetings",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  name,
                meeting_id:
                  selected.id,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        result?.ok === false
      ) {
        throw new Error(
          result?.error ||
          "Meeting action failed."
        );
      }

      setMessage(
        name ===
          "regenerate_brief"
          ? "Meeting intelligence refreshed."
          : name ===
            "recheck_calendar"
          ? "Titan calendar rechecked."
          : name ===
            "unlink_outreach"
          ? "Reach email connection removed."
          : "Conflict email draft is now in Reach for Guard + human review."
      );

      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Meeting action failed."
      );
    } finally {
      setAction("");
    }
  }


  async function connectOutreach() {
    if (
      !selected ||
      !outreachSelection
    ) {
      setMessage(
        "Choose a sent Reach email to connect first."
      );
      return;
    }

    setAction(
      "link_outreach"
    );
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/pi/referral-meetings",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "link_outreach",

                meeting_id:
                  selected.id,

                outreach_event_id:
                  outreachSelection,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        result?.ok === false
      ) {
        throw new Error(
          result?.error ||
          "Unable to connect the Reach email."
        );
      }

      setMessage(
        "Reach email connected. Orbit refreshed the meeting with the Scout company record and outreach history."
      );

      await load(
        true
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect the Reach email."
      );
    } finally {
      setAction("");
    }
  }

  const brief =
    selected?.brief &&
    typeof selected.brief ===
      "object"
      ? selected.brief
      : {};

  const snapshot =
    brief?.firm_snapshot &&
    typeof brief
      .firm_snapshot ===
      "object"
      ? brief
          .firm_snapshot
      : {};

  return (
    <div
      className={
        styles.wrap
      }
    >
      <header
        className={
          styles.header
        }
      >
        <div>
          <span>
            ORBIT · REFERRAL MEETING INTELLIGENCE
          </span>
          <h3>
            Referral Meetings
          </h3>
          <p>
            Calendly bookings, Titan
            calendar conflict control,
            relationship context, and
            pre-call intelligence in one
            place.
          </p>
        </div>

        <button
          type="button"
          className={
            styles.refreshButton
          }
          onClick={() =>
            void syncCalendly(
              "refresh"
            )
          }
          disabled={
            loading
          }
        >
          <RefreshCw
            size={14}
            className={
              loading
                ? styles.spin
                : ""
            }
          />
          Sync Calendly
        </button>
      </header>

      <div
        className={
          styles.statusGrid
        }
      >
        <div>
          <span>
            UPCOMING
          </span>
          <strong>
            {data?.counts?.total ||
              0}
          </strong>
        </div>

        <div>
          <span>
            CALENDAR CONFLICTS
          </span>
          <strong
            className={
              data?.counts
                ?.conflicts
                ? styles.warningText
                : ""
            }
          >
            {data?.counts
              ?.conflicts ||
              0}
          </strong>
        </div>

        <div>
          <span>
            CALENDLY
          </span>
          <strong>
            {data
              ?.integrations
              ?.calendly
              ? "Connected"
              : "Setup"}
          </strong>
        </div>

        <div>
          <span>
            TITAN CALENDAR
          </span>
          <strong>
            {data
              ?.integrations
              ?.titan
              ? "Connected"
              : "Setup"}
          </strong>
        </div>
      </div>

      <div
        className={
          styles.syncNote
        }
      >
        Orbit does not need the general PI n8n router to capture meetings. Opening or running Orbit now verifies the Calendly webhook, recovers any missed bookings, checks Titan Calendar, and builds the meeting record automatically.
      </div>

      {message ? (
        <div
          className={
            styles.message
          }
        >
          {message}
        </div>
      ) : null}

      <div
        className={
          styles.columns
        }
      >
        <aside
          className={
            styles.meetingList
          }
        >
          <div
            className={
              styles.listHeading
            }
          >
            <CalendarClock
              size={15}
            />
            Upcoming referral calls
          </div>

          {!data?.meetings
            ?.length ? (
            <div
              className={
                styles.empty
              }
            >
              <CalendarCheck2
                size={24}
              />
              <strong>
                No referral meetings yet
              </strong>
              <p>
                When someone books the
                Cano referral Calendly
                event, Orbit will create
                the meeting record here.
              </p>
            </div>
          ) : (
            data.meetings.map(
              (meeting) => (
                <button
                  type="button"
                  key={
                    meeting.id
                  }
                  className={`${styles.meetingRow} ${
                    selected?.id ===
                    meeting.id
                      ? styles.meetingRowActive
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedId(
                      meeting.id
                    )
                  }
                >
                  <div
                    className={
                      styles.meetingRowTop
                    }
                  >
                    <strong>
                      {meeting.organization_name ||
                        meeting.invitee_name ||
                        "Referral meeting"}
                    </strong>

                    <span
                      className={
                        meeting
                          .conflict_detected
                          ? styles.conflictBadge
                          : styles.bookedBadge
                      }
                    >
                      {meeting
                        .conflict_detected
                        ? "CONFLICT"
                        : meeting.status.toUpperCase()}
                    </span>
                  </div>

                  <span>
                    {meeting.invitee_name}
                  </span>

                  <small>
                    {formatTime(
                      meeting.start_at
                    )}
                  </small>
                </button>
              )
            )
          )}
        </aside>

        <main
          className={
            styles.detail
          }
        >
          {!selected ? (
            <div
              className={
                styles.empty
              }
            >
              <FileText
                size={26}
              />
              <strong>
                Select a referral meeting
              </strong>
            </div>
          ) : (
            <>
              <section
                className={
                  styles.meetingHero
                }
              >
                <div>
                  <span>
                    MEETING BRIEF
                  </span>

                  <h3>
                    {selected.organization_name ||
                      snapshot.organization ||
                      selected.invitee_name}
                  </h3>

                  <p>
                    {formatTime(
                      selected.start_at
                    )}
                  </p>
                </div>

                <div
                  className={
                    styles.heroActions
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        "recheck_calendar"
                      )
                    }
                    disabled={
                      Boolean(
                        action
                      )
                    }
                  >
                    <CalendarCheck2
                      size={14}
                    />
                    Recheck Titan
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        "regenerate_brief"
                      )
                    }
                    disabled={
                      Boolean(
                        action
                      )
                    }
                  >
                    <Sparkles
                      size={14}
                    />
                    Refresh Brief
                  </button>
                </div>
              </section>

              {selected.conflict_detected ? (
                <section
                  className={
                    styles.conflictPanel
                  }
                >
                  <div
                    className={
                      styles.conflictTitle
                    }
                  >
                    <AlertTriangle
                      size={17}
                    />
                    <div>
                      <strong>
                        Titan calendar conflict detected
                      </strong>
                      <span>
                        Orbit did not add a duplicate meeting to Mariela&apos;s Titan Calendar.
                      </span>
                    </div>
                  </div>

                  {selected
                    .conflict_events
                    ?.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          className={
                            styles.conflictEvent
                          }
                          key={
                            index
                          }
                        >
                          <strong>
                            {item.summary ||
                              "Existing Titan event"}
                          </strong>
                          <span>
                            {item.start
                              ? formatTime(
                                  item.start
                                )
                              : ""}
                          </span>
                        </div>
                      )
                    )}

                  {selected
                    .alternative_slots
                    ?.length ? (
                    <div
                      className={
                        styles.alternativeWrap
                      }
                    >
                      <span>
                        NEAREST OPEN OPTIONS
                      </span>

                      <div
                        className={
                          styles.slotGrid
                        }
                      >
                        {selected.alternative_slots
                          .slice(
                            0,
                            3
                          )
                          .map(
                            (
                              slot,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                              >
                                {formatTime(
                                  slot.start
                                )}
                              </div>
                            )
                          )}
                      </div>
                    </div>
                  ) : null}

                  <div
                    className={
                      styles.emailDraft
                    }
                  >
                    <span>
                      CONFLICT EMAIL DRAFT
                    </span>

                    <strong>
                      {selected.conflict_email_subject}
                    </strong>

                    <pre>
                      {selected.conflict_email_body}
                    </pre>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.reachButton
                    }
                    disabled={
                      Boolean(
                        action
                      ) ||
                      Boolean(
                        selected.conflict_outreach_event_id
                      ) ||
                      !selected.referral_prospect_id
                    }
                    onClick={() =>
                      void runAction(
                        "create_conflict_reach_draft"
                      )
                    }
                  >
                    <Mail
                      size={14}
                    />
                    {selected.conflict_outreach_event_id
                      ? "Draft Already in Reach"
                      : selected.referral_prospect_id
                      ? "Send Draft to Reach Review"
                      : "Match Prospect Before Reach"}
                  </button>
                </section>
              ) : (
                <section
                  className={
                    styles.calendarOk
                  }
                >
                  <CheckCircle2
                    size={16}
                  />
                  <div>
                    <strong>
                      Titan calendar clear
                    </strong>
                    <span>
                      Calendar status:{" "}
                      {
                        selected.calendar_status
                      }
                    </span>
                  </div>
                </section>
              )}

              <section
                className={
                  styles.snapshot
                }
              >
                <div
                  className={
                    styles.sectionTitle
                  }
                >
                  <Building2
                    size={15}
                  />
                  Firm snapshot
                </div>

                <div
                  className={
                    styles.snapshotGrid
                  }
                >
                  <div>
                    <span>
                      CONTACT
                    </span>
                    <strong>
                      {snapshot.contact ||
                        selected.invitee_name}
                    </strong>
                    <small>
                      {snapshot.contact_title ||
                        selected.invitee_email}
                    </small>
                  </div>

                  <div>
                    <span>
                      PHONE
                    </span>
                    <strong>
                      {calendlyIntake.phone ||
                        "Not provided"}
                    </strong>

                    {calendlyIntake.phone ? (
                      <a
                        className={
                          styles.inlineContactLink
                        }
                        href={`tel:${calendlyIntake.phone}`}
                      >
                        <Phone
                          size={12}
                        />
                        Call
                      </a>
                    ) : null}
                  </div>

                  <div>
                    <span>
                      PRACTICE
                    </span>
                    <strong>
                      {snapshot.practice_area ||
                        selected.practice_areas?.join(
                          ", "
                        ) ||
                        "Review"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      REFERRAL FIT
                    </span>
                    <strong>
                      {snapshot.fit_score
                        ? `${snapshot.fit_score}/100`
                        : "New"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      LOCATION
                    </span>
                    <strong>
                      {snapshot.location ||
                        "Not confirmed"}
                    </strong>
                  </div>
                </div>

                {selected.website ? (
                  <a
                    href={
                      /^https?:\/\//i.test(
                        selected.website
                      )
                        ? selected.website
                        : `https://${selected.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit firm website
                    <ExternalLink
                      size={12}
                    />
                  </a>
                ) : null}
              </section>

              <section
                className={
                  styles.outreachConnection
                }
              >
                <div
                  className={
                    styles.connectionHeader
                  }
                >
                  <div
                    className={
                      styles.sectionTitle
                    }
                  >
                    <Link2
                      size={15}
                    />
                    Reach Outreach Connection
                  </div>

                  {linkedOutreach ? (
                    <span
                      className={
                        styles.connectedBadge
                      }
                    >
                      CONNECTED
                    </span>
                  ) : exactEmailCandidate ? (
                    <span
                      className={
                        styles.autoMatchBadge
                      }
                    >
                      EMAIL MATCH FOUND
                    </span>
                  ) : null}
                </div>

                {linkedOutreach ? (
                  <div
                    className={
                      styles.linkedEmailCard
                    }
                  >
                    <strong>
                      {linkedOutreach.organization_name ||
                        selected.organization_name ||
                        "Reach outreach"}
                    </strong>

                    <span>
                      To:{" "}
                      {linkedOutreach.recipient_name
                        ? `${linkedOutreach.recipient_name} · `
                        : ""}
                      {linkedOutreach.recipient_email ||
                        "recipient unavailable"}
                    </span>

                    <span>
                      {linkedOutreach.subject ||
                        "No subject"}
                    </span>

                    <small>
                      Sent{" "}
                      {linkedOutreach.sent_at
                        ? formatTime(
                            linkedOutreach.sent_at
                          )
                        : "date unavailable"}
                      {" · "}
                      {clean(
                        outreachLink
                          ?.match_method
                      ) ===
                        "manual"
                        ? "manually connected"
                        : "matched automatically"}
                    </small>
                  </div>
                ) : (
                  <p
                    className={
                      styles.connectionHint
                    }
                  >
                    Orbit first tries to match the Calendly invitee to the exact email address Reach contacted. If that does not resolve the firm, choose the original sent email manually below.
                  </p>
                )}

                <div
                  className={
                    styles.connectionControls
                  }
                >
                  <select
                    value={
                      outreachSelection
                    }
                    onChange={(
                      event
                    ) =>
                      setOutreachSelection(
                        event
                          .target
                          .value
                      )
                    }
                  >
                    <option
                      value=""
                    >
                      Select a sent Reach email…
                    </option>

                    {outreachCandidates.map(
                      (
                        candidate
                      ) => (
                        <option
                          key={
                            candidate.id
                          }
                          value={
                            candidate.id
                          }
                        >
                          {[
                            candidate.organization_name ||
                              "Unknown firm",
                            candidate.recipient_email ||
                              candidate.recipient_name ||
                              "Unknown recipient",
                            candidate.subject ||
                              "No subject",
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              " — "
                            )}
                        </option>
                      )
                    )}
                  </select>

                  <button
                    type="button"
                    disabled={
                      Boolean(
                        action
                      ) ||
                      !outreachSelection
                    }
                    onClick={() =>
                      void connectOutreach()
                    }
                  >
                    <Link2
                      size={13}
                    />
                    Connect & Refresh Brief
                  </button>

                  {linkedOutreach ? (
                    <button
                      type="button"
                      className={
                        styles.unlinkButton
                      }
                      disabled={
                        Boolean(
                          action
                        )
                      }
                      onClick={() =>
                        void runAction(
                          "unlink_outreach"
                        )
                      }
                    >
                      <Unlink2
                        size={13}
                      />
                      Unlink
                    </button>
                  ) : null}
                </div>
              </section>

              <section
                className={
                  styles.calendlyIntake
                }
              >
                <div
                  className={
                    styles.sectionTitle
                  }
                >
                  <ClipboardList
                    size={15}
                  />
                  Calendly Intake
                </div>

                {calendlyIntake.questions.length ? (
                  <div
                    className={
                      styles.intakeGrid
                    }
                  >
                    {calendlyIntake.questions.map(
                      (
                        row: any,
                        index: number
                      ) => (
                        <div
                          key={`calendly-intake-${index}`}
                          className={
                            styles.intakeCard
                          }
                        >
                          <span>
                            {row.question}
                          </span>
                          <strong>
                            {row.answer}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p
                    className={
                      styles.intakeEmpty
                    }
                  >
                    No custom Calendly answers are stored on this meeting yet. Click Sync Calendly once after this deploy to pull the complete invitee record.
                  </p>
                )}
              </section>

              {brief?.why_this_meeting ? (
                <section
                  className={
                    styles.why
                  }
                >
                  <div
                    className={
                      styles.sectionTitle
                    }
                  >
                    <UserRound
                      size={15}
                    />
                    Why this meeting matters
                  </div>

                  <p>
                    {clean(
                      brief
                        .why_this_meeting
                    )}
                  </p>
                </section>
              ) : null}

              <div
                className={
                  styles.briefGrid
                }
              >
                <Section
                  title="Where Cano Can Help Them"
                  items={
                    brief
                      ?.cano_can_help_them_with
                  }
                />

                <Section
                  title="Where They May Help Cano"
                  items={
                    brief
                      ?.they_may_help_cano_with
                  }
                />

                <Section
                  title="Conversation Opportunities"
                  items={
                    brief
                      ?.conversation_opportunities
                  }
                />

                <Section
                  title="Questions Worth Asking"
                  items={
                    brief
                      ?.suggested_questions
                  }
                />

                <Section
                  title="Watchouts"
                  items={
                    brief
                      ?.watchouts
                  }
                />
              </div>

              {asArray(
                brief?.source_urls
              ).length ? (
                <section
                  className={
                    styles.sources
                  }
                >
                  <span>
                    SOURCE LINKS
                  </span>

                  {asArray(
                    brief
                      ?.source_urls
                  )
                    .map(clean)
                    .filter(Boolean)
                    .map(
                      (
                        url,
                        index
                      ) => (
                        <a
                          key={
                            index
                          }
                          href={
                            url
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source{" "}
                          {index +
                            1}
                          <ExternalLink
                            size={11}
                          />
                        </a>
                      )
                    )}
                </section>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

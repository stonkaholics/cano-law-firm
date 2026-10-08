"use client";

import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  RefreshCw,
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

  async function load() {
    setLoading(true);
    setMessage("");

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

  useEffect(() => {
    void load();
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

  async function runAction(
    name:
      | "regenerate_brief"
      | "recheck_calendar"
      | "create_conflict_reach_draft"
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
            void load()
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
          Refresh
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

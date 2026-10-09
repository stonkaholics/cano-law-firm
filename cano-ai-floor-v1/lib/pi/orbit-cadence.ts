import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "../supabase/rest";

function clean(value: unknown) {
  return String(value || "").trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function eq(value: string) {
  return `eq.${value}`;
}

function asObject(value: unknown): Record<string, any> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value as Record<string, any>
      : {};
}

function numericEnv(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(process.env[name] || fallback);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.min(maximum, Math.round(parsed))
  );
}

export function getOrbitCadenceConfig() {
  const intervalBusinessDays =
    numericEnv(
      "ORBIT_FOLLOWUP_BUSINESS_DAYS",
      Number(process.env.ORBIT_FOLLOWUP_DAYS || 3),
      1,
      30
    );

  const maxFollowUps =
    numericEnv(
      "ORBIT_MAX_FOLLOWUPS",
      3,
      1,
      6
    );

  return {
    intervalDays: intervalBusinessDays,
    intervalBusinessDays,
    maxFollowUps,
    timeZone: "America/New_York",
    cadenceType: "business_days",
  };
}

type OutreachEvent = {
  id: string;
  referral_prospect_id?: string | null;
  channel?: string;
  direction?: string;
  status?: string;
  subject?: string;
  message_summary?: string;
  occurred_at?: string | null;
  next_follow_up_at?: string | null;
  created_at?: string;
  metadata?: Record<string, any>;
};

type Prospect = {
  id: string;
  organization_name?: string;
  website?: string;
  practice_area?: string;
  city?: string;
  state?: string;
  why_fit?: string;
  relationship_status?: string;
  score?: number;
  metadata?: Record<string, any>;
};

type Contact = {
  id: string;
  prospect_id?: string | null;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  priority?: number;
  selected_for_outreach?: boolean;
  metadata?: Record<string, any>;
};

type ReferralMeeting = {
  id: string;
  referral_prospect_id?: string | null;
  invitee_email?: string;
  start_at?: string;
  end_at?: string;
  status?: string;
  organization_name?: string;
};

function eventTime(row: OutreachEvent) {
  return new Date(
    row.occurred_at ||
    row.created_at ||
    0
  ).getTime();
}

function isSentOutbound(row: OutreachEvent) {
  return (
    lower(row.channel) === "email" &&
    lower(row.direction) !== "inbound" &&
    lower(row.status) === "sent"
  );
}

function isInbound(row: OutreachEvent) {
  return (
    lower(row.channel) === "email" &&
    lower(row.direction) === "inbound"
  );
}

function isDraftOutbound(row: OutreachEvent) {
  return (
    lower(row.channel) === "email" &&
    lower(row.direction) !== "inbound" &&
    [
      "draft",
      "approved",
      "pending",
      "queued",
    ].includes(lower(row.status))
  );
}

function eventRecipient(row: OutreachEvent) {
  const metadata = asObject(row.metadata);
  const delivery = asObject(metadata.delivery);

  return lower(
    metadata.recipient_email ||
    delivery.recipient
  );
}

function eventMessageId(row: OutreachEvent) {
  const metadata = asObject(row.metadata);
  const delivery = asObject(metadata.delivery);

  return clean(
    delivery.message_id ||
    metadata.message_id
  );
}

function followUpNumber(row: OutreachEvent) {
  const metadata = asObject(row.metadata);
  const orbit = asObject(metadata.orbit_followup);

  const direct = Number(
    orbit.number ||
    metadata.followup_number ||
    0
  );

  return Number.isFinite(direct)
    ? direct
    : 0;
}

function isOrbitFollowUp(row: OutreachEvent) {
  const metadata = asObject(row.metadata);

  return (
    lower(metadata.mode) ===
      "referral_no_response_followup" ||
    followUpNumber(row) > 0
  );
}

function isRotationDraft(row: OutreachEvent) {
  const metadata = asObject(row.metadata);

  return (
    lower(metadata.mode) ===
      "referral_contact_rotation" ||
    asObject(metadata.orbit_followup)
      .contact_rotation === true
  );
}

/*
|--------------------------------------------------------------------------
| BUSINESS-DAY CADENCE
|--------------------------------------------------------------------------
| Friday + 1 business day = Monday
| Friday + 3 business days = Wednesday
|--------------------------------------------------------------------------
*/

function weekdayInEastern(date: Date) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "America/New_York",
      weekday: "short",
    }
  ).format(date);
}

function isBusinessDay(date: Date) {
  const weekday = weekdayInEastern(date);

  return (
    weekday !== "Sat" &&
    weekday !== "Sun"
  );
}

export function isEasternBusinessDayNow(
  date = new Date()
) {
  return isBusinessDay(date);
}

export function addBusinessDays(
  value: string,
  businessDays: number
) {
  const source = new Date(value);

  if (Number.isNaN(source.getTime())) {
    return "";
  }

  const count = Math.max(
    0,
    Math.round(businessDays)
  );

  const cursor = new Date(source.getTime());
  let added = 0;

  while (added < count) {
    cursor.setUTCDate(
      cursor.getUTCDate() + 1
    );

    if (isBusinessDay(cursor)) {
      added += 1;
    }
  }

  while (!isBusinessDay(cursor)) {
    cursor.setUTCDate(
      cursor.getUTCDate() + 1
    );
  }

  return cursor.toISOString();
}

function businessDaysElapsed(
  value: string,
  end = new Date()
) {
  const start = new Date(value);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return 0;
  }

  const cursor = new Date(start.getTime());
  let count = 0;

  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(
      cursor.getUTCDate() + 1
    );

    if (
      cursor.getTime() <= end.getTime() &&
      isBusinessDay(cursor)
    ) {
      count += 1;
    }
  }

  return count;
}

function dueNow(value: string) {
  const time = new Date(value).getTime();

  return (
    Number.isFinite(time) &&
    time <= Date.now()
  );
}

function activeMeetingProspects(
  meetings: ReferralMeeting[]
) {
  return new Set(
    meetings
      .filter(
        (row) =>
          lower(row.status) !== "canceled"
      )
      .map(
        (row) =>
          clean(row.referral_prospect_id)
      )
      .filter(Boolean)
  );
}

function hasInboundAfter(
  rows: OutreachEvent[],
  prospectId: string,
  after: number
) {
  return rows.some(
    (row) =>
      isInbound(row) &&
      clean(row.referral_prospect_id) === prospectId &&
      eventTime(row) > after
  );
}

function candidateContacts(
  contacts: Contact[],
  prospectId: string
) {
  return contacts
    .filter(
      (row) =>
        clean(row.prospect_id) === prospectId &&
        Boolean(clean(row.email))
    )
    .sort(
      (a, b) =>
        Number(b.selected_for_outreach) -
          Number(a.selected_for_outreach) ||
        Number(a.priority ?? 999) -
          Number(b.priority ?? 999)
    );
}

export async function getOrbitCadenceDashboard() {
  const config = getOrbitCadenceConfig();

  const [
    outreach,
    prospects,
    contacts,
    meetings,
  ] = await Promise.all([
    supabaseSelect<OutreachEvent>(
      "pi_outreach_events",
      {
        select: "*",
        order: "created_at.desc",
        limit: 1500,
      }
    ),

    supabaseSelect<Prospect>(
      "pi_referral_prospects",
      {
        select: "*",
        order: "updated_at.desc",
        limit: 600,
      }
    ),

    supabaseSelect<Contact>(
      "pi_referral_contacts",
      {
        select: "*",
        order: "priority.asc,created_at.asc",
        limit: 1200,
      }
    ),

    supabaseSelect<ReferralMeeting>(
      "pi_referral_meetings",
      {
        select: "*",
        order: "start_at.desc",
        limit: 600,
      }
    ),
  ]);

  const prospectMap = new Map(
    prospects.map(
      (row) => [
        clean(row.id),
        row,
      ]
    )
  );

  const meetingProspects =
    activeMeetingProspects(meetings);

  const sentByProspect =
    new Map<string, OutreachEvent[]>();

  for (const row of outreach) {
    if (!isSentOutbound(row)) {
      continue;
    }

    const prospectId =
      clean(row.referral_prospect_id);

    if (!prospectId) {
      continue;
    }

    const list =
      sentByProspect.get(prospectId) || [];

    list.push(row);
    sentByProspect.set(prospectId, list);
  }

  const businessDayNow =
    isEasternBusinessDayNow();

  const sequences =
    Array.from(sentByProspect.entries())
      .map(([prospectId, sentRows]) => {
        const sorted =
          sentRows
            .slice()
            .sort(
              (a, b) =>
                eventTime(a) -
                eventTime(b)
            );

        const latest =
          sorted[sorted.length - 1];

        const initial =
          sorted.find(
            (row) =>
              !isOrbitFollowUp(row)
          ) ||
          sorted[0];

        const followUpsSent =
          sorted.filter(
            (row) =>
              isOrbitFollowUp(row)
          ).length;

        const nextNumber =
          followUpsSent + 1;

        const prospect =
          prospectMap.get(prospectId);

        const recipient =
          eventRecipient(latest) ||
          eventRecipient(initial);

        const meetingBooked =
          meetingProspects.has(prospectId);

        const replied =
          hasInboundAfter(
            outreach,
            prospectId,
            eventTime(initial)
          );

        const latestSentAt =
          clean(
            latest.occurred_at ||
            latest.created_at
          );

        const nextDueAt =
          addBusinessDays(
            latestSentAt,
            config.intervalBusinessDays
          );

        const pendingDraft =
          outreach.find(
            (row) => {
              if (
                !isDraftOutbound(row) ||
                clean(row.referral_prospect_id) !==
                  prospectId
              ) {
                return false;
              }

              const number =
                followUpNumber(row);

              return (
                number === nextNumber ||
                (
                  nextNumber >
                    config.maxFollowUps &&
                  isRotationDraft(row)
                )
              );
            }
          );

        const contactsForProspect =
          candidateContacts(
            contacts,
            prospectId
          );

        const currentContact =
          contactsForProspect.find(
            (row) =>
              lower(row.email) ===
                recipient
          ) ||
          contactsForProspect.find(
            (row) =>
              row.selected_for_outreach
          ) ||
          null;

        const nextContact =
          contactsForProspect.find(
            (row) =>
              row.id !==
                currentContact?.id &&
              lower(row.email) !== recipient
          ) ||
          null;

        const exhausted =
          followUpsSent >=
          config.maxFollowUps;

        const shouldClose =
          businessDayNow &&
          !meetingBooked &&
          !replied &&
          exhausted &&
          dueNow(nextDueAt);

        const shouldPrepare =
          businessDayNow &&
          !meetingBooked &&
          !replied &&
          !exhausted &&
          dueNow(nextDueAt);

        const businessWaiting =
          businessDaysElapsed(
            latestSentAt
          );

        return {
          prospect_id: prospectId,
          organization_name:
            clean(prospect?.organization_name),
          recipient_email: recipient,
          current_contact_id:
            currentContact?.id || null,
          current_contact_name:
            clean(currentContact?.name),
          next_contact_id:
            nextContact?.id || null,
          next_contact_name:
            clean(nextContact?.name),
          next_contact_email:
            lower(nextContact?.email),
          original_outreach_event_id:
            initial.id,
          latest_outreach_event_id:
            latest.id,
          original_subject:
            clean(initial.subject),
          latest_subject:
            clean(latest.subject),
          latest_sent_at:
            latestSentAt,
          days_waiting:
            businessWaiting,
          business_days_waiting:
            businessWaiting,
          next_due_at:
            nextDueAt,
          followups_sent:
            followUpsSent,
          next_followup_number:
            nextNumber,
          max_followups:
            config.maxFollowUps,
          interval_days:
            config.intervalBusinessDays,
          interval_business_days:
            config.intervalBusinessDays,
          cadence_type:
            "business_days",
          replied,
          meeting_booked:
            meetingBooked,
          pending_draft_id:
            pendingDraft?.id || null,
          exhausted,
          should_prepare:
            shouldPrepare &&
            !pendingDraft,
          should_close:
            shouldClose &&
            !pendingDraft,
          status:
            meetingBooked
              ? "meeting_booked"
              : replied
              ? "replied"
              : pendingDraft
              ? "draft_prepared"
              : !businessDayNow &&
                dueNow(nextDueAt)
              ? "weekend_hold"
              : shouldClose
              ? "close_loop_due"
              : exhausted
              ? "final_wait"
              : shouldPrepare
              ? "followup_due"
              : "waiting",
        };
      })
      .filter(
        (row) =>
          !row.replied &&
          !row.meeting_booked
      )
      .sort(
        (a, b) =>
          Number(b.should_close) -
            Number(a.should_close) ||
          Number(b.should_prepare) -
            Number(a.should_prepare) ||
          b.days_waiting -
            a.days_waiting
      );

  return {
    ok: true,
    config,
    business_day_now:
      businessDayNow,
    sequences,
    counts: {
      active: sequences.length,
      due:
        sequences.filter(
          (row) =>
            row.should_prepare
        ).length,
      drafts_ready:
        sequences.filter(
          (row) =>
            Boolean(row.pending_draft_id)
        ).length,
      close_loop_due:
        sequences.filter(
          (row) =>
            row.should_close
        ).length,
      weekend_hold:
        sequences.filter(
          (row) =>
            row.status === "weekend_hold"
        ).length,
    },
  };
}

export async function buildNoResponseFollowUpContext(input: {
  prospectId: string;
  followUpNumber: number;
}) {
  const [
    outreach,
    prospectRows,
    contactRows,
  ] = await Promise.all([
    supabaseSelect<OutreachEvent>(
      "pi_outreach_events",
      {
        select: "*",
        referral_prospect_id:
          eq(input.prospectId),
        order: "created_at.asc",
        limit: 100,
      }
    ),

    supabaseSelect<Prospect>(
      "pi_referral_prospects",
      {
        select: "*",
        id: eq(input.prospectId),
        limit: 1,
      }
    ),

    supabaseSelect<Contact>(
      "pi_referral_contacts",
      {
        select: "*",
        prospect_id:
          eq(input.prospectId),
        order: "priority.asc,created_at.asc",
        limit: 50,
      }
    ),
  ]);

  const sent =
    outreach
      .filter(isSentOutbound)
      .sort(
        (a, b) =>
          eventTime(a) -
          eventTime(b)
      );

  if (!sent.length) {
    throw new Error(
      "No sent Reach outreach exists for this prospect."
    );
  }

  const latest =
    sent[sent.length - 1];

  const initial =
    sent.find(
      (row) =>
        !isOrbitFollowUp(row)
    ) ||
    sent[0];

  const recipient =
    eventRecipient(latest) ||
    eventRecipient(initial);

  const contact =
    contactRows.find(
      (row) =>
        lower(row.email) === recipient
    ) ||
    contactRows.find(
      (row) =>
        row.selected_for_outreach
    ) ||
    null;

  return {
    prospect:
      prospectRows[0] || null,
    contact,
    initialOutreach: initial,
    latestOutreach: latest,
    outreachHistory: outreach,
    followUpNumber:
      input.followUpNumber,
    recipientEmail: recipient,
    recipientName:
      clean(
        asObject(latest.metadata)
          .recipient_name
      ) ||
      clean(contact?.name),
    inReplyTo:
      eventMessageId(latest),
  };
}

export async function closeLoopAndRotateContact(
  prospectId: string
) {
  const [
    contacts,
    outreach,
  ] = await Promise.all([
    supabaseSelect<Contact>(
      "pi_referral_contacts",
      {
        select: "*",
        prospect_id:
          eq(prospectId),
        order:
          "priority.asc,created_at.asc",
        limit: 50,
      }
    ),

    supabaseSelect<OutreachEvent>(
      "pi_outreach_events",
      {
        select: "*",
        referral_prospect_id:
          eq(prospectId),
        order: "created_at.desc",
        limit: 100,
      }
    ),
  ]);

  const latestSent =
    outreach.find(isSentOutbound) ||
    null;

  const currentEmail =
    latestSent
      ? eventRecipient(latestSent)
      : "";

  const current =
    contacts.find(
      (row) =>
        lower(row.email) ===
          currentEmail
    ) ||
    contacts.find(
      (row) =>
        row.selected_for_outreach
    ) ||
    null;

  const next =
    contacts.find(
      (row) =>
        row.id !== current?.id &&
        Boolean(clean(row.email)) &&
        lower(row.email) !==
          currentEmail
    ) ||
    null;

  if (current?.id) {
    await supabaseUpdate(
      "pi_referral_contacts",
      {
        id: eq(current.id),
      },
      {
        selected_for_outreach:
          false,
      }
    );
  }

  if (next?.id) {
    await supabaseUpdate(
      "pi_referral_contacts",
      {
        id: eq(next.id),
      },
      {
        selected_for_outreach:
          true,
      }
    );

    await supabaseUpdate(
      "pi_referral_prospects",
      {
        id: eq(prospectId),
      },
      {
        relationship_status:
          "approved",
        updated_at:
          new Date().toISOString(),
      }
    );

    return {
      closed: true,
      rotated: true,
      currentContact: current,
      nextContact: next,
    };
  }

  await supabaseUpdate(
    "pi_referral_prospects",
    {
      id: eq(prospectId),
    },
    {
      relationship_status:
        "closed_loop",
      updated_at:
        new Date().toISOString(),
    }
  );

  return {
    closed: true,
    rotated: false,
    currentContact: current,
    nextContact: null,
  };
}

export async function saveCadenceDraft(input: {
  prospectId: string;
  recipientName?: string;
  recipientEmail: string;
  subject: string;
  body: string;
  followUpNumber: number;
  originalOutreachEventId?: string;
  latestOutreachEventId?: string;
  inReplyTo?: string;
  references?: string[];
  rationale?: string;
  recommendedNextStep?: string;
  contactRotation?: boolean;
}) {
  const now =
    new Date().toISOString();

  const rows =
    await supabaseInsert<OutreachEvent>(
      "pi_outreach_events",
      {
        referral_prospect_id:
          input.prospectId,
        channel: "email",
        direction: "outbound",
        status: "draft",
        subject:
          clean(input.subject),
        message_summary:
          clean(input.body),
        created_at: now,
        metadata: {
          agent: "reach",
          drafted_by: "orbit",
          mode:
            input.contactRotation
              ? "referral_contact_rotation"
              : "referral_no_response_followup",
          body:
            clean(input.body),
          recipient_name:
            clean(input.recipientName),
          recipient_email:
            lower(input.recipientEmail),
          original_outreach_event_id:
            clean(input.originalOutreachEventId),
          latest_outreach_event_id:
            clean(input.latestOutreachEventId),
          in_reply_to:
            clean(input.inReplyTo),
          references:
            (input.references || [])
              .map(clean)
              .filter(Boolean),
          orbit_followup: {
            number:
              input.followUpNumber,
            contact_rotation:
              Boolean(input.contactRotation),
            cadence_type:
              "business_days",
            prepared_at: now,
            human_approval_required:
              true,
            guard_review_required:
              true,
            rationale:
              clean(input.rationale),
            recommended_next_step:
              clean(input.recommendedNextStep),
          },
        },
      }
    );

  return rows[0] || null;
}

export async function markCadencePreparationRequested(input: {
  latestOutreachEventId: string;
  followUpNumber: number;
}) {
  const rows =
    await supabaseSelect<OutreachEvent>(
      "pi_outreach_events",
      {
        select: "*",
        id:
          eq(input.latestOutreachEventId),
        limit: 1,
      }
    );

  const row = rows[0] || null;

  if (!row) {
    return null;
  }

  const metadata =
    asObject(row.metadata);

  const cadence =
    asObject(metadata.orbit_cadence);

  const key =
    `followup_${input.followUpNumber}`;

  const requests =
    asObject(cadence.requests);

  const updated =
    await supabaseUpdate<OutreachEvent>(
      "pi_outreach_events",
      {
        id: eq(row.id),
      },
      {
        metadata: {
          ...metadata,
          orbit_cadence: {
            ...cadence,
            cadence_type:
              "business_days",
            requests: {
              ...requests,
              [key]: {
                status:
                  "requested",
                requested_at:
                  new Date().toISOString(),
              },
            },
          },
        },
      }
    );

  return updated[0] || null;
}

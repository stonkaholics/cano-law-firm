import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
  supabaseUpsert,
} from "../supabase/rest";

import {
  getCalendlyAvailableTimes,
} from "../calendly/client";

import {
  createTitanCalendarEvent,
  deleteTitanCalendarEvent,
  findTitanConflicts,
  getTitanBusyEvents,
  getTitanCalendarConfig,
} from "../calendar/titan-caldav";

function clean(value: unknown) {
  return String(value || "").trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function normalizeName(value: unknown) {
  return lower(value)
    .replace(/&/g, "and")
    .replace(
      /\b(llc|pllc|pc|p\.c\.|pa|p\.a\.|law firm|law office|law offices)\b/g,
      ""
    )
    .replace(/[^a-z0-9]/g, "");
}

function normalizeDomain(value: unknown) {
  return lower(value)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function eq(value: string) {
  return `eq.${value}`;
}

function ilike(value: string) {
  return `ilike.${value}`;
}

function asObject(
  value: unknown
): Record<string, any> {
  return value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
      ? value as Record<string, any>
      : {};
}

function arrayStrings(
  value: unknown
) {
  return Array.isArray(value)
    ? value
        .map(clean)
        .filter(Boolean)
    : [];
}

export type ReferralMeeting = {
  id: string;
  referral_prospect_id?: string | null;
  calendly_event_uri: string;
  calendly_invitee_uri: string;
  calendly_event_type_uri?: string | null;
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
  titan_event_uid?: string | null;
  titan_event_url?: string | null;
  conflict_detected: boolean;
  conflict_events: any[];
  alternative_slots: any[];
  conflict_email_subject: string;
  conflict_email_body: string;
  conflict_outreach_event_id?: string | null;
  brief: Record<string, any>;
  source_payload: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type Prospect = {
  id: string;
  organization_name: string;
  contact_name?: string;
  category?: string;
  practice_area?: string;
  city?: string;
  state?: string;
  website?: string;
  email?: string;
  phone?: string;
  why_fit?: string;
  source_url?: string;
  relationship_status?: string;
  score?: number;
  organization_domain?: string;
  metadata?: Record<string, any>;
};

type Contact = {
  id: string;
  prospect_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  metadata?: Record<string, any>;
};

type OutreachEvent = {
  id: string;
  referral_prospect_id?: string | null;
  channel?: string;
  direction?: string;
  status?: string;
  subject?: string;
  message_summary?: string;
  occurred_at?: string | null;
  created_at?: string;
  metadata?: Record<string, any>;
};

export type ReferralOutreachCandidate = {
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

function questionAnswerMap(
  invitee: any
) {
  const rows =
    Array.isArray(
      invitee
        ?.questions_and_answers
    )
      ? invitee
          .questions_and_answers
      : [];

  return rows
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
        row.question ||
        row.answer
    );
}

function answerByKeywords(
  invitee: any,
  keywords: string[]
) {
  const rows =
    questionAnswerMap(
      invitee
    );

  const match =
    rows.find(
      (row: any) => {
        const question =
          lower(
            row.question
          );

        return keywords.some(
          (keyword) =>
            question.includes(
              lower(
                keyword
              )
            )
        );
      }
    );

  return clean(
    match?.answer
  );
}

function answerByQuestionPriority(
  invitee: any,
  patterns: RegExp[],
  fallbackKeywords: string[] = []
) {
  const rows =
    questionAnswerMap(
      invitee
    );

  for (
    const pattern of
    patterns
  ) {
    const match =
      rows.find(
        (row: any) =>
          pattern.test(
            clean(
              row.question
            )
          )
      );

    if (
      clean(
        match?.answer
      )
    ) {
      return clean(
        match.answer
      );
    }
  }

  return fallbackKeywords.length
    ? answerByKeywords(
        invitee,
        fallbackKeywords
      )
    : "";
}

function looksLikePhone(
  value: unknown
) {
  const digits =
    clean(value)
      .replace(
        /\D/g,
        ""
      );

  return digits.length >= 7;
}

function extractInviteePhone(
  invitee: any,
  event: any
) {
  const direct =
    [
      invitee
        ?.text_reminder_number,
      invitee
        ?.phone_number,
      invitee
        ?.phone,
      invitee
        ?.mobile_number,
      invitee
        ?.mobile,
      invitee
        ?.sms_reminder_number,
      invitee
        ?.location
        ?.location,
      event
        ?.location
        ?.location,
    ]
      .map(clean)
      .filter(Boolean)
      .find(
        looksLikePhone
      );

  if (direct) {
    return direct;
  }

  return answerByQuestionPriority(
    invitee,
    [
      /^(phone|phone number|mobile|mobile number|telephone|telephone number|cell|cell phone)$/i,
      /best.*(phone|number)/i,
      /(phone|mobile|telephone|cell).*(reach|contact|call)/i,
      /(direct).*(phone|number)/i,
    ],
    [
      "phone",
      "mobile",
      "telephone",
      "cell",
    ]
  );
}

export function extractCalendlyMeetingFields(
  invitee: any,
  event: any
) {
  const questionsAndAnswers =
    questionAnswerMap(
      invitee
    );

  const organizationName =
    answerByQuestionPriority(
      invitee,
      [
        /^(law firm|law firm name|firm name|company|company name|organization|organization name)$/i,
        /(name of).*(law firm|firm|company|organization)/i,
        /(law firm|firm|company|organization).*name/i,
      ],
      [
        "law firm name",
        "firm name",
        "company name",
        "organization name",
      ]
    );

  const website =
    answerByQuestionPriority(
      invitee,
      [
        /^(website|website url|firm website|law firm website|company website|organization website)$/i,
        /(firm|company|organization).*website/i,
      ],
      [
        "website",
        "url",
      ]
    );

  const practiceAreasRaw =
    answerByQuestionPriority(
      invitee,
      [
        /^(practice area|practice areas|primary practice area|primary practice areas)$/i,
        /what.*practice area/i,
        /(primary|main).*practice/i,
      ],
      [
        "practice area",
        "practice areas",
        "primary practice",
      ]
    );

  const phone =
    extractInviteePhone(
      invitee,
      event
    );

  const practiceAreas =
    practiceAreasRaw
      ? practiceAreasRaw
          .split(
            /[,;|]/g
          )
          .map(clean)
          .filter(Boolean)
      : [];

  return {
    inviteeName:
      clean(
        invitee?.name
      ),

    inviteeEmail:
      clean(
        invitee?.email
      ),

    inviteePhone:
      phone,

    organizationName,

    website,

    practiceAreas,

    questionsAndAnswers,

    timezone:
      clean(
        invitee?.timezone
      ) ||
      "America/New_York",

    eventName:
      clean(
        event?.name
      ),

    startAt:
      clean(
        event?.start_time
      ),

    endAt:
      clean(
        event?.end_time
      ),

    eventTypeUri:
      clean(
        event?.event_type
      ),
  };
}

async function getProspectById(
  id:
    string
) {
  if (!id) {
    return null;
  }

  const rows =
    await supabaseSelect<Prospect>(
      "pi_referral_prospects",
      {
        select:
          "*",
        id:
          eq(id),
        limit:
          1,
      }
    );

  return rows[0] || null;
}

export async function matchReferralProspect(input: {
  email?: string;
  organizationName?: string;
  website?: string;
}) {
  const email =
    lower(
      input.email
    );

  if (email) {
    const contactRows =
      await supabaseSelect<Contact>(
        "pi_referral_contacts",
        {
          select:
            "*",
          email:
            ilike(email),
          limit:
            5,
        }
      );

    if (
      contactRows[0]
    ) {
      const prospect =
        await getProspectById(
          contactRows[0]
            .prospect_id
        );

      if (prospect) {
        return {
          prospect,
          contact:
            contactRows[0],
          matchedBy:
            "contact_email",
        };
      }
    }

    const prospectRows =
      await supabaseSelect<Prospect>(
        "pi_referral_prospects",
        {
          select:
            "*",
          email:
            ilike(email),
          limit:
            5,
        }
      );

    if (
      prospectRows[0]
    ) {
      return {
        prospect:
          prospectRows[0],
        contact:
          null,
        matchedBy:
          "prospect_email",
      };
    }
  }

  const domain =
    normalizeDomain(
      input.website
    ) ||
    (
      email.includes("@")
        ? email.split("@")[1]
        : ""
    );

  if (domain) {
    const rows =
      await supabaseSelect<Prospect>(
        "pi_referral_prospects",
        {
          select:
            "*",
          organization_domain:
            ilike(domain),
          limit:
            20,
        }
      );

    const prospect =
      rows.find(
        (row) =>
          normalizeDomain(
            row.organization_domain ||
            row.website
          ) === domain
      );

    if (prospect) {
      return {
        prospect,
        contact:
          null,
        matchedBy:
          "domain",
      };
    }
  }

  const organizationName =
    clean(
      input.organizationName
    );

  if (organizationName) {
    const rows =
      await supabaseSelect<Prospect>(
        "pi_referral_prospects",
        {
          select:
            "*",
          organization_name:
            ilike(
              organizationName
            ),
          limit:
            20,
        }
      );

    const normalized =
      normalizeName(
        organizationName
      );

    const prospect =
      rows.find(
        (row) =>
          normalizeName(
            row.organization_name
          ) === normalized
      ) ||
      rows[0];

    if (prospect) {
      return {
        prospect,
        contact:
          null,
        matchedBy:
          "organization_name",
      };
    }
  }

  return {
    prospect:
      null,
    contact:
      null,
    matchedBy:
      "none",
  };
}

function outreachRecipientEmail(
  event:
    OutreachEvent | null
) {
  if (!event) {
    return "";
  }

  const metadata =
    asObject(
      event.metadata
    );

  const delivery =
    asObject(
      metadata.delivery
    );

  return clean(
    metadata
      .recipient_email
  ) ||
  clean(
    delivery.recipient
  );
}

function outreachRecipientName(
  event:
    OutreachEvent | null
) {
  if (!event) {
    return "";
  }

  return clean(
    asObject(
      event.metadata
    )
      .recipient_name
  );
}

async function getContactForProspect(
  prospectId: string,
  email = ""
) {
  if (!prospectId) {
    return null;
  }

  if (email) {
    const exact =
      await supabaseSelect<Contact>(
        "pi_referral_contacts",
        {
          select:
            "*",
          prospect_id:
            eq(
              prospectId
            ),
          email:
            ilike(
              email
            ),
          limit:
            1,
        }
      );

    if (exact[0]) {
      return exact[0];
    }
  }

  const rows =
    await supabaseSelect<Contact>(
      "pi_referral_contacts",
      {
        select:
          "*",
        prospect_id:
          eq(
            prospectId
          ),
        order:
          "priority.asc,created_at.asc",
        limit:
          10,
      }
    );

  return (
    rows.find(
      (row) =>
        Boolean(
          row
            .selected_for_outreach
        )
    ) ||
    rows[0] ||
    null
  );
}

async function getOutreachById(
  id: string
) {
  if (!id) {
    return null;
  }

  const rows =
    await supabaseSelect<OutreachEvent>(
      "pi_outreach_events",
      {
        select:
          "*",
        id:
          eq(id),
        limit:
          1,
      }
    );

  return rows[0] || null;
}

async function findMatchingSentOutreach(input: {
  inviteeEmail?: string;
  referralProspectId?: string | null;
}) {
  const rows =
    await supabaseSelect<OutreachEvent>(
      "pi_outreach_events",
      {
        select:
          "*",
        order:
          "occurred_at.desc,created_at.desc",
        limit:
          250,
      }
    );

  const sent =
    rows.filter(
      (row) =>
        lower(
          row.status
        ) ===
          "sent" &&
        lower(
          row.channel
        ) ===
          "email" &&
        (
          !row.direction ||
          lower(
            row.direction
          ) ===
            "outbound"
        )
    );

  const email =
    lower(
      input.inviteeEmail
    );

  if (email) {
    const exactEmail =
      sent.find(
        (row) =>
          lower(
            outreachRecipientEmail(
              row
            )
          ) ===
          email
      );

    if (exactEmail) {
      return {
        event:
          exactEmail,
        matchedBy:
          "recipient_email",
      };
    }
  }

  const prospectId =
    clean(
      input.referralProspectId
    );

  if (prospectId) {
    const prospectMatch =
      sent.find(
        (row) =>
          clean(
            row
              .referral_prospect_id
          ) ===
          prospectId
      );

    if (prospectMatch) {
      return {
        event:
          prospectMatch,
        matchedBy:
          "referral_prospect",
      };
    }
  }

  return {
    event:
      null,
    matchedBy:
      "none",
  };
}

export async function listReferralOutreachCandidates() {
  const [
    events,
    prospects,
  ] =
    await Promise.all([
      supabaseSelect<OutreachEvent>(
        "pi_outreach_events",
        {
          select:
            "*",
          order:
            "occurred_at.desc,created_at.desc",
          limit:
            250,
        }
      ),

      supabaseSelect<Prospect>(
        "pi_referral_prospects",
        {
          select:
            "*",
          order:
            "updated_at.desc",
          limit:
            500,
        }
      ),
    ]);

  const prospectMap =
    new Map(
      prospects.map(
        (row) => [
          clean(
            row.id
          ),
          row,
        ]
      )
    );

  return events
    .filter(
      (event) =>
        lower(
          event.status
        ) ===
          "sent" &&
        lower(
          event.channel
        ) ===
          "email" &&
        (
          !event.direction ||
          lower(
            event.direction
          ) ===
            "outbound"
        )
    )
    .map(
      (
        event
      ): ReferralOutreachCandidate => {
        const prospect =
          prospectMap.get(
            clean(
              event
                .referral_prospect_id
            )
          );

        const metadata =
          asObject(
            event.metadata
          );

        const delivery =
          asObject(
            metadata.delivery
          );

        return {
          id:
            event.id,

          referral_prospect_id:
            event
              .referral_prospect_id ||
            null,

          organization_name:
            clean(
              prospect
                ?.organization_name
            ) ||
            clean(
              metadata
                .organization_name
            ),

          recipient_name:
            outreachRecipientName(
              event
            ),

          recipient_email:
            outreachRecipientEmail(
              event
            ),

          subject:
            clean(
              event.subject
            ),

          status:
            clean(
              event.status
            ),

          sent_at:
            clean(
              delivery.sent_at
            ) ||
            clean(
              event.occurred_at
            ) ||
            clean(
              event.created_at
            ),

          message_summary:
            clean(
              event
                .message_summary
            ),
        };
      }
    );
}


function extractProspectSources(
  prospect:
    Prospect | null
) {
  if (!prospect) {
    return [];
  }

  const metadata =
    asObject(
      prospect.metadata
    );

  return Array.from(
    new Set(
      [
        clean(
          prospect.source_url
        ),
        ...arrayStrings(
          metadata
            .practice_source_urls
        ),
        ...arrayStrings(
          metadata
            .source_urls
        ),
      ].filter(Boolean)
    )
  );
}

function fallbackBrief(
  meeting:
    Partial<ReferralMeeting>,
  prospect:
    Prospect | null,
  contact:
    Contact | null
) {
  const prospectMetadata =
    asObject(
      prospect?.metadata
    );

  const knownPractice =
    clean(
      prospect?.practice_area
    ) ||
    arrayStrings(
      meeting.practice_areas
    ).join(", ") ||
    "Not yet confirmed";

  const whyFit =
    clean(
      prospect?.why_fit
    );

  const referralLane =
    clean(
      prospectMetadata
        .referral_lane
    );

  const fitScore =
    Number(
      prospect?.score || 0
    );

  const sourceUrls =
    extractProspectSources(
      prospect
    );

  return {
    generation_mode:
      "structured_fallback",

    generated_at:
      new Date()
        .toISOString(),

    firm_snapshot: {
      organization:
        clean(
          prospect?.organization_name
        ) ||
        clean(
          meeting.organization_name
        ),

      contact:
        clean(
          contact?.full_name
        ) ||
        clean(
          meeting.invitee_name
        ),

      contact_title:
        clean(
          contact?.title
        ),

      location:
        [
          clean(
            prospect?.city
          ),
          clean(
            prospect?.state
          ),
        ]
          .filter(Boolean)
          .join(", "),

      website:
        clean(
          prospect?.website
        ) ||
        clean(
          meeting.website
        ),

      practice_area:
        knownPractice,

      referral_lane:
        referralLane,

      fit_score:
        fitScore || null,
    },

    why_this_meeting:
      whyFit ||
      (
        prospect
          ? "Existing Scout referral prospect with a booked introduction."
          : "New Calendly referral meeting that has not yet been matched to a Scout prospect."
      ),

    cano_can_help_them_with: [
      "Florida personal injury matters that fit Cano Law Firm's current intake criteria.",
      "Immigration matters, including detained immigration matters and habeas-related issues where appropriate.",
      "Conflict or capacity situations where Cano may be a suitable professional resource.",
    ],

    they_may_help_cano_with: [
      knownPractice !==
        "Not yet confirmed"
        ? `${knownPractice} matters that fall outside Cano's preferred handling profile.`
        : "Practice areas they handle that Cano does not currently keep in-house.",
      "Geographic or subject-matter matters where their firm is better positioned.",
      "Conflict or capacity referrals where their team is an appropriate fit.",
    ],

    conversation_opportunities: [
      "Ask which matters the firm routinely refers out even when the prospective client appears viable.",
      "Ask which practice areas and geographies the firm prefers to keep versus refer.",
      "Explain Cano's Personal Injury and Immigration capabilities without promising reciprocal referrals.",
      "Discuss a simple professional referral workflow and the best point of contact for future matters.",
    ],

    suggested_questions: [
      "What types of matters do you most often refer to other firms?",
      "Are there practice areas you regularly encounter but do not handle internally?",
      "Are there geographic or case-profile situations where you prefer to refer rather than keep the matter?",
      "What is the easiest way for our teams to make a warm introduction when a matter is a better fit for the other firm?",
    ],

    watchouts: [
      "Do not promise reciprocal referrals or case volume.",
      "Do not discuss referral-fee economics unless counsel determines it is appropriate and compliant.",
      "Treat Scout classifications as business-development intelligence, not verified statements from the other firm.",
    ],

    source_urls:
      sourceUrls,
  };
}

async function aiBriefFromN8n(input: {
  meeting:
    Partial<ReferralMeeting>;
  prospect:
    Prospect | null;
  contact:
    Contact | null;
  fallback:
    Record<string, any>;
}) {
  const url =
    clean(
      process.env
        .N8N_PI_REFERRAL_MEETING_BRIEF_WEBHOOK
    );

  if (!url) {
    return null;
  }

  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...(clean(
            process.env
              .N8N_SHARED_SECRET
          )
            ? {
                "x-cano-secret":
                  clean(
                    process.env
                      .N8N_SHARED_SECRET
                  ),
              }
            : {}),
        },

        body:
          JSON.stringify({
            action:
              "build_referral_meeting_brief",

            meeting:
              input.meeting,

            prospect:
              input.prospect,

            contact:
              input.contact,

            fallback:
              input.fallback,

            rules: {
              do_not_invent:
                true,
              source_specific_claims:
                true,
              no_fee_promises:
                true,
              no_reciprocal_referral_promises:
                true,
              attorney_review:
                true,
            },
          }),

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Referral meeting intelligence workflow failed (${response.status}): ${
        text ||
        response.statusText
      }`
    );
  }

  let data: any = {};

  try {
    data =
      text
        ? JSON.parse(
            text
          )
        : {};
  } catch {
    return null;
  }

  const brief =
    data?.brief ||
    data?.output?.brief ||
    data?.output ||
    data;

  return brief &&
    typeof brief ===
      "object" &&
    !Array.isArray(brief)
      ? brief
      : null;
}

export async function generateReferralMeetingBrief(input: {
  meeting:
    Partial<ReferralMeeting>;
  prospect:
    Prospect | null;
  contact:
    Contact | null;
}) {
  const fallback =
    fallbackBrief(
      input.meeting,
      input.prospect,
      input.contact
    );

  try {
    const ai =
      await aiBriefFromN8n({
        ...input,
        fallback,
      });

    if (ai) {
      return {
        ...fallback,
        ...ai,
        generation_mode:
          "n8n_ai",
        generated_at:
          new Date()
            .toISOString(),
      };
    }
  } catch (error) {
    return {
      ...fallback,
      generation_warning:
        error instanceof Error
          ? error.message
          : "AI meeting brief generation failed.",
    };
  }

  return fallback;
}

function formatEastern(
  value:
    string | Date
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

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
  ).format(date);
}

function buildConflictEmail(input: {
  inviteeName: string;
  startAt: string;
  alternativeSlots: Array<{
    start: string;
    end: string;
  }>;
}) {
  const firstName =
    clean(
      input.inviteeName
    ).split(/\s+/)[0] ||
    "there";

  const alternatives =
    input.alternativeSlots
      .slice(0, 3)
      .map(
        (slot) =>
          formatEastern(
            slot.start
          )
      );

  const optionsText =
    alternatives.length
      ? alternatives
          .map(
            (
              value,
              index
            ) =>
              `${
                index + 1
              }. ${value}`
          )
          .join("\n")
      : "I can send over a few alternate times that are open on our calendar.";

  return {
    subject:
      "Quick scheduling adjustment",

    body:
      `Hi ${firstName},

I just noticed a calendar conflict with the referral call you booked for ${formatEastern(
        input.startAt
      )}.

Would one of these nearby times work for you instead?

${optionsText}

If none of those work, no problem at all. I can find another time that fits your schedule.

Best regards,

Erik Quisenberry
Chief Operating Officer
Cano Law Firm, P.A.`,
  };
}

async function availableCalendlySlots(input: {
  eventTypeUri: string;
  desiredStart: Date;
  durationMinutes: number;
  titanBusy: any[];
}) {
  if (!input.eventTypeUri) {
    return [];
  }

  const start =
    new Date(
      input.desiredStart
    );

  start.setUTCDate(
    start.getUTCDate() - 1
  );

  const end =
    new Date(
      input.desiredStart
    );

  end.setUTCDate(
    end.getUTCDate() + 3
  );

  try {
    const rows =
      await getCalendlyAvailableTimes({
        eventTypeUri:
          input.eventTypeUri,
        startTime:
          start.toISOString(),
        endTime:
          end.toISOString(),
      });

    const candidates =
      rows
        .map(
          (row: any) => {
            const slotStart =
              new Date(
                row?.start_time ||
                row?.startTime ||
                ""
              );

            const slotEnd =
              row?.end_time ||
              row?.endTime
                ? new Date(
                    row.end_time ||
                    row.endTime
                  )
                : new Date(
                    slotStart.getTime() +
                    input.durationMinutes *
                      60000
                  );

            return {
              start:
                slotStart.toISOString(),
              end:
                slotEnd.toISOString(),
              scheduling_url:
                clean(
                  row?.scheduling_url
                ),
              source:
                "calendly_and_titan",
            };
          }
        )
        .filter(
          (slot: any) =>
            Number.isFinite(
              new Date(
                slot.start
              ).getTime()
            )
        )
        .filter(
          (slot: any) =>
            !findTitanConflicts(
              new Date(
                slot.start
              ),
              new Date(
                slot.end
              ),
              input.titanBusy
            ).length
        );

    candidates.sort(
      (a: any, b: any) =>
        Math.abs(
          new Date(
            a.start
          ).getTime() -
            input.desiredStart.getTime()
        ) -
        Math.abs(
          new Date(
            b.start
          ).getTime() -
            input.desiredStart.getTime()
        )
    );

    return candidates.slice(
      0,
      5
    );
  } catch {
    return [];
  }
}

export async function createConflictReachDraft(
  meeting:
    ReferralMeeting
) {
  if (
    !meeting
      .referral_prospect_id
  ) {
    return {
      ok: false,
      skipped: true,
      reason:
        "Meeting is not matched to a Scout referral prospect.",
    };
  }

  if (
    clean(
      meeting
        .conflict_outreach_event_id
    )
  ) {
    return {
      ok: true,
      existing: true,
      id:
        meeting
          .conflict_outreach_event_id,
    };
  }

  const rows =
    await supabaseInsert<any>(
      "pi_outreach_events",
      {
        referral_prospect_id:
          meeting
            .referral_prospect_id,

        channel:
          "email",

        direction:
          "outbound",

        status:
          "draft",

        subject:
          meeting
            .conflict_email_subject,

        message_summary:
          meeting
            .conflict_email_body,

        approved_by:
          "",

        approved_at:
          null,

        occurred_at:
          null,

        next_follow_up_at:
          null,

        metadata: {
          body:
            meeting
              .conflict_email_body,

          recipient_email:
            meeting
              .invitee_email,

          recipient_name:
            meeting
              .invitee_name,

          sender_name:
            "Erik Quisenberry",

          sender_title:
            "Chief Operating Officer",

          sender_email:
            "contact@canolawfirm.com",

          source:
            "orbit_calendar_conflict",

          referral_meeting_id:
            meeting.id,

          human_approval_required:
            true,

          guard_review_required:
            true,

          send_email:
            false,
        },
      }
    );

  const created =
    rows[0] || null;

  if (created?.id) {
    await supabaseUpdate(
      "pi_referral_meetings",
      {
        id:
          eq(
            meeting.id
          ),
      },
      {
        conflict_outreach_event_id:
          created.id,
        updated_at:
          new Date()
            .toISOString(),
      }
    );
  }

  return {
    ok: true,
    id:
      created?.id || null,
  };
}

export async function processCalendlyBooking(input: {
  eventUri: string;
  inviteeUri: string;
  event: any;
  invitee: any;
  rawPayload: any;
  appOrigin: string;
}) {
  const fields =
    extractCalendlyMeetingFields(
      input.invitee,
      input.event
    );

  if (
    !fields.startAt ||
    !fields.endAt
  ) {
    throw new Error(
      "Calendly event is missing start_time or end_time."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | EXISTING MEETING
  |--------------------------------------------------------------------------
  |
  | Re-syncing Calendly should enrich the existing Orbit record, not create a
  | second Titan event or forget a manual Reach connection.
  |--------------------------------------------------------------------------
  */

  const existingRows =
    await supabaseSelect<ReferralMeeting>(
      "pi_referral_meetings",
      {
        select:
          "*",
        calendly_invitee_uri:
          eq(
            input.inviteeUri
          ),
        limit:
          1,
      }
    );

  const existingMeeting =
    existingRows[0] ||
    null;

  const existingSource =
    asObject(
      existingMeeting
        ?.source_payload
    );

  const existingOutreachLink =
    asObject(
      existingSource
        .outreach_link
    );

  let match =
    await matchReferralProspect({
      email:
        fields.inviteeEmail,

      organizationName:
        fields.organizationName,

      website:
        fields.website,
    });

  /*
  |--------------------------------------------------------------------------
  | REACH → ORBIT AUTO MATCH
  |--------------------------------------------------------------------------
  |
  | First honor a manual link if one exists. Otherwise match the Calendly
  | invitee to a real sent Reach email by exact recipient email, then by the
  | already-resolved Scout prospect.
  |--------------------------------------------------------------------------
  */

  let outreachMatch:
    {
      event:
        OutreachEvent | null;
      matchedBy:
        string;
    } = {
      event:
        null,
      matchedBy:
        "none",
    };

  if (
    clean(
      existingOutreachLink
        .outreach_event_id
    )
  ) {
    outreachMatch = {
      event:
        await getOutreachById(
          clean(
            existingOutreachLink
              .outreach_event_id
          )
        ),
      matchedBy:
        clean(
          existingOutreachLink
            .match_method
        ) ||
        "manual",
    };
  }

  if (
    !outreachMatch
      .event
  ) {
    outreachMatch =
      await findMatchingSentOutreach({
        inviteeEmail:
          fields
            .inviteeEmail,

        referralProspectId:
          match
            .prospect
            ?.id ||
          null,
      });
  }

  let matchedProspect =
    match.prospect;

  if (
    !matchedProspect &&
    clean(
      outreachMatch
        .event
        ?.referral_prospect_id
    )
  ) {
    matchedProspect =
      await getProspectById(
        clean(
          outreachMatch
            .event
            ?.referral_prospect_id
        )
      );
  }

  let matchedContact =
    match.contact;

  if (
    !matchedContact &&
    matchedProspect?.id
  ) {
    matchedContact =
      await getContactForProspect(
        matchedProspect.id,
        fields.inviteeEmail ||
        outreachRecipientEmail(
          outreachMatch
            .event
        )
      );
  }

  const start =
    new Date(
      fields.startAt
    );

  const end =
    new Date(
      fields.endAt
    );

  const titanConfig =
    getTitanCalendarConfig();

  let calendarStatus =
    titanConfig.configured
      ? "checking"
      : "not_configured";

  let conflictDetected =
    false;

  let conflictEvents:
    any[] = [];

  let alternativeSlots:
    any[] = [];

  let titanEventUid:
    string | null =
    existingMeeting
      ?.titan_event_uid ||
    null;

  let titanEventUrl:
    string | null =
    existingMeeting
      ?.titan_event_url ||
    null;

  let calendarError = "";

  if (
    titanConfig.configured
  ) {
    try {
      const windowStart =
        new Date(
          start.getTime() -
          24 *
            60 *
            60 *
            1000
        );

      const windowEnd =
        new Date(
          end.getTime() +
          3 *
            24 *
            60 *
            60 *
            1000
        );

      const busy =
        await getTitanBusyEvents(
          windowStart,
          windowEnd
        );

      conflictEvents =
        findTitanConflicts(
          start,
          end,
          busy
        ).filter(
          (event) =>
            clean(
              event?.uid
            ) !==
            clean(
              existingMeeting
                ?.titan_event_uid
            )
        );

      conflictDetected =
        conflictEvents.length >
        0;

      if (
        conflictDetected
      ) {
        calendarStatus =
          "conflict";

        const durationMinutes =
          Math.max(
            15,
            Math.round(
              (
                end.getTime() -
                start.getTime()
              ) /
              60000
            )
          );

        alternativeSlots =
          await availableCalendlySlots({
            eventTypeUri:
              fields
                .eventTypeUri,

            desiredStart:
              start,

            durationMinutes,

            titanBusy:
              busy,
          });
      } else {
        /*
        | Keep the already-created Titan event on re-sync. This prevents Orbit
        | from duplicating the same Calendly booking each time Sync is pressed.
        */
        if (
          !titanEventUrl
        ) {
          const uid =
            `cano-referral-${
              input
                .inviteeUri
                .split("/")
                .pop() ||
              Date.now()
            }@canolawfirm.com`;

          const eventResult =
            await createTitanCalendarEvent({
              uid,

              start,

              end,

              summary:
                `Referral Partnership Call - ${
                  fields
                    .organizationName ||
                  matchedProspect
                    ?.organization_name ||
                  fields
                    .inviteeName ||
                  "Calendly Invitee"
                }`,

              description:
                [
                  "Cano Law Firm referral partnership meeting.",
                  "",
                  `Contact: ${
                    fields
                      .inviteeName ||
                    ""
                  }`,
                  `Email: ${
                    fields
                      .inviteeEmail ||
                    ""
                  }`,
                  `Phone: ${
                    fields
                      .inviteePhone ||
                    matchedContact
                      ?.phone ||
                    ""
                  }`,
                  `Firm: ${
                    fields
                      .organizationName ||
                    matchedProspect
                      ?.organization_name ||
                    ""
                  }`,
                  `Practice Areas: ${
                    (
                      fields
                        .practiceAreas
                        .length
                        ? fields
                            .practiceAreas
                        : [
                            clean(
                              matchedProspect
                                ?.practice_area
                            ),
                          ].filter(
                            Boolean
                          )
                    )
                      .join(", ")
                  }`,
                  "",
                  ...(
                    fields
                      .questionsAndAnswers
                      .length
                      ? [
                          "Calendly Intake:",
                          ...fields
                            .questionsAndAnswers
                            .map(
                              (row: any) =>
                                `${clean(
                                  row.question
                                )}: ${clean(
                                  row.answer
                                )}`
                            ),
                          "",
                        ]
                      : []
                  ),
                  `PI Floor: ${input.appOrigin}/personal-injury`,
                ].join("\n"),

              location:
                fields
                  .inviteePhone ||
                matchedContact
                  ?.phone ||
                "Phone call",
            });

          titanEventUid =
            eventResult.uid;

          titanEventUrl =
            eventResult.eventUrl;
        }

        calendarStatus =
          "created";
      }
    } catch (error) {
      calendarStatus =
        "error";

      calendarError =
        error instanceof Error
          ? error.message
          : "Titan calendar sync failed.";
    }
  }

  const conflictEmail =
    conflictDetected
      ? buildConflictEmail({
          inviteeName:
            fields.inviteeName,

          startAt:
            fields.startAt,

          alternativeSlots:
            alternativeSlots,
        })
      : {
          subject: "",
          body: "",
        };

  const resolvedPracticeAreas =
    fields
      .practiceAreas
      .length
      ? fields
          .practiceAreas
      : [
          clean(
            matchedProspect
              ?.practice_area
          ),
        ].filter(
          Boolean
        );

  const outreachLink =
    outreachMatch.event
      ? {
          outreach_event_id:
            outreachMatch
              .event
              .id,

          referral_prospect_id:
            outreachMatch
              .event
              .referral_prospect_id ||
            matchedProspect
              ?.id ||
            null,

          match_method:
            clean(
              existingOutreachLink
                .outreach_event_id
            )
              ? (
                  clean(
                    existingOutreachLink
                      .match_method
                  ) ||
                  "manual"
                )
              : outreachMatch
                  .matchedBy,

          manual:
            Boolean(
              existingOutreachLink
                .manual
            ),

          linked_at:
            clean(
              existingOutreachLink
                .linked_at
            ) ||
            new Date()
              .toISOString(),

          recipient_email:
            outreachRecipientEmail(
              outreachMatch
                .event
            ),

          recipient_name:
            outreachRecipientName(
              outreachMatch
                .event
            ),

          subject:
            clean(
              outreachMatch
                .event
                .subject
            ),
        }
      : null;

  const partialMeeting:
    Partial<ReferralMeeting> = {
      referral_prospect_id:
        matchedProspect
          ?.id ||
        null,

      calendly_event_uri:
        input.eventUri,

      calendly_invitee_uri:
        input.inviteeUri,

      calendly_event_type_uri:
        fields.eventTypeUri,

      invitee_name:
        fields.inviteeName,

      invitee_email:
        fields.inviteeEmail,

      invitee_phone:
        fields.inviteePhone ||
        clean(
          matchedContact
            ?.phone
        ) ||
        clean(
          matchedProspect
            ?.phone
        ),

      organization_name:
        fields.organizationName ||
        clean(
          matchedProspect
            ?.organization_name
        ),

      website:
        fields.website ||
        clean(
          matchedProspect
            ?.website
        ),

      practice_areas:
        resolvedPracticeAreas,

      start_at:
        fields.startAt,

      end_at:
        fields.endAt,

      timezone:
        fields.timezone,

      status:
        conflictDetected
          ? "conflict"
          : "booked",

      calendar_status:
        calendarStatus,

      titan_event_uid:
        titanEventUid,

      titan_event_url:
        titanEventUrl,

      conflict_detected:
        conflictDetected,

      conflict_events:
        conflictEvents,

      alternative_slots:
        alternativeSlots,

      conflict_email_subject:
        conflictEmail.subject,

      conflict_email_body:
        conflictEmail.body,

      source_payload: {
        ...existingSource,

        calendly:
          input.rawPayload,

        /*
        | Save the complete API records. The webhook envelope alone does not
        | contain every Calendly form answer.
        */
        calendly_event:
          input.event,

        calendly_invitee:
          input.invitee,

        calendly_intake: {
          questions_and_answers:
            fields
              .questionsAndAnswers,

          phone:
            fields
              .inviteePhone,

          firm:
            fields
              .organizationName,

          website:
            fields
              .website,

          practice_areas:
            fields
              .practiceAreas,
        },

        match: {
          matched_by:
            match.matchedBy,
          prospect_id:
            matchedProspect
              ?.id ||
            null,
          contact_id:
            matchedContact
              ?.id ||
            null,
        },

        outreach_link:
          outreachLink,

        calendar_error:
          calendarError,
      },
    };

  const brief =
    await generateReferralMeetingBrief({
      meeting:
        partialMeeting,

      prospect:
        matchedProspect,

      contact:
        matchedContact,
    });

  const savedRows =
    await supabaseUpsert<ReferralMeeting>(
      "pi_referral_meetings",
      {
        ...partialMeeting,
        brief,
        updated_at:
          new Date()
            .toISOString(),
      },
      "calendly_invitee_uri"
    );

  const meeting =
    savedRows[0];

  if (
    matchedProspect?.id
  ) {
    await supabaseUpdate(
      "pi_referral_prospects",
      {
        id:
          eq(
            matchedProspect
              .id
          ),
      },
      {
        relationship_status:
          "meeting",

        next_follow_up_at:
          fields.startAt,

        updated_at:
          new Date()
            .toISOString(),
      }
    );
  }

  if (
    meeting &&
    conflictDetected &&
    meeting
      .referral_prospect_id
  ) {
    try {
      await createConflictReachDraft(
        meeting
      );
    } catch {
      // Conflict remains visible in Orbit even if Reach draft creation fails.
    }
  }

  return meeting;
}

export async function processCalendlyCancellation(input: {
  inviteeUri: string;
  rawPayload: any;
}) {
  const rows =
    await supabaseSelect<ReferralMeeting>(
      "pi_referral_meetings",
      {
        select:
          "*",
        calendly_invitee_uri:
          eq(
            input.inviteeUri
          ),
        limit:
          1,
      }
    );

  const meeting =
    rows[0] || null;

  if (!meeting) {
    return null;
  }

  if (
    clean(
      meeting.titan_event_url
    )
  ) {
    await deleteTitanCalendarEvent(
      clean(
        meeting
          .titan_event_url
      )
    );
  }

  const updated =
    await supabaseUpdate<ReferralMeeting>(
      "pi_referral_meetings",
      {
        id:
          eq(
            meeting.id
          ),
      },
      {
        status:
          "canceled",
        calendar_status:
          "canceled",
        source_payload: {
          ...asObject(
            meeting.source_payload
          ),
          cancellation:
            input.rawPayload,
        },
        updated_at:
          new Date()
            .toISOString(),
      }
    );

  return updated[0] || null;
}

export async function linkMeetingToOutreach(
  meetingId: string,
  outreachEventId: string
) {
  const meetingRows =
    await supabaseSelect<ReferralMeeting>(
      "pi_referral_meetings",
      {
        select:
          "*",
        id:
          eq(
            meetingId
          ),
        limit:
          1,
      }
    );

  const meeting =
    meetingRows[0] ||
    null;

  if (!meeting) {
    throw new Error(
      "Referral meeting not found."
    );
  }

  const outreach =
    await getOutreachById(
      outreachEventId
    );

  if (!outreach) {
    throw new Error(
      "Reach outreach email not found."
    );
  }

  if (
    lower(
      outreach.status
    ) !==
      "sent"
  ) {
    throw new Error(
      "Only a sent Reach email can be connected to an Orbit meeting."
    );
  }

  const prospectId =
    clean(
      outreach
        .referral_prospect_id
    );

  const prospect =
    prospectId
      ? await getProspectById(
          prospectId
        )
      : null;

  const recipientEmail =
    outreachRecipientEmail(
      outreach
    );

  const contact =
    prospect?.id
      ? await getContactForProspect(
          prospect.id,
          recipientEmail ||
          meeting.invitee_email
        )
      : null;

  const source =
    asObject(
      meeting
        .source_payload
    );

  const nextMeeting:
    Partial<ReferralMeeting> = {
      ...meeting,

      referral_prospect_id:
        prospect
          ?.id ||
        meeting
          .referral_prospect_id ||
        null,

      organization_name:
        clean(
          prospect
            ?.organization_name
        ) ||
        meeting
          .organization_name,

      website:
        clean(
          prospect
            ?.website
        ) ||
        meeting
          .website,

      invitee_phone:
        meeting
          .invitee_phone ||
        clean(
          contact?.phone
        ) ||
        clean(
          prospect?.phone
        ),

      practice_areas:
        (
          Array.isArray(
            meeting
              .practice_areas
          ) &&
          meeting
            .practice_areas
            .length
        )
          ? meeting
              .practice_areas
          : [
              clean(
                prospect
                  ?.practice_area
              ),
            ].filter(
              Boolean
            ),

      source_payload: {
        ...source,

        outreach_link: {
          outreach_event_id:
            outreach.id,

          referral_prospect_id:
            prospect
              ?.id ||
            outreach
              .referral_prospect_id ||
            null,

          match_method:
            "manual",

          manual:
            true,

          linked_at:
            new Date()
              .toISOString(),

          recipient_email:
            recipientEmail,

          recipient_name:
            outreachRecipientName(
              outreach
            ),

          subject:
            clean(
              outreach.subject
            ),
        },

        match: {
          ...asObject(
            source.match
          ),

          matched_by:
            "manual_outreach_link",

          prospect_id:
            prospect
              ?.id ||
            null,

          contact_id:
            contact
              ?.id ||
            null,
        },
      },
    };

  const brief =
    await generateReferralMeetingBrief({
      meeting:
        nextMeeting,

      prospect,

      contact,
    });

  const updated =
    await supabaseUpdate<ReferralMeeting>(
      "pi_referral_meetings",
      {
        id:
          eq(
            meeting.id
          ),
      },
      {
        referral_prospect_id:
          nextMeeting
            .referral_prospect_id,

        organization_name:
          nextMeeting
            .organization_name,

        website:
          nextMeeting
            .website,

        invitee_phone:
          nextMeeting
            .invitee_phone,

        practice_areas:
          nextMeeting
            .practice_areas,

        source_payload:
          nextMeeting
            .source_payload,

        brief,

        updated_at:
          new Date()
            .toISOString(),
      }
    );

  if (
    prospect?.id
  ) {
    await supabaseUpdate(
      "pi_referral_prospects",
      {
        id:
          eq(
            prospect.id
          ),
      },
      {
        relationship_status:
          "meeting",

        next_follow_up_at:
          meeting.start_at,

        updated_at:
          new Date()
            .toISOString(),
      }
    );
  }

  return updated[0] || null;
}

export async function unlinkMeetingOutreach(
  meetingId: string
) {
  const rows =
    await supabaseSelect<ReferralMeeting>(
      "pi_referral_meetings",
      {
        select:
          "*",
        id:
          eq(
            meetingId
          ),
        limit:
          1,
      }
    );

  const meeting =
    rows[0] ||
    null;

  if (!meeting) {
    throw new Error(
      "Referral meeting not found."
    );
  }

  const source =
    asObject(
      meeting
        .source_payload
    );

  const {
    outreach_link:
      _discardedOutreachLink,
    ...remainingSource
  } =
    source;

  const updated =
    await supabaseUpdate<ReferralMeeting>(
      "pi_referral_meetings",
      {
        id:
          eq(
            meetingId
          ),
      },
      {
        source_payload:
          remainingSource,

        updated_at:
          new Date()
            .toISOString(),
      }
    );

  return updated[0] || null;
}


export async function regenerateMeetingBrief(
  meetingId:
    string
) {
  const rows =
    await supabaseSelect<ReferralMeeting>(
      "pi_referral_meetings",
      {
        select:
          "*",
        id:
          eq(
            meetingId
          ),
        limit:
          1,
      }
    );

  const meeting =
    rows[0] || null;

  if (!meeting) {
    throw new Error(
      "Referral meeting not found."
    );
  }

  const prospect =
    meeting
      .referral_prospect_id
      ? await getProspectById(
          meeting
            .referral_prospect_id
        )
      : null;

  let contact:
    Contact | null =
    null;

  if (
    prospect?.id &&
    meeting
      .invitee_email
  ) {
    const contactRows =
      await supabaseSelect<Contact>(
        "pi_referral_contacts",
        {
          select:
            "*",
          prospect_id:
            eq(
              prospect.id
            ),
          email:
            ilike(
              meeting
                .invitee_email
            ),
          limit:
            1,
        }
      );

    contact =
      contactRows[0] ||
      null;
  }

  const brief =
    await generateReferralMeetingBrief({
      meeting,
      prospect,
      contact,
    });

  const updated =
    await supabaseUpdate<ReferralMeeting>(
      "pi_referral_meetings",
      {
        id:
          eq(
            meetingId
          ),
      },
      {
        brief,
        updated_at:
          new Date()
            .toISOString(),
      }
    );

  return updated[0] || null;
}

export async function recheckMeetingCalendar(
  meetingId:
    string,
  appOrigin:
    string
) {
  const rows =
    await supabaseSelect<ReferralMeeting>(
      "pi_referral_meetings",
      {
        select:
          "*",
        id:
          eq(
            meetingId
          ),
        limit:
          1,
      }
    );

  const meeting =
    rows[0] || null;

  if (!meeting) {
    throw new Error(
      "Referral meeting not found."
    );
  }

  const start =
    new Date(
      meeting.start_at
    );

  const end =
    new Date(
      meeting.end_at
    );

  const busy =
    await getTitanBusyEvents(
      new Date(
        start.getTime() -
        24 *
          60 *
          60 *
          1000
      ),
      new Date(
        end.getTime() +
        3 *
          24 *
          60 *
          60 *
          1000
      )
    );

  const conflicts =
    findTitanConflicts(
      start,
      end,
      busy
    ).filter(
      (event) =>
        clean(
          event.uid
        ) !==
        clean(
          meeting
            .titan_event_uid
        )
    );

  if (
    !conflicts.length
  ) {
    let titanEventUid =
      meeting
        .titan_event_uid ||
      "";

    let titanEventUrl =
      meeting
        .titan_event_url ||
      "";

    if (!titanEventUrl) {
      const result =
        await createTitanCalendarEvent({
          uid:
            `cano-referral-${
              meeting.id
            }@canolawfirm.com`,

          start,
          end,

          summary:
            `Referral Partnership Call - ${
              meeting
                .organization_name ||
              meeting
                .invitee_name
            }`,

          description:
            [
              "Cano Law Firm referral partnership meeting.",
              "",
              `Contact: ${
                meeting
                  .invitee_name
              }`,
              `Email: ${
                meeting
                  .invitee_email
              }`,
              `Firm: ${
                meeting
                  .organization_name
              }`,
              "",
              `PI Floor: ${appOrigin}/personal-injury`,
            ].join("\n"),

          location:
            meeting
              .invitee_phone ||
            "Phone call",
        });

      titanEventUid =
        result.uid;

      titanEventUrl =
        result.eventUrl;
    }

    const updated =
      await supabaseUpdate<ReferralMeeting>(
        "pi_referral_meetings",
        {
          id:
            eq(
              meeting.id
            ),
        },
        {
          status:
            "booked",
          calendar_status:
            "created",
          conflict_detected:
            false,
          conflict_events:
            [],
          alternative_slots:
            [],
          titan_event_uid:
            titanEventUid,
          titan_event_url:
            titanEventUrl,
          updated_at:
            new Date()
              .toISOString(),
        }
      );

    return updated[0] || null;
  }

  const durationMinutes =
    Math.max(
      15,
      Math.round(
        (
          end.getTime() -
          start.getTime()
        ) /
        60000
      )
    );

  const alternatives =
    await availableCalendlySlots({
      eventTypeUri:
        clean(
          meeting
            .calendly_event_type_uri
        ),

      desiredStart:
        start,

      durationMinutes,

      titanBusy:
        busy,
    });

  const email =
    buildConflictEmail({
      inviteeName:
        meeting
          .invitee_name,

      startAt:
        meeting
          .start_at,

      alternativeSlots:
        alternatives,
    });

  const updated =
    await supabaseUpdate<ReferralMeeting>(
      "pi_referral_meetings",
      {
        id:
          eq(
            meeting.id
          ),
      },
      {
        status:
          "conflict",
        calendar_status:
          "conflict",
        conflict_detected:
          true,
        conflict_events:
          conflicts,
        alternative_slots:
          alternatives,
        conflict_email_subject:
          email.subject,
        conflict_email_body:
          email.body,
        updated_at:
          new Date()
            .toISOString(),
      }
    );

  return updated[0] || null;
}

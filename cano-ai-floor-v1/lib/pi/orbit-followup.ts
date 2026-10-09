import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "../supabase/rest";

import {
  fetchRecentTitanInbox,
  getTitanInboxStatus,
  type TitanInboxMessage,
} from "../email/titan-inbox";

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

function lower(
  value: unknown
) {
  return clean(
    value
  ).toLowerCase();
}

function eq(
  value: string
) {
  return `eq.${value}`;
}

function asObject(
  value: unknown
): Record<string, any> {
  return value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
      ? value as Record<string, any>
      : {};
}

function normalizeMessageId(
  value: unknown
) {
  return clean(
    value
  )
    .replace(
      /^<|>$/g,
      ""
    )
    .toLowerCase();
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

type ReferralMeeting = {
  id: string;
  referral_prospect_id?: string | null;
  invitee_email?: string;
  start_at?: string;
  end_at?: string;
  status?: string;
  organization_name?: string;
};

function eventDeliveryMessageId(
  event:
    OutreachEvent
) {
  const metadata =
    asObject(
      event.metadata
    );

  const delivery =
    asObject(
      metadata.delivery
    );

  return normalizeMessageId(
    delivery.message_id ||
    metadata.message_id
  );
}

function eventRecipient(
  event:
    OutreachEvent
) {
  const metadata =
    asObject(
      event.metadata
    );

  const delivery =
    asObject(
      metadata.delivery
    );

  return lower(
    metadata
      .recipient_email ||
    delivery.recipient
  );
}

function firstSender(
  message:
    TitanInboxMessage
) {
  return lower(
    message.from?.[0]
      ?.address
  );
}

function inboundMessageId(
  event:
    OutreachEvent
) {
  return normalizeMessageId(
    asObject(
      event.metadata
    )
      .message_id
  );
}

function latestTime(
  event:
    OutreachEvent
) {
  return new Date(
    event.occurred_at ||
    event.created_at ||
    0
  ).getTime();
}

function isSentEmail(
  event:
    OutreachEvent
) {
  return (
    lower(
      event.channel
    ) ===
      "email" &&
    lower(
      event.direction
    ) !==
      "inbound" &&
    lower(
      event.status
    ) ===
      "sent"
  );
}

function isInboundReply(
  event:
    OutreachEvent
) {
  return (
    lower(
      event.channel
    ) ===
      "email" &&
    lower(
      event.direction
    ) ===
      "inbound"
  );
}

function matchingOutbound(
  message:
    TitanInboxMessage,
  sent:
    OutreachEvent[]
) {
  const referenceIds =
    new Set(
      [
        message.inReplyTo,
        ...message.references,
      ]
        .map(
          normalizeMessageId
        )
        .filter(
          Boolean
        )
    );

  if (
    referenceIds.size
  ) {
    const headerMatch =
      sent
        .filter(
          (event) =>
            referenceIds.has(
              eventDeliveryMessageId(
                event
              )
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            latestTime(
              b
            ) -
            latestTime(
              a
            )
        )[0];

    if (headerMatch) {
      return {
        event:
          headerMatch,
        matchedBy:
          "email_thread_headers",
      };
    }
  }

  const sender =
    firstSender(
      message
    );

  if (sender) {
    const emailMatch =
      sent
        .filter(
          (event) =>
            eventRecipient(
              event
            ) ===
            sender
        )
        .sort(
          (
            a,
            b
          ) =>
            latestTime(
              b
            ) -
            latestTime(
              a
            )
        )[0];

    if (emailMatch) {
      return {
        event:
          emailMatch,
        matchedBy:
          "sender_email",
      };
    }
  }

  return {
    event:
      null,
    matchedBy:
      "unmatched",
  };
}

function classifyReply(
  text: string
) {
  const value =
    lower(text);

  if (
    /\b(remove|unsubscribe|do not contact|don't contact|stop emailing)\b/i.test(
      value
    )
  ) {
    return {
      intent:
        "do_not_contact",
      priority:
        "high",
      needsResponse:
        false,
      recommendedAction:
        "Do not send another outreach email. Mark the prospect as do-not-contact and retain this reply as the reason.",
    };
  }

  if (
    /\b(not interested|no thanks|no thank you|pass|not a fit)\b/i.test(
      value
    )
  ) {
    return {
      intent:
        "not_interested",
      priority:
        "normal",
      needsResponse:
        true,
      recommendedAction:
        "Send a brief courteous acknowledgment, then stop the active follow-up sequence unless the attorney requests otherwise.",
    };
  }

  if (
    /\b(booked|scheduled|calendly|calendar|meeting|call works|that time works)\b/i.test(
      value
    )
  ) {
    return {
      intent:
        "meeting_or_scheduling",
      priority:
        "high",
      needsResponse:
        true,
      recommendedAction:
        "Check Orbit/Calendly for a booked meeting. If no meeting exists, reply with the booking link or coordinate the requested time.",
    };
  }

  if (
    /\b(interested|sounds good|happy to|let's talk|lets talk|connect|open to|would love)\b/i.test(
      value
    )
  ) {
    return {
      intent:
        "positive_interest",
      priority:
        "high",
      needsResponse:
        true,
      recommendedAction:
        "Reply promptly, acknowledge the interest, and move toward a 15-minute referral partnership call.",
    };
  }

  if (
    /\b(who are you|what is this|more information|tell me more|how does|what kind)\b/i.test(
      value
    )
  ) {
    return {
      intent:
        "question",
      priority:
        "high",
      needsResponse:
        true,
      recommendedAction:
        "Answer the question directly using verified Cano and Scout context, then offer the 15-minute call without over-selling.",
    };
  }

  return {
    intent:
      "general_reply",
    priority:
      "normal",
    needsResponse:
      true,
    recommendedAction:
      "Review the reply in context and prepare a concise human follow-up from Erik's perspective.",
  };
}

export async function syncTitanReferralInbox() {
  const status =
    getTitanInboxStatus();

  if (!status.configured) {
    throw new Error(
      "Titan inbox tracking is not configured."
    );
  }

  const [
    inbox,
    outreach,
  ] =
    await Promise.all([
      fetchRecentTitanInbox({
        days:
          14,
        limit:
          150,
      }),

      supabaseSelect<OutreachEvent>(
        "pi_outreach_events",
        {
          select:
            "*",
          order:
            "created_at.desc",
          limit:
            1000,
        }
      ),
    ]);

  const sent =
    outreach.filter(
      isSentEmail
    );

  const existingInboundIds =
    new Set(
      outreach
        .filter(
          isInboundReply
        )
        .map(
          inboundMessageId
        )
        .filter(
          Boolean
        )
    );

  const ownMailbox =
    lower(
      status.user
    );

  const inserted: any[] =
    [];

  const ignored: any[] =
    [];

  for (
    const message of
    inbox
  ) {
    const messageId =
      normalizeMessageId(
        message.messageId
      );

    const sender =
      firstSender(
        message
      );

    if (
      !messageId ||
      !sender ||
      sender ===
        ownMailbox ||
      existingInboundIds.has(
        messageId
      )
    ) {
      continue;
    }

    const match =
      matchingOutbound(
        message,
        sent
      );

    if (
      !match.event
    ) {
      ignored.push({
        message_id:
          messageId,
        from:
          sender,
        subject:
          message.subject,
        reason:
          "No sent Reach email matched this Titan message.",
      });
      continue;
    }

    const classification =
      classifyReply(
        message.text
      );

    const now =
      new Date()
        .toISOString();

    const rows =
      await supabaseInsert<OutreachEvent>(
        "pi_outreach_events",
        {
          referral_prospect_id:
            match.event
              .referral_prospect_id ||
            null,

          channel:
            "email",

          direction:
            "inbound",

          status:
            classification
              .needsResponse
              ? "replied"
              : "resolved",

          subject:
            clean(
              message.subject
            ),

          message_summary:
            clean(
              message.text
            )
              .slice(
                0,
                1800
              ),

          occurred_at:
            message.date,

          next_follow_up_at:
            classification
              .needsResponse
              ? now
              : null,

          metadata: {
            agent:
              "orbit",

            source:
              "titan_imap",

            provider:
              "titan_mail",

            message_id:
              messageId,

            imap_uid:
              message.uid,

            in_reply_to:
              message.inReplyTo,

            references:
              message.references,

            from:
              message.from,

            to:
              message.to,

            cc:
              message.cc,

            reply_to:
              message.replyTo,

            body:
              message.text,

            parent_outreach_event_id:
              match.event
                .id,

            matched_by:
              match.matchedBy,

            original_recipient:
              eventRecipient(
                match.event
              ),

            orbit: {
              intent:
                classification
                  .intent,

              priority:
                classification
                  .priority,

              needs_response:
                classification
                  .needsResponse,

              recommended_action:
                classification
                  .recommendedAction,

              response_draft_status:
                classification
                  .needsResponse
                  ? "not_started"
                  : "not_needed",

              reviewed:
                false,
            },
          },
        }
      );

    const inbound =
      rows[0] ||
      null;

    if (inbound) {
      inserted.push(
        inbound
      );

      existingInboundIds.add(
        messageId
      );
    }

    if (
      clean(
        match.event
          .referral_prospect_id
      )
    ) {
      const prospectPatch:
        Record<string, any> = {
          relationship_status:
            classification
              .intent ===
                "not_interested" ||
              classification
                .intent ===
                "do_not_contact"
              ? "not_fit"
              : "replied",

          updated_at:
            now,
        };

      await supabaseUpdate(
        "pi_referral_prospects",
        {
          id:
            eq(
              clean(
                match.event
                  .referral_prospect_id
              )
            ),
        },
        prospectPatch
      );
    }
  }

  return {
    ok:
      true,

    provider:
      "titan_mail",

    scanned:
      inbox.length,

    matched_replies:
      inserted.length,

    unmatched:
      ignored.length,

    inserted,

    ignored:
      ignored.slice(
        0,
        20
      ),
  };
}

function daysSince(
  value: string
) {
  const time =
    new Date(
      value
    ).getTime();

  if (
    !Number.isFinite(
      time
    )
  ) {
    return 0;
  }

  return Math.floor(
    (
      Date.now() -
      time
    ) /
    (
      24 *
      60 *
      60 *
      1000
    )
  );
}

export async function getOrbitFollowUpDashboard() {
  const [
    outreach,
    prospects,
    meetings,
  ] =
    await Promise.all([
      supabaseSelect<OutreachEvent>(
        "pi_outreach_events",
        {
          select:
            "*",
          order:
            "created_at.desc",
          limit:
            1000,
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

      supabaseSelect<ReferralMeeting>(
        "pi_referral_meetings",
        {
          select:
            "*",
          order:
            "start_at.desc",
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

  const sent =
    outreach.filter(
      isSentEmail
    );

  const inbound =
    outreach
      .filter(
        isInboundReply
      )
      .sort(
        (
          a,
          b
        ) =>
          latestTime(
            b
          ) -
          latestTime(
            a
          )
      );

  const replies =
    inbound.map(
      (event) => {
        const metadata =
          asObject(
            event.metadata
          );

        const orbit =
          asObject(
            metadata.orbit
          );

        const from =
          Array.isArray(
            metadata.from
          )
            ? metadata
                .from[0]
            : null;

        const prospect =
          prospectMap.get(
            clean(
              event
                .referral_prospect_id
            )
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
            ),

          contact_name:
            clean(
              from?.name
            ),

          contact_email:
            clean(
              from?.address
            ),

          subject:
            clean(
              event.subject
            ),

          body:
            clean(
              metadata.body ||
              event
                .message_summary
            ),

          received_at:
            clean(
              event.occurred_at ||
              event.created_at
            ),

          intent:
            clean(
              orbit.intent
            ) ||
            "general_reply",

          priority:
            clean(
              orbit.priority
            ) ||
            "normal",

          needs_response:
            orbit
              .needs_response !==
            false,

          recommended_action:
            clean(
              orbit
                .recommended_action
            ),

          response_draft_status:
            clean(
              orbit
                .response_draft_status
            ) ||
            "not_started",

          parent_outreach_event_id:
            clean(
              metadata
                .parent_outreach_event_id
            ),

          status:
            clean(
              event.status
            ),
        };
      }
    );

  const activeMeetingsByProspect =
    new Set(
      meetings
        .filter(
          (row) =>
            lower(
              row.status
            ) !==
            "canceled"
        )
        .map(
          (row) =>
            clean(
              row
                .referral_prospect_id
            )
        )
        .filter(
          Boolean
        )
    );

  const inboundByProspect =
    new Map<
      string,
      OutreachEvent[]
    >();

  for (
    const row of
    inbound
  ) {
    const id =
      clean(
        row
          .referral_prospect_id
      );

    if (!id) {
      continue;
    }

    const rows =
      inboundByProspect.get(
        id
      ) ||
      [];

    rows.push(
      row
    );

    inboundByProspect.set(
      id,
      rows
    );
  }

  const latestSentByProspect =
    new Map<
      string,
      OutreachEvent
    >();

  for (
    const row of
    sent
  ) {
    const id =
      clean(
        row
          .referral_prospect_id
      );

    if (!id) {
      continue;
    }

    const current =
      latestSentByProspect.get(
        id
      );

    if (
      !current ||
      latestTime(
        row
      ) >
      latestTime(
        current
      )
    ) {
      latestSentByProspect.set(
        id,
        row
      );
    }
  }

  const followUps =
    Array.from(
      latestSentByProspect
        .entries()
    )
      .map(
        (
          [
            prospectId,
            outbound,
          ]
        ) => {
          const prospect =
            prospectMap.get(
              prospectId
            );

          const sentAt =
            clean(
              outbound
                .occurred_at ||
              outbound
                .created_at
            );

          const hasReplyAfter =
            (
              inboundByProspect.get(
                prospectId
              ) ||
              []
            ).some(
              (row) =>
                latestTime(
                  row
                ) >
                latestTime(
                  outbound
                )
            );

          const meetingBooked =
            activeMeetingsByProspect.has(
              prospectId
            );

          const ageDays =
            daysSince(
              sentAt
            );

          const metadata =
            asObject(
              outbound.metadata
            );

          return {
            prospect_id:
              prospectId,

            organization_name:
              clean(
                prospect
                  ?.organization_name
              ),

            recipient_email:
              lower(
                metadata
                  .recipient_email ||
                asObject(
                  metadata.delivery
                )
                  .recipient
              ),

            subject:
              clean(
                outbound.subject
              ),

            sent_at:
              sentAt,

            days_waiting:
              ageDays,

            has_reply:
              hasReplyAfter,

            meeting_booked:
              meetingBooked,

            follow_up_due:
              !hasReplyAfter &&
              !meetingBooked &&
              ageDays >= 3,

            outreach_event_id:
              outbound.id,
          };
        }
      )
      .filter(
        (row) =>
          !row.has_reply &&
          !row.meeting_booked
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            b.follow_up_due
          ) -
          Number(
            a.follow_up_due
          ) ||
          b.days_waiting -
          a.days_waiting
      );

  return {
    ok:
      true,

    integrations: {
      titan_inbox:
        getTitanInboxStatus(),
    },

    counts: {
      replies:
        replies.length,

      needs_response:
        replies.filter(
          (row) =>
            row
              .needs_response &&
            lower(
              row.status
            ) !==
              "resolved"
        ).length,

      follow_up_due:
        followUps.filter(
          (row) =>
            row
              .follow_up_due
        ).length,

      waiting:
        followUps.length,
    },

    replies,

    follow_ups:
      followUps,
  };
}

export async function updateOrbitReply(input: {
  replyId: string;
  action:
    | "mark_resolved"
    | "reopen";
}) {
  const rows =
    await supabaseSelect<OutreachEvent>(
      "pi_outreach_events",
      {
        select:
          "*",
        id:
          eq(
            input.replyId
          ),
        limit:
          1,
      }
    );

  const reply =
    rows[0] ||
    null;

  if (!reply) {
    throw new Error(
      "Orbit reply not found."
    );
  }

  const metadata =
    asObject(
      reply.metadata
    );

  const orbit =
    asObject(
      metadata.orbit
    );

  const resolved =
    input.action ===
      "mark_resolved";

  const updated =
    await supabaseUpdate<OutreachEvent>(
      "pi_outreach_events",
      {
        id:
          eq(
            reply.id
          ),
      },
      {
        status:
          resolved
            ? "resolved"
            : "replied",

        next_follow_up_at:
          resolved
            ? null
            : new Date()
                .toISOString(),

        metadata: {
          ...metadata,
          orbit: {
            ...orbit,
            needs_response:
              !resolved,
            reviewed:
              resolved,
            reviewed_at:
              resolved
                ? new Date()
                    .toISOString()
                : null,
          },
        },
      }
    );

  return updated[0] ||
    null;
}

export async function buildOrbitReplyRequest(
  replyId: string
) {
  const rows =
    await supabaseSelect<OutreachEvent>(
      "pi_outreach_events",
      {
        select:
          "*",
        id:
          eq(
            replyId
          ),
        limit:
          1,
      }
    );

  const reply =
    rows[0] ||
    null;

  if (!reply) {
    throw new Error(
      "Orbit reply not found."
    );
  }

  const metadata =
    asObject(
      reply.metadata
    );

  const parentId =
    clean(
      metadata
        .parent_outreach_event_id
    );

  const parentRows =
    parentId
      ? await supabaseSelect<OutreachEvent>(
          "pi_outreach_events",
          {
            select:
              "*",
            id:
              eq(
                parentId
              ),
            limit:
              1,
          }
        )
      : [];

  const prospectRows =
    clean(
      reply
        .referral_prospect_id
    )
      ? await supabaseSelect<Prospect>(
          "pi_referral_prospects",
          {
            select:
              "*",
            id:
              eq(
                clean(
                  reply
                    .referral_prospect_id
                )
              ),
            limit:
              1,
          }
        )
      : [];

  return {
    reply,
    original_outreach:
      parentRows[0] ||
      null,
    prospect:
      prospectRows[0] ||
      null,
  };
}

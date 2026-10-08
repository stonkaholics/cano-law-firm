import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "../../../../../lib/supabase/rest";

import {
  buildCanoReferralEmail,
} from "../../../../../lib/email/cano-referral-email";

import {
  sendTitanMail,
} from "../../../../../lib/email/titan-mail";

type OutreachEvent = {
  id: string;
  referral_prospect_id?: string | null;
  status?: string;
  subject?: string;
  message_summary?: string;
  approved_by?: string;
  approved_at?: string | null;
  occurred_at?: string | null;
  metadata?: Record<string, any>;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const outreachEventId =
      clean(
        body?.outreachEventId ||
        body?.outreach_event_id
      );

    const mode =
      clean(body?.mode)
        .toLowerCase() ===
      "test"
        ? "test"
        : "send";

    const testTo =
      clean(
        body?.testTo ||
        body?.test_to
      );

    if (!outreachEventId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "outreachEventId is required.",
        },
        { status: 400 }
      );
    }

    const rows =
      await supabaseSelect<OutreachEvent>(
        "pi_outreach_events",
        {
          select: "*",
          id:
            `eq.${outreachEventId}`,
          limit: 1,
        }
      );

    const draft =
      rows[0] || null;

    if (!draft) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Reach draft not found.",
        },
        { status: 404 }
      );
    }

    const status =
      clean(
        draft.status
      ).toLowerCase();

    if (status !== "approved") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only a human-approved Reach draft can be sent through Titan Mail.",
        },
        { status: 409 }
      );
    }

    const realRecipient =
      clean(
        draft.metadata
          ?.recipient_email
      );

    const recipient =
      mode === "test"
        ? testTo
        : realRecipient;

    if (
      !recipient ||
      !isEmail(recipient)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            mode === "test"
              ? "Enter a valid test recipient email."
              : "The approved Reach draft does not contain a valid recipient email.",
        },
        { status: 400 }
      );
    }

    const draftBody =
      clean(
        draft.metadata?.body ||
        draft.message_summary
      );

    if (!draftBody) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The Reach draft does not contain a full email body.",
        },
        { status: 409 }
      );
    }

    const email =
      buildCanoReferralEmail({
        subject:
          clean(
            draft.subject
          ) ||
          "Introduction from Cano Law Firm",

        body:
          draftBody,
      });

    const delivery =
      await sendTitanMail({
        to:
          recipient,

        subject:
          mode === "test"
            ? `[TEST] ${email.subject}`
            : email.subject,

        html:
          email.html,

        text:
          email.text,

        replyTo:
          "contact@canolawfirm.com",
      });

    const now =
      new Date().toISOString();

    if (mode === "test") {
      await supabaseInsert(
        "pi_compliance_reviews",
        {
          review_type:
            "professional_referral_outreach_test_send",

          subject_type:
            "outreach_event",

          subject_id:
            outreachEventId,

          status:
            "test_sent",

          notes:
            `Titan Mail test sent to ${recipient}.`,

          reviewed_by:
            "Cano Law Firm Human Reviewer",

          reviewed_at:
            now,

          metadata: {
            agent:
              "reach",

            provider:
              "titan_mail",

            sender:
              delivery.sender,

            recipient,

            message_id:
              delivery.messageId,

            official_send:
              false,
          },
        }
      );

      return NextResponse.json({
        ok: true,
        mode,
        recipient,
        sender:
          delivery.sender,
        messageId:
          delivery.messageId,
      });
    }

    const metadata = {
      ...(draft.metadata &&
      typeof draft.metadata ===
        "object"
        ? draft.metadata
        : {}),

      send_status:
        "sent",

      delivery: {
        provider:
          "titan_mail",

        sender:
          delivery.sender,

        recipient:
          realRecipient,

        message_id:
          delivery.messageId,

        sent_at:
          now,

        response:
          delivery.response,
      },

      orbit_handoff: {
        status:
          "ready",

        created_at:
          now,

        provider:
          "titan_mail",

        message_id:
          delivery.messageId,
      },
    };

    const updated =
      await supabaseUpdate(
        "pi_outreach_events",
        {
          id:
            `eq.${outreachEventId}`,
        },
        {
          status:
            "sent",

          occurred_at:
            now,

          metadata,
        }
      );

    if (
      clean(
        draft.referral_prospect_id
      )
    ) {
      await supabaseUpdate(
        "pi_referral_prospects",
        {
          id:
            `eq.${draft.referral_prospect_id}`,
        },
        {
          relationship_status:
            "contacted",
        }
      );
    }

    await supabaseInsert(
      "pi_compliance_reviews",
      {
        review_type:
          "professional_referral_outreach_send",

        subject_type:
          "outreach_event",

        subject_id:
          outreachEventId,

        status:
          "sent",

        notes:
          `Human-approved Reach email sent through Titan Mail to ${realRecipient}.`,

        reviewed_by:
          "Cano Law Firm Human Reviewer",

        reviewed_at:
          now,

        metadata: {
          agent:
            "reach",

          provider:
            "titan_mail",

          sender:
            delivery.sender,

          recipient:
            realRecipient,

          message_id:
            delivery.messageId,

          official_send:
            true,

          orbit_handoff:
            "ready",
        },
      }
    );

    return NextResponse.json({
      ok: true,
      mode,
      recipient:
        realRecipient,
      sender:
        delivery.sender,
      messageId:
        delivery.messageId,
      row:
        updated[0] || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send Reach outreach through Titan Mail.",
      },
      { status: 500 }
    );
  }
}

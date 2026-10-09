import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  saveCadenceDraft,
} from "../../../../../../lib/pi/orbit-cadence";

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
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

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request:
    NextRequest
) {
  try {
    const expected =
      clean(
        process.env
          .N8N_SHARED_SECRET
      );

    const supplied =
      clean(
        request.headers.get(
          "x-cano-secret"
        )
      );

    if (
      expected &&
      expected !==
        supplied
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Unauthorized.",
        },
        {
          status:
            401,
        }
      );
    }

    const body =
      await request.json();

    const output =
      asObject(
        body?.output ||
        body?.result ||
        body
      );

    const cadence =
      asObject(
        body?.cadence ||
        output?.cadence
      );

    const prospectId =
      clean(
        body
          ?.prospect_id ||
        body
          ?.prospectId ||
        cadence
          .prospect_id ||
        output
          ?.prospect_id ||
        output
          ?.prospectId
      );

    const recipientEmail =
      clean(
        body
          ?.recipient_email ||
        cadence
          .recipient_email ||
        output
          ?.recipient_email
      );

    const recipientName =
      clean(
        body
          ?.recipient_name ||
        cadence
          .recipient_name ||
        output
          ?.recipient_name
      );

    const subject =
      clean(
        output
          ?.subject ||
        output
          ?.draft_subject
      );

    const draftBody =
      clean(
        output
          ?.body ||
        output
          ?.draft_body ||
        output
          ?.email_body ||
        output
          ?.message
      );

    const followUpNumber =
      Number(
        body
          ?.followup_number ||
        cadence
          .followup_number ||
        output
          ?.followup_number ||
        0
      );

    const contactRotation =
      Boolean(
        body
          ?.contact_rotation ||
        cadence
          .contact_rotation ||
        output
          ?.contact_rotation
      );

    if (
      !prospectId ||
      !recipientEmail ||
      !subject ||
      !draftBody
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Orbit cadence callback requires prospect_id, recipient_email, subject, and body.",
        },
        {
          status:
            400,
        }
      );
    }

    const draft =
      await saveCadenceDraft({
        prospectId,

        recipientName,

        recipientEmail,

        subject,

        body:
          draftBody,

        followUpNumber,

        originalOutreachEventId:
          clean(
            cadence
              .original_outreach_event_id
          ),

        latestOutreachEventId:
          clean(
            cadence
              .latest_outreach_event_id
          ),

        inReplyTo:
          clean(
            cadence
              .in_reply_to
          ),

        references:
          Array.isArray(
            cadence
              .references
          )
            ? cadence
                .references
            : [],

        rationale:
          clean(
            output
              ?.rationale
          ),

        recommendedNextStep:
          clean(
            output
              ?.recommended_next_step
          ),

        contactRotation,
      });

    return NextResponse.json({
      ok:
        true,

      draft,
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unable to save Orbit cadence draft.",
      },
      {
        status:
          500,
      }
    );
  }
}

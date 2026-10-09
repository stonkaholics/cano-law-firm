import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "../../../../../../lib/supabase/rest";

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
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

type OutreachEvent = {
  id: string;
  referral_prospect_id?: string | null;
  subject?: string;
  metadata?: Record<string, any>;
};

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request:
    NextRequest
) {
  try {
    const secret =
      clean(
        request.headers.get(
          "x-cano-secret"
        )
      );

    const expected =
      clean(
        process.env
          .N8N_SHARED_SECRET
      );

    if (
      expected &&
      secret !==
        expected
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

    const replyId =
      clean(
        body?.replyId ||
        body?.reply_id ||
        output
          ?.reply_id ||
        output
          ?.replyId
      );

    if (!replyId) {
      return NextResponse.json(
        {
          ok:
            false,
          error:
            "Orbit callback is missing reply_id.",
        },
        {
          status:
            400,
        }
      );
    }

    const replyRows =
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
      replyRows[0] ||
      null;

    if (!reply) {
      return NextResponse.json(
        {
          ok:
            false,
          error:
            "Inbound Orbit reply not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const subject =
      clean(
        output
          ?.subject ||
        output
          ?.draft_subject
      ) ||
      (
        /^re:/i.test(
          clean(
            reply.subject
          )
        )
          ? clean(
              reply.subject
            )
          : `Re: ${clean(
              reply.subject
            )}`
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

    if (!draftBody) {
      throw new Error(
        "Orbit returned no draft email body."
      );
    }

    const replyMetadata =
      asObject(
        reply.metadata
      );

    const from =
      Array.isArray(
        replyMetadata.from
      )
        ? replyMetadata
            .from[0]
        : null;

    const now =
      new Date()
        .toISOString();

    const draftRows =
      await supabaseInsert(
        "pi_outreach_events",
        {
          referral_prospect_id:
            reply
              .referral_prospect_id ||
            null,

          channel:
            "email",

          direction:
            "outbound",

          status:
            "draft",

          subject,

          message_summary:
            draftBody,

          created_at:
            now,

          metadata: {
            agent:
              "reach",

            drafted_by:
              "orbit",

            mode:
              "referral_reply_followup",

            body:
              draftBody,

            recipient_name:
              clean(
                from?.name
              ),

            recipient_email:
              clean(
                from?.address
              ),

            parent_inbound_event_id:
              reply.id,

            thread_parent_outreach_event_id:
              clean(
                replyMetadata
                  .parent_outreach_event_id
              ),

            in_reply_to:
              clean(
                replyMetadata
                  .message_id
              ),

            references:
              [
                ...(
                  Array.isArray(
                    replyMetadata
                      .references
                  )
                    ? replyMetadata
                        .references
                    : []
                ),
                clean(
                  replyMetadata
                    .message_id
                ),
              ]
                .map(
                  clean
                )
                .filter(
                  Boolean
                ),

            orbit_review: {
              status:
                "drafted",

              human_approval_required:
                true,

              guard_review_required:
                true,

              intent:
                clean(
                  output
                    ?.intent
                ),

              rationale:
                clean(
                  output
                    ?.rationale
                ),

              recommended_next_step:
                clean(
                  output
                    ?.recommended_next_step
                ),
            },
          },
        }
      );

    const orbit =
      asObject(
        replyMetadata.orbit
      );

    await supabaseUpdate(
      "pi_outreach_events",
      {
        id:
          eq(
            reply.id
          ),
      },
      {
        metadata: {
          ...replyMetadata,

          orbit: {
            ...orbit,

            response_draft_status:
              "drafted",

            response_draft_id:
              draftRows[0]
                ?.id ||
              null,

            drafted_at:
              now,
          },
        },
      }
    );

    return NextResponse.json({
      ok:
        true,

      draft:
        draftRows[0] ||
        null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unable to save Orbit reply draft.",
      },
      {
        status:
          500,
      }
    );
  }
}

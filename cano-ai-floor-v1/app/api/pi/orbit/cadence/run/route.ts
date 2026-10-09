import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildNoResponseFollowUpContext,
  closeLoopAndRotateContact,
  getOrbitCadenceDashboard,
  markCadencePreparationRequested,
} from "../../../../../../lib/pi/orbit-cadence";

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

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

function messageIdFromEvent(
  row: any
) {
  const metadata =
    asObject(
      row?.metadata
    );

  const delivery =
    asObject(
      metadata.delivery
    );

  return clean(
    delivery.message_id ||
    metadata.message_id
  );
}

async function requestOrbitDraft(input: {
  request:
    NextRequest;
  prospectId: string;
  followUpNumber: number;
}) {
  const context =
    await buildNoResponseFollowUpContext({
      prospectId:
        input.prospectId,

      followUpNumber:
        input.followUpNumber,
    });

  const callbackUrl =
    new URL(
      "/api/pi/orbit/cadence/callback",
      input.request
        .nextUrl
        .origin
    ).toString();

  const payload = {
    action:
      "run_pi_agent",

    floor:
      "personal_injury",

    workflowVersion:
      "pi_growth_v8",

    agentId:
      "orbit",

    request: {
      mode:
        "draft_referral_no_response_followup",

      followUpNumber:
        input.followUpNumber,

      maxFollowUps:
        3,

      prospect:
        context.prospect,

      contact:
        context.contact,

      initialOutreach:
        context.initialOutreach,

      latestOutreach:
        context.latestOutreach,

      outreachHistory:
        context.outreachHistory,

      recipientEmail:
        context.recipientEmail,

      recipientName:
        context.recipientName,

      senderProfile: {
        name:
          "Erik Quisenberry",

        title:
          "Chief Operating Officer",

        firm:
          "Cano Law Firm, P.A.",

        email:
          "contact@canolawfirm.com",

        bookingUrl:
          "https://canolawfirm.com/book/",
      },

      policy: {
        humanApprovalRequired:
          true,

        guardReviewRequired:
          true,

        sendEmail:
          false,

        humanTone:
          true,

        noAiLanguage:
          true,

        noEmDash:
          true,

        doNotInvent:
          true,

        noReferralPromise:
          true,

        noFeeDiscussionUnlessAttorneyRequests:
          true,

        instruction:
          "Prepare the next no-response follow-up email only. It must feel like Erik personally sent a short follow-up in the existing thread. Follow-up 1 is a light bump. Follow-up 2 should add one concrete reason the referral relationship could be useful without repeating the introduction. Follow-up 3 is a courteous final touch that closes the loop without pressure. Do not send anything.",
      },
    },

    callbackUrl,

    cadence: {
      prospect_id:
        input
          .prospectId,

      followup_number:
        input
          .followUpNumber,

      original_outreach_event_id:
        context
          .initialOutreach
          ?.id ||
        "",

      latest_outreach_event_id:
        context
          .latestOutreach
          ?.id ||
        "",

      recipient_email:
        context
          .recipientEmail,

      recipient_name:
        context
          .recipientName,

      in_reply_to:
        context
          .inReplyTo,

      references:
        [
          messageIdFromEvent(
            context
              .initialOutreach
          ),
          messageIdFromEvent(
            context
              .latestOutreach
          ),
        ]
          .filter(
            Boolean
          ),
    },

    requestedAt:
      new Date()
        .toISOString(),

    source: {
      application:
        "cano_ai_floor",

      floor:
        "02",

      route:
        "/api/pi/orbit/cadence/run",
    },
  };

  const response =
    await fetch(
      PI_N8N_WEBHOOK,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...(process.env
            .N8N_SHARED_SECRET
            ? {
                "x-cano-secret":
                  process.env
                    .N8N_SHARED_SECRET,
              }
            : {}),
        },

        body:
          JSON.stringify(
            payload
          ),

        cache:
          "no-store",
      }
    );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Orbit cadence could not submit follow-up ${input.followUpNumber} to n8n (${response.status}): ${
        responseText ||
        response.statusText
      }`
    );
  }

  await markCadencePreparationRequested({
    latestOutreachEventId:
      context
        .latestOutreach
        .id,

    followUpNumber:
      input
        .followUpNumber,
  });

  return {
    prospect_id:
      input
        .prospectId,

    followup_number:
      input
        .followUpNumber,

    recipient:
      context
        .recipientEmail,
  };
}

async function requestRotationDraft(input: {
  request:
    NextRequest;
  prospectId: string;
  nextContact: any;
}) {
  const callbackUrl =
    new URL(
      "/api/pi/orbit/cadence/callback",
      input.request
        .nextUrl
        .origin
    ).toString();

  const payload = {
    action:
      "run_pi_agent",

    floor:
      "personal_injury",

    workflowVersion:
      "pi_growth_v8",

    agentId:
      "orbit",

    request: {
      mode:
        "draft_referral_new_contact_after_close_loop",

      prospectId:
        input
          .prospectId,

      contact:
        input
          .nextContact,

      senderProfile: {
        name:
          "Erik Quisenberry",

        title:
          "Chief Operating Officer",

        firm:
          "Cano Law Firm, P.A.",

        email:
          "contact@canolawfirm.com",

        bookingUrl:
          "https://canolawfirm.com/book/",
      },

      policy: {
        humanApprovalRequired:
          true,

        guardReviewRequired:
          true,

        sendEmail:
          false,

        humanTone:
          true,

        noAiLanguage:
          true,

        noEmDash:
          true,

        doNotInvent:
          true,

        instruction:
          "The prior contact at this same firm did not respond after the full follow-up sequence. Prepare a fresh first-touch email to this different contact. Do not mention the failed sequence, do not imply anyone ignored us, and do not send the message.",
      },
    },

    callbackUrl,

    cadence: {
      prospect_id:
        input
          .prospectId,

      followup_number:
        0,

      contact_rotation:
        true,

      recipient_email:
        clean(
          input
            .nextContact
            ?.email
        ),

      recipient_name:
        clean(
          input
            .nextContact
            ?.name
        ),
    },

    requestedAt:
      new Date()
        .toISOString(),

    source: {
      application:
        "cano_ai_floor",

      floor:
        "02",

      route:
        "/api/pi/orbit/cadence/run",
    },
  };

  const response =
    await fetch(
      PI_N8N_WEBHOOK,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...(process.env
            .N8N_SHARED_SECRET
            ? {
                "x-cano-secret":
                  process.env
                    .N8N_SHARED_SECRET,
              }
            : {}),
        },

        body:
          JSON.stringify(
            payload
          ),

        cache:
          "no-store",
      }
    );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Orbit could not prepare the next-contact draft (${response.status}): ${
        responseText ||
        response.statusText
      }`
    );
  }

  return {
    prospect_id:
      input
        .prospectId,

    rotated_to:
      clean(
        input
          .nextContact
          ?.email
      ),
  };
}

async function run(
  request:
    NextRequest
) {
  try {
    const dashboard =
      await getOrbitCadenceDashboard();

    const prepared: any[] =
      [];

    const closed: any[] =
      [];

    const errors: any[] =
      [];

    for (
      const row of
      dashboard.sequences
    ) {
      if (
        row.should_prepare
      ) {
        try {
          prepared.push(
            await requestOrbitDraft({
              request,

              prospectId:
                row.prospect_id,

              followUpNumber:
                row
                  .next_followup_number,
            })
          );
        } catch (
          error
        ) {
          errors.push({
            prospect_id:
              row
                .prospect_id,

            stage:
              "prepare_followup",

            error:
              error instanceof
              Error
                ? error.message
                : "Unknown follow-up preparation error.",
          });
        }

        continue;
      }

      if (
        row.should_close
      ) {
        try {
          const rotation =
            await closeLoopAndRotateContact(
              row
                .prospect_id
            );

          const result: any = {
            prospect_id:
              row
                .prospect_id,

            organization_name:
              row
                .organization_name,

            rotated:
              rotation
                .rotated,

            prior_contact:
              rotation
                .currentContact
                ?.email ||
              row
                .recipient_email,

            next_contact:
              rotation
                .nextContact
                ?.email ||
              null,
          };

          if (
            rotation
              .rotated &&
            rotation
              .nextContact
          ) {
            try {
              result
                .rotation_draft_requested =
                await requestRotationDraft({
                  request,

                  prospectId:
                    row
                      .prospect_id,

                  nextContact:
                    rotation
                      .nextContact,
                });
            } catch (
              error
            ) {
              result
                .rotation_draft_error =
                error instanceof
                Error
                  ? error.message
                  : "Unable to prepare next-contact draft.";
            }
          }

          closed.push(
            result
          );
        } catch (
          error
        ) {
          errors.push({
            prospect_id:
              row
                .prospect_id,

            stage:
              "close_loop",

            error:
              error instanceof
              Error
                ? error.message
                : "Unknown close-loop error.",
          });
        }
      }
    }

    return NextResponse.json({
      ok:
        errors.length ===
        0,

      config:
        dashboard.config,

      checked:
        dashboard
          .sequences
          .length,

      prepared:
        prepared.length,

      closed:
        closed.length,

      prepared_rows:
        prepared,

      closed_rows:
        closed,

      errors,
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
            : "Orbit cadence run failed.",
      },
      {
        status:
          500,
      }
    );
  }
}

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  request:
    NextRequest
) {
  return run(
    request
  );
}

export async function POST(
  request:
    NextRequest
) {
  return run(
    request
  );
}

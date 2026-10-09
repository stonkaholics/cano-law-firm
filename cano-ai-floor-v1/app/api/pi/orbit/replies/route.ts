import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildOrbitReplyRequest,
  getOrbitFollowUpDashboard,
  updateOrbitReply,
} from "../../../../../lib/pi/orbit-followup";

const PI_N8N_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/cano-pi-agent";

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      await getOrbitFollowUpDashboard()
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok:
          false,
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to load Orbit follow-up queue.",
      },
      {
        status:
          500,
      }
    );
  }
}

export async function POST(
  request:
    NextRequest
) {
  try {
    const body =
      await request.json();

    const action =
      clean(
        body?.action
      );

    const replyId =
      clean(
        body?.reply_id ||
        body?.replyId
      );

    if (
      action ===
        "mark_resolved" ||
      action ===
        "reopen"
    ) {
      if (!replyId) {
        return NextResponse.json(
          {
            ok:
              false,
            error:
              "reply_id is required.",
          },
          {
            status:
              400,
          }
        );
      }

      const row =
        await updateOrbitReply({
          replyId,
          action,
        });

      return NextResponse.json({
        ok:
          true,
        row,
      });
    }

    if (
      action ===
      "draft_reply"
    ) {
      if (!replyId) {
        return NextResponse.json(
          {
            ok:
              false,
            error:
              "reply_id is required.",
          },
          {
            status:
              400,
          }
        );
      }

      const context =
        await buildOrbitReplyRequest(
          replyId
        );

      const callbackUrl =
        new URL(
          "/api/pi/orbit/replies/callback",
          request.nextUrl.origin
        ).toString();

      const payload = {
        action:
          "run_pi_agent",

        floor:
          "personal_injury",

        workflowVersion:
          "pi_growth_v7",

        agentId:
          "orbit",

        request: {
          mode:
            "draft_referral_reply",

          inboundReply:
            context.reply,

          originalOutreach:
            context
              .original_outreach,

          prospect:
            context
              .prospect,

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
              "Draft only the next human email reply from Erik. Answer what the recipient actually said, preserve the existing thread context, and move toward an appropriate next step. Do not send it.",
          },
        },

        callbackUrl,

        requestedAt:
          new Date()
            .toISOString(),

        source: {
          application:
            "cano_ai_floor",

          floor:
            "02",

          route:
            "/api/pi/orbit/replies",
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

      const text =
        await response.text();

      if (!response.ok) {
        throw new Error(
          `Orbit n8n workflow could not accept the reply drafting request (${response.status}): ${
            text ||
            response.statusText
          }`
        );
      }

      return NextResponse.json(
        {
          ok:
            true,
          accepted:
            true,
          replyId,
          callbackUrl,
        },
        {
          status:
            202,
        }
      );
    }

    return NextResponse.json(
      {
        ok:
          false,
        error:
          `Unsupported Orbit reply action: ${action}`,
      },
      {
        status:
          400,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok:
          false,
        error:
          error instanceof
          Error
            ? error.message
            : "Orbit reply action failed.",
      },
      {
        status:
          500,
      }
    );
  }
}

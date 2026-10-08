import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCalendlyInvitee,
  getCalendlyScheduledEvent,
} from "../../../../../../lib/calendly/client";

import {
  processCalendlyBooking,
  processCalendlyCancellation,
} from "../../../../../../lib/pi/referral-meetings";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

function authorized(
  request:
    NextRequest
) {
  const expected =
    clean(
      process.env
        .CALENDLY_WEBHOOK_SECRET
    );

  if (!expected) {
    return true;
  }

  const supplied =
    clean(
      request
        .nextUrl
        .searchParams
        .get("secret")
    );

  return (
    supplied &&
    supplied ===
      expected
  );
}

export async function POST(
  request:
    NextRequest
) {
  try {
    if (
      !authorized(
        request
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unauthorized Calendly webhook.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const eventName =
      clean(
        body?.event
      );

    const payload =
      body?.payload || {};

    const eventUri =
      clean(
        payload?.event
      );

    const inviteeUri =
      clean(
        payload?.uri
      );

    if (
      !eventUri ||
      !inviteeUri
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Calendly webhook is missing event or invitee URI.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      eventName ===
      "invitee.canceled"
    ) {
      const meeting =
        await processCalendlyCancellation({
          inviteeUri,
          rawPayload:
            body,
        });

      return NextResponse.json({
        ok: true,
        action:
          "canceled",
        meeting,
      });
    }

    if (
      eventName !==
      "invitee.created"
    ) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        event:
          eventName,
      });
    }

    const [
      event,
      invitee,
    ] =
      await Promise.all([
        getCalendlyScheduledEvent(
          eventUri
        ),
        getCalendlyInvitee(
          inviteeUri
        ),
      ]);

    const expectedEventType =
      clean(
        process.env
          .CALENDLY_REFERRAL_EVENT_TYPE_URI
      );

    if (
      expectedEventType &&
      clean(
        event?.event_type
      ) !==
        expectedEventType
    ) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason:
          "Not the configured Cano referral event type.",
        event_type:
          clean(
            event?.event_type
          ),
      });
    }

    const meeting =
      await processCalendlyBooking({
        eventUri,
        inviteeUri,
        event,
        invitee,
        rawPayload:
          body,
        appOrigin:
          request
            .nextUrl
            .origin,
      });

    return NextResponse.json({
      ok: true,
      action:
        "booked",
      meeting,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process Calendly referral meeting.",
      },
      {
        status: 500,
      }
    );
  }
}

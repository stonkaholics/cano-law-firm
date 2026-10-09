import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getCalendlyCurrentUser,
  listCalendlyEventInvitees,
  listCalendlyScheduledEvents,
} from "../../../../../../lib/calendly/client";

import {
  processCalendlyBooking,
} from "../../../../../../lib/pi/referral-meetings";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

function addDays(
  date: Date,
  days: number
) {
  return new Date(
    date.getTime() +
      days *
        24 *
        60 *
        60 *
        1000
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const user =
      await getCalendlyCurrentUser();

    const userUri =
      clean(
        user?.uri
      );

    if (!userUri) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Calendly current user URI is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const now =
      new Date();

    /*
    |--------------------------------------------------------------------------
    | RECOVERY WINDOW
    |--------------------------------------------------------------------------
    |
    | Includes yesterday so an event booked before the webhook was registered
    | can still be recovered into Orbit on the next manual/open-workstation sync.
    |--------------------------------------------------------------------------
    */

    const minStart =
      addDays(
        now,
        -1
      );

    const maxStart =
      addDays(
        now,
        120
      );

    const events =
      await listCalendlyScheduledEvents({
        userUri,
        minStartTime:
          minStart.toISOString(),
        maxStartTime:
          maxStart.toISOString(),
      });

    const configuredEventType =
      clean(
        process.env
          .CALENDLY_REFERRAL_EVENT_TYPE_URI
      );

    const candidateEvents =
      events.filter(
        (event: any) => {
          const eventTypeUri =
            clean(
              event?.event_type
            );

          if (
            configuredEventType
          ) {
            return (
              eventTypeUri ===
              configuredEventType
            );
          }

          /*
          | If the env var has not been filled yet, use the event's actual name
          | as a safe temporary fallback so the first referral booking can still
          | be recovered. Once the URI is configured, only that event type runs.
          */

          return /referral|partnership/i.test(
            clean(
              event?.name
            )
          );
        }
      );

    const results:
      any[] = [];

    for (
      const event of
      candidateEvents
    ) {
      const eventUri =
        clean(
          event?.uri
        );

      if (!eventUri) {
        continue;
      }

      const invitees =
        await listCalendlyEventInvitees(
          eventUri
        );

      for (
        const invitee of
        invitees
      ) {
        const inviteeUri =
          clean(
            invitee?.uri
          );

        if (
          !inviteeUri ||
          clean(
            invitee?.status
          ).toLowerCase() ===
            "canceled"
        ) {
          continue;
        }

        try {
          const meeting =
            await processCalendlyBooking({
              eventUri,
              inviteeUri,
              event,
              invitee,
              rawPayload: {
                event:
                  "manual.sync",
                payload: {
                  event:
                    eventUri,
                  uri:
                    inviteeUri,
                },
                recovery:
                  true,
              },
              appOrigin:
                request
                  .nextUrl
                  .origin,
            });

          results.push({
            ok: true,
            event_uri:
              eventUri,
            invitee_uri:
              inviteeUri,
            meeting_id:
              meeting?.id ||
              null,
            status:
              meeting?.status ||
              null,
            calendar_status:
              meeting
                ?.calendar_status ||
              null,
          });
        } catch (
          error
        ) {
          results.push({
            ok: false,
            event_uri:
              eventUri,
            invitee_uri:
              inviteeUri,
            error:
              error instanceof
              Error
                ? error.message
                : "Unknown sync error.",
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      recovered:
        results.filter(
          (row) =>
            row.ok
        ).length,
      failed:
        results.filter(
          (row) =>
            !row.ok
        ).length,
      scanned_events:
        events.length,
      candidate_events:
        candidateEvents.length,
      configured_event_type_uri:
        configuredEventType ||
        null,
      used_name_fallback:
        !configuredEventType,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof
          Error
            ? error.message
            : "Unable to sync Calendly referral meetings.",
      },
      {
        status: 500,
      }
    );
  }
}

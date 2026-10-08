import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTitanBusyEvents,
  getTitanCalendarConfig,
  verifyTitanCalendar,
} from "../../../../../../lib/calendar/titan-caldav";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  request:
    NextRequest
) {
  const config =
    getTitanCalendarConfig();

  if (
    !config.configured
  ) {
    return NextResponse.json(
      {
        ok: false,
        configured:
          false,
        ...config,
        required: [
          "TITAN_CALDAV_USERNAME",
          "TITAN_CALDAV_PASSWORD",
          "TITAN_CALDAV_CALENDAR_URL",
        ],
      },
      {
        status: 503,
      }
    );
  }

  const verify =
    await verifyTitanCalendar();

  if (!verify.ok) {
    return NextResponse.json(
      verify,
      {
        status: 502,
      }
    );
  }

  if (
    request
      .nextUrl
      .searchParams
      .get("busy") !==
    "1"
  ) {
    return NextResponse.json(
      verify
    );
  }

  try {
    const start =
      new Date();

    const end =
      new Date(
        start.getTime() +
        7 *
          24 *
          60 *
          60 *
          1000
      );

    const events =
      await getTitanBusyEvents(
        start,
        end
      );

    return NextResponse.json({
      ...verify,
      busy_count:
        events.length,
      window: {
        start:
          start.toISOString(),
        end:
          end.toISOString(),
      },
      events,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ...verify,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to read Titan busy times.",
      },
      {
        status: 502,
      }
    );
  }
}

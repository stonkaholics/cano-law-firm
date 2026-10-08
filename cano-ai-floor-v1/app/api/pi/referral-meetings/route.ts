import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseSelect,
} from "../../../../lib/supabase/rest";

import {
  calendlyConfigured,
} from "../../../../lib/calendly/client";

import {
  getTitanCalendarConfig,
} from "../../../../lib/calendar/titan-caldav";

import {
  createConflictReachDraft,
  regenerateMeetingBrief,
  recheckMeetingCalendar,
  type ReferralMeeting,
} from "../../../../lib/pi/referral-meetings";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function GET() {
  try {
    const rows =
      await supabaseSelect<ReferralMeeting>(
        "pi_referral_meetings",
        {
          select:
            "*",
          order:
            "start_at.asc",
          limit:
            250,
        }
      );

    const now =
      Date.now();

    const upcoming =
      rows.filter(
        (row) =>
          clean(
            row.status
          ) !==
            "canceled" &&
          new Date(
            row.end_at
          ).getTime() >=
            now -
              24 *
                60 *
                60 *
                1000
      );

    return NextResponse.json({
      ok: true,
      meetings:
        upcoming,
      counts: {
        total:
          upcoming.length,
        conflicts:
          upcoming.filter(
            (row) =>
              row
                .conflict_detected
          ).length,
        booked:
          upcoming.filter(
            (row) =>
              clean(
                row.status
              ) ===
              "booked"
          ).length,
      },
      integrations: {
        calendly:
          calendlyConfigured(),
        titan:
          getTitanCalendarConfig()
            .configured,
        meeting_brief_ai:
          Boolean(
            clean(
              process.env
                .N8N_PI_REFERRAL_MEETING_BRIEF_WEBHOOK
            )
          ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load referral meetings.",
      },
      {
        status: 500,
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

    const meetingId =
      clean(
        body?.meeting_id ||
        body?.meetingId
      );

    if (!meetingId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "meeting_id is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      action ===
      "regenerate_brief"
    ) {
      const meeting =
        await regenerateMeetingBrief(
          meetingId
        );

      return NextResponse.json({
        ok: true,
        meeting,
      });
    }

    if (
      action ===
      "recheck_calendar"
    ) {
      const meeting =
        await recheckMeetingCalendar(
          meetingId,
          request
            .nextUrl
            .origin
        );

      return NextResponse.json({
        ok: true,
        meeting,
      });
    }

    if (
      action ===
      "create_conflict_reach_draft"
    ) {
      const rows =
        await supabaseSelect<ReferralMeeting>(
          "pi_referral_meetings",
          {
            select:
              "*",
            id:
              `eq.${meetingId}`,
            limit:
              1,
          }
        );

      const meeting =
        rows[0] ||
        null;

      if (!meeting) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Referral meeting not found.",
          },
          {
            status: 404,
          }
        );
      }

      const result =
        await createConflictReachDraft(
          meeting
        );

      return NextResponse.json({
        ok: true,
        result,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          `Unsupported referral meeting action: ${action}`,
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update referral meeting.",
      },
      {
        status: 500,
      }
    );
  }
}

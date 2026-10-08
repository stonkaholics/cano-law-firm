import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  calendlyConfigured,
  createCalendlyWebhookSubscription,
  getCalendlyCurrentUser,
  listCalendlyEventTypes,
  listCalendlyWebhookSubscriptions,
} from "../../../../../../lib/calendly/client";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

async function context(
  request:
    NextRequest
) {
  if (
    !calendlyConfigured()
  ) {
    return {
      ok: false,
      configured:
        false,
      error:
        "CALENDLY_ACCESS_TOKEN is not configured.",
    };
  }

  const user =
    await getCalendlyCurrentUser();

  const organizationUri =
    clean(
      user
        ?.current_organization
    );

  const userUri =
    clean(
      user?.uri
    );

  const eventTypes =
    userUri
      ? await listCalendlyEventTypes(
          userUri
        )
      : [];

  let subscriptions:
    any[] = [];

  if (
    organizationUri
  ) {
    try {
      subscriptions =
        await listCalendlyWebhookSubscriptions(
          organizationUri,
          userUri
        );
    } catch {
      subscriptions =
        [];
    }
  }

  const webhookUrl =
    new URL(
      "/api/pi/referral-meetings/calendly/webhook",
      request.nextUrl.origin
    );

  const webhookSecret =
    clean(
      process.env
        .CALENDLY_WEBHOOK_SECRET
    );

  if (webhookSecret) {
    webhookUrl.searchParams.set(
      "secret",
      webhookSecret
    );
  }

  const configuredEventType =
    clean(
      process.env
        .CALENDLY_REFERRAL_EVENT_TYPE_URI
    );

  const suggested =
    eventTypes.find(
      (row: any) =>
        /referral|partnership/i.test(
          clean(
            row?.name
          )
        )
    ) ||
    eventTypes.find(
      (row: any) =>
        Number(
          row?.duration || 0
        ) === 15
    ) ||
    null;

  return {
    ok: true,
    configured:
      true,
    user: {
      uri:
        userUri,
      name:
        clean(
          user?.name
        ),
      email:
        clean(
          user?.email
        ),
      scheduling_url:
        clean(
          user
            ?.scheduling_url
        ),
    },
    organization_uri:
      organizationUri,
    webhook_url:
      webhookUrl.toString(),
    configured_event_type_uri:
      configuredEventType,
    suggested_event_type_uri:
      clean(
        suggested?.uri
      ),
    event_types:
      eventTypes.map(
        (row: any) => ({
          uri:
            clean(
              row?.uri
            ),
          name:
            clean(
              row?.name
            ),
          slug:
            clean(
              row?.slug
            ),
          duration:
            Number(
              row?.duration ||
              0
            ),
          scheduling_url:
            clean(
              row
                ?.scheduling_url
            ),
          active:
            row?.active !==
            false,
        })
      ),
    subscriptions:
      subscriptions.map(
        (row: any) => ({
          uri:
            clean(
              row?.uri
            ),
          url:
            clean(
              row?.callback_url ||
              row?.url
            ),
          state:
            clean(
              row?.state
            ),
          scope:
            clean(
              row?.scope
            ),
          events:
            Array.isArray(
              row?.events
            )
              ? row.events
              : [],
        })
      ),
  };
}

export async function GET(
  request:
    NextRequest
) {
  try {
    return NextResponse.json(
      await context(
        request
      )
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Calendly setup.",
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
    const current =
      await context(
        request
      );

    if (!current.ok) {
      return NextResponse.json(
        current,
        {
          status: 400,
        }
      );
    }

    const organizationUri =
      clean(
        current
          .organization_uri
      );

    const userUri =
      clean(
        current
          .user
          ?.uri
      );

    if (
      !organizationUri ||
      !userUri
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Calendly user or organization URI is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const callbackUrl =
      clean(
        current
          .webhook_url
      );

    const existing =
      Array.isArray(
        current
          .subscriptions
      )
        ? current
            .subscriptions
            .find(
              (row: any) =>
                clean(
                  row?.url
                ) ===
                  callbackUrl
            )
        : null;

    if (existing) {
      return NextResponse.json({
        ok: true,
        existing: true,
        subscription:
          existing,
        setup:
          current,
      });
    }

    const scope =
      clean(
        process.env
          .CALENDLY_WEBHOOK_SCOPE
      ) ===
      "organization"
        ? "organization"
        : "user";

    const created =
      await createCalendlyWebhookSubscription({
        url:
          callbackUrl,
        organization:
          organizationUri,
        user:
          userUri,
        scope,
      });

    return NextResponse.json({
      ok: true,
      created: true,
      subscription:
        created,
      setup:
        current,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Calendly webhook subscription.",
      },
      {
        status: 500,
      }
    );
  }
}

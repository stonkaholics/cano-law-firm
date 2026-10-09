const CALENDLY_API =
  "https://api.calendly.com";

function clean(value: unknown) {
  return String(value || "").trim();
}

function token() {
  const value =
    clean(
      process.env.CALENDLY_ACCESS_TOKEN
    );

  if (!value) {
    throw new Error(
      "Missing CALENDLY_ACCESS_TOKEN."
    );
  }

  return value;
}

export function calendlyConfigured() {
  return Boolean(
    clean(
      process.env.CALENDLY_ACCESS_TOKEN
    )
  );
}

export async function calendlyFetch<T = any>(
  pathOrUrl: string,
  init: RequestInit = {}
): Promise<T> {
  const url =
    /^https?:\/\//i.test(pathOrUrl)
      ? pathOrUrl
      : `${CALENDLY_API}${
          pathOrUrl.startsWith("/")
            ? ""
            : "/"
        }${pathOrUrl}`;

  const response =
    await fetch(
      url,
      {
        ...init,
        headers: {
          Authorization:
            `Bearer ${token()}`,
          "Content-Type":
            "application/json",
          ...(init.headers || {}),
        },
        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  let data: any = null;

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.title ||
      data?.details ||
      text ||
      response.statusText;

    throw new Error(
      `Calendly API ${response.status}: ${message}`
    );
  }

  return data as T;
}

export async function getCalendlyCurrentUser() {
  const data =
    await calendlyFetch<any>(
      "/users/me"
    );

  return data?.resource || null;
}

export async function listCalendlyEventTypes(
  userUri: string
) {
  const params =
    new URLSearchParams({
      user: userUri,
      active: "true",
      count: "100",
    });

  const data =
    await calendlyFetch<any>(
      `/event_types?${params.toString()}`
    );

  return Array.isArray(
    data?.collection
  )
    ? data.collection
    : [];
}

export async function listCalendlyWebhookSubscriptions(
  organizationUri: string,
  userUri?: string
) {
  const params =
    new URLSearchParams({
      organization:
        organizationUri,
      scope:
        userUri
          ? "user"
          : "organization",
      count:
        "100",
    });

  if (userUri) {
    params.set(
      "user",
      userUri
    );
  }

  const data =
    await calendlyFetch<any>(
      `/webhook_subscriptions?${params.toString()}`
    );

  return Array.isArray(
    data?.collection
  )
    ? data.collection
    : [];
}

export async function createCalendlyWebhookSubscription(input: {
  url: string;
  organization: string;
  user?: string;
  scope: "user" | "organization";
}) {
  const body: Record<string, any> = {
    url:
      input.url,

    events: [
      "invitee.created",
      "invitee.canceled",
    ],

    organization:
      input.organization,

    scope:
      input.scope,
  };

  if (
    input.scope === "user" &&
    input.user
  ) {
    body.user =
      input.user;
  }

  const data =
    await calendlyFetch<any>(
      "/webhook_subscriptions",
      {
        method: "POST",
        body:
          JSON.stringify(body),
      }
    );

  return data?.resource || data;
}

export async function getCalendlyScheduledEvent(
  eventUri: string
) {
  const data =
    await calendlyFetch<any>(
      eventUri
    );

  return data?.resource || data;
}

export async function getCalendlyInvitee(
  inviteeUri: string
) {
  const data =
    await calendlyFetch<any>(
      inviteeUri
    );

  return data?.resource || data;
}

export async function getCalendlyAvailableTimes(input: {
  eventTypeUri: string;
  startTime: string;
  endTime: string;
}) {
  const params =
    new URLSearchParams({
      event_type:
        input.eventTypeUri,
      start_time:
        input.startTime,
      end_time:
        input.endTime,
    });

  const data =
    await calendlyFetch<any>(
      `/event_type_available_times?${params.toString()}`
    );

  return Array.isArray(
    data?.collection
  )
    ? data.collection
    : [];
}


export async function listCalendlyScheduledEvents(input: {
  userUri: string;
  minStartTime: string;
  maxStartTime: string;
}) {
  const params =
    new URLSearchParams({
      user:
        input.userUri,
      status:
        "active",
      min_start_time:
        input.minStartTime,
      max_start_time:
        input.maxStartTime,
      count:
        "100",
      sort:
        "start_time:asc",
    });

  const data =
    await calendlyFetch<any>(
      `/scheduled_events?${params.toString()}`
    );

  return Array.isArray(
    data?.collection
  )
    ? data.collection
    : [];
}

export async function listCalendlyEventInvitees(
  eventUri: string
) {
  const eventId =
    clean(eventUri)
      .split("/")
      .filter(Boolean)
      .pop();

  if (!eventId) {
    return [];
  }

  const data =
    await calendlyFetch<any>(
      `/scheduled_events/${encodeURIComponent(
        eventId
      )}/invitees?count=100`
    );

  return Array.isArray(
    data?.collection
  )
    ? data.collection
    : [];
}

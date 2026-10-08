function clean(value: unknown) {
  return String(value || "").trim();
}

function ensureSlash(value: string) {
  return value.endsWith("/")
    ? value
    : `${value}/`;
}

function authHeader() {
  const username =
    clean(
      process.env.TITAN_CALDAV_USERNAME
    );

  const password =
    clean(
      process.env.TITAN_CALDAV_PASSWORD
    );

  if (
    !username ||
    !password
  ) {
    throw new Error(
      "Missing TITAN_CALDAV_USERNAME or TITAN_CALDAV_PASSWORD."
    );
  }

  return (
    "Basic " +
    Buffer.from(
      `${username}:${password}`
    ).toString("base64")
  );
}

export function getTitanCalendarConfig() {
  const calendarUrl =
    clean(
      process.env.TITAN_CALDAV_CALENDAR_URL
    );

  const username =
    clean(
      process.env.TITAN_CALDAV_USERNAME
    );

  return {
    configured:
      Boolean(
        calendarUrl &&
        username &&
        clean(
          process.env.TITAN_CALDAV_PASSWORD
        )
      ),

    calendarUrl,
    username,
    server:
      clean(
        process.env.TITAN_CALDAV_SERVER
      ) ||
      "https://dav.titan.email",

    timezone:
      clean(
        process.env.TITAN_CALENDAR_TIMEZONE
      ) ||
      "America/New_York",
  };
}

function toCalDavUtc(
  value: Date
) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function unfoldIcs(value: string) {
  return value
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .replace(/\r\n/g, "\n");
}

function getTimeZoneOffsetMs(
  date: Date,
  timeZone: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        hour:
          "2-digit",
        minute:
          "2-digit",
        second:
          "2-digit",
        hourCycle:
          "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const map =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !==
            "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  const asUtc =
    Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second)
    );

  return (
    asUtc -
    date.getTime()
  );
}

function zonedLocalToUtc(
  raw:
    string,
  timeZone:
    string
) {
  const match =
    raw.match(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/
    );

  if (!match) {
    return null;
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
  ] = match;

  const naive =
    new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      )
    );

  const firstOffset =
    getTimeZoneOffsetMs(
      naive,
      timeZone
    );

  const adjusted =
    new Date(
      naive.getTime() -
      firstOffset
    );

  const secondOffset =
    getTimeZoneOffsetMs(
      adjusted,
      timeZone
    );

  return new Date(
    naive.getTime() -
    secondOffset
  );
}

function parseIcsDateLine(
  line:
    string,
  fallbackTimeZone:
    string
) {
  const colon =
    line.indexOf(":");

  if (colon < 0) {
    return null;
  }

  const params =
    line.slice(
      0,
      colon
    );

  const raw =
    line.slice(
      colon + 1
    ).trim();

  if (
    /^\d{8}T\d{6}Z$/.test(
      raw
    )
  ) {
    const match =
      raw.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
      );

    if (!match) {
      return null;
    }

    return new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6])
      )
    );
  }

  const tzMatch =
    params.match(
      /TZID=([^;:]+)/i
    );

  return zonedLocalToUtc(
    raw,
    clean(
      tzMatch?.[1]
    ) ||
      fallbackTimeZone
  );
}

function extractTagValues(
  xml:
    string,
  tag:
    string
) {
  const pattern =
    new RegExp(
      `<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`,
      "gi"
    );

  return Array.from(
    xml.matchAll(pattern)
  ).map(
    (match) =>
      decodeXml(
        match[1] || ""
      )
  );
}

export type TitanBusyEvent = {
  uid: string;
  summary: string;
  start: string;
  end: string;
  href?: string;
};

function parseCalendarData(
  calendarData:
    string,
  fallbackTimeZone:
    string
): TitanBusyEvent[] {
  const ics =
    unfoldIcs(
      calendarData
    );

  const blocks =
    ics.match(
      /BEGIN:VEVENT[\s\S]*?END:VEVENT/g
    ) || [];

  const events:
    TitanBusyEvent[] = [];

  for (
    const block of blocks
  ) {
    const lines =
      block.split("\n");

    const startLine =
      lines.find(
        (line) =>
          line.startsWith(
            "DTSTART"
          )
      );

    const endLine =
      lines.find(
        (line) =>
          line.startsWith(
            "DTEND"
          )
      );

    const start =
      startLine
        ? parseIcsDateLine(
            startLine,
            fallbackTimeZone
          )
        : null;

    const end =
      endLine
        ? parseIcsDateLine(
            endLine,
            fallbackTimeZone
          )
        : null;

    if (
      !start ||
      !end
    ) {
      continue;
    }

    const uid =
      (
        lines.find(
          (line) =>
            line.startsWith(
              "UID:"
            )
        ) || ""
      ).slice(4);

    const summary =
      (
        lines.find(
          (line) =>
            line.startsWith(
              "SUMMARY:"
            )
        ) || ""
      ).slice(8);

    const status =
      (
        lines.find(
          (line) =>
            line.startsWith(
              "STATUS:"
            )
        ) || ""
      )
        .slice(7)
        .toUpperCase();

    if (
      status ===
      "CANCELLED"
    ) {
      continue;
    }

    events.push({
      uid,
      summary,
      start:
        start.toISOString(),
      end:
        end.toISOString(),
    });
  }

  return events;
}

export async function titanCalendarRequest(
  url: string,
  init: RequestInit
) {
  const response =
    await fetch(
      url,
      {
        ...init,
        headers: {
          Authorization:
            authHeader(),
          ...(init.headers || {}),
        },
        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Titan CalDAV ${response.status}: ${
        text ||
        response.statusText
      }`
    );
  }

  return {
    response,
    text,
  };
}

export async function verifyTitanCalendar() {
  const config =
    getTitanCalendarConfig();

  if (
    !config.configured
  ) {
    return {
      ok: false,
      configured:
        false,
      error:
        "Titan CalDAV is not fully configured.",
      ...config,
    };
  }

  try {
    const result =
      await titanCalendarRequest(
        config.calendarUrl,
        {
          method:
            "PROPFIND",
          headers: {
            Depth:
              "0",
            "Content-Type":
              "application/xml; charset=utf-8",
          },
          body:
            `<?xml version="1.0" encoding="utf-8"?>
             <d:propfind xmlns:d="DAV:">
               <d:prop>
                 <d:displayname/>
                 <d:resourcetype/>
               </d:prop>
             </d:propfind>`,
        }
      );

    return {
      ok: true,
      configured:
        true,
      status:
        result.response.status,
      ...config,
    };
  } catch (error) {
    return {
      ok: false,
      configured:
        true,
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to Titan CalDAV.",
      ...config,
    };
  }
}

export async function getTitanBusyEvents(
  start:
    Date,
  end:
    Date
): Promise<TitanBusyEvent[]> {
  const config =
    getTitanCalendarConfig();

  if (
    !config.configured
  ) {
    throw new Error(
      "Titan CalDAV is not configured."
    );
  }

  const body =
    `<?xml version="1.0" encoding="utf-8"?>
     <c:calendar-query
       xmlns:d="DAV:"
       xmlns:c="urn:ietf:params:xml:ns:caldav"
     >
       <d:prop>
         <d:getetag/>
         <c:calendar-data/>
       </d:prop>
       <c:filter>
         <c:comp-filter name="VCALENDAR">
           <c:comp-filter name="VEVENT">
             <c:time-range
               start="${toCalDavUtc(start)}"
               end="${toCalDavUtc(end)}"
             />
           </c:comp-filter>
         </c:comp-filter>
       </c:filter>
     </c:calendar-query>`;

  const result =
    await titanCalendarRequest(
      config.calendarUrl,
      {
        method:
          "REPORT",

        headers: {
          Depth:
            "1",

          "Content-Type":
            "application/xml; charset=utf-8",
        },

        body,
      }
    );

  const calendarData =
    extractTagValues(
      result.text,
      "calendar-data"
    );

  const hrefs =
    extractTagValues(
      result.text,
      "href"
    );

  const events:
    TitanBusyEvent[] = [];

  calendarData.forEach(
    (
      data,
      index
    ) => {
      for (
        const event of
        parseCalendarData(
          data,
          config.timezone
        )
      ) {
        events.push({
          ...event,
          href:
            hrefs[index] ||
            event.href,
        });
      }
    }
  );

  return events;
}

export function findTitanConflicts(
  start:
    Date,
  end:
    Date,
  events:
    TitanBusyEvent[]
) {
  const startMs =
    start.getTime();

  const endMs =
    end.getTime();

  return events.filter(
    (event) => {
      const eventStart =
        new Date(
          event.start
        ).getTime();

      const eventEnd =
        new Date(
          event.end
        ).getTime();

      return (
        startMs < eventEnd &&
        endMs > eventStart
      );
    }
  );
}

function escapeIcs(
  value:
    unknown
) {
  return clean(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function safeUid(
  value:
    string
) {
  return value
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "-"
    )
    .slice(
      0,
      180
    );
}

export async function createTitanCalendarEvent(input: {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
}) {
  const config =
    getTitanCalendarConfig();

  if (
    !config.configured
  ) {
    throw new Error(
      "Titan CalDAV is not configured."
    );
  }

  const uid =
    safeUid(
      input.uid
    );

  const eventUrl =
    `${ensureSlash(
      config.calendarUrl
    )}${encodeURIComponent(
      uid
    )}.ics`;

  const stamp =
    toCalDavUtc(
      new Date()
    );

  const ics =
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cano Law Firm//Referral Meeting Sync//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toCalDavUtc(
        input.start
      )}`,
      `DTEND:${toCalDavUtc(
        input.end
      )}`,
      `SUMMARY:${escapeIcs(
        input.summary
      )}`,
      `DESCRIPTION:${escapeIcs(
        input.description || ""
      )}`,
      input.location
        ? `LOCATION:${escapeIcs(
            input.location
          )}`
        : "",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ]
      .filter(Boolean)
      .join("\r\n");

  const result =
    await titanCalendarRequest(
      eventUrl,
      {
        method:
          "PUT",
        headers: {
          "Content-Type":
            "text/calendar; charset=utf-8",
        },
        body:
          ics,
      }
    );

  return {
    ok: true,
    uid,
    eventUrl,
    status:
      result.response.status,
  };
}

export async function deleteTitanCalendarEvent(
  eventUrl:
    string
) {
  if (!clean(eventUrl)) {
    return {
      ok: true,
      skipped: true,
    };
  }

  try {
    const result =
      await titanCalendarRequest(
        eventUrl,
        {
          method:
            "DELETE",
        }
      );

    return {
      ok: true,
      status:
        result.response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to delete Titan calendar event.",
    };
  }
}

import fs from "node:fs";
import path from "node:path";

const rel = "lib/pi/referral-meetings.ts";
const file = path.join(process.cwd(), rel);

if (!fs.existsSync(file)) {
  throw new Error(`Missing ${rel}`);
}

let source = fs.readFileSync(file, "utf8");

function replaceRequired(before, after, label) {
  if (source.includes(after)) {
    return;
  }

  if (!source.includes(before)) {
    throw new Error(`Orbit 30-minute patch missing anchor: ${label}`);
  }

  source = source.replace(before, after);
}

/*
|--------------------------------------------------------------------------
| 1. FIX THE CURRENT TYPESCRIPT BUILD ERROR
|--------------------------------------------------------------------------
|
| pi_referral_contacts already uses selected_for_outreach elsewhere in the PI
| app. The local Contact type in referral-meetings.ts simply did not declare it.
|--------------------------------------------------------------------------
*/

replaceRequired(
`  linkedin_url?: string;
  metadata?: Record<string, any>;
};`,
`  linkedin_url?: string;
  selected_for_outreach?: boolean;
  priority?: number;
  metadata?: Record<string, any>;
};`,
"Contact selected_for_outreach type"
);

/*
|--------------------------------------------------------------------------
| 2. SHARED TITAN PROTECTION WINDOW
|--------------------------------------------------------------------------
|
| Calendly stays a 15-minute call. Titan blocks a minimum of 30 minutes so the
| following 15 minutes remain protected if the conversation runs long.
|--------------------------------------------------------------------------
*/

const helperAnchor =
`function arrayStrings(
  value: unknown
) {
  return Array.isArray(value)
    ? value
        .map(clean)
        .filter(Boolean)
    : [];
}`;

const helperReplacement =
`${helperAnchor}

const TITAN_REFERRAL_BLOCK_MINUTES = 30;

function titanReferralEnd(
  start: Date,
  calendlyEnd?: Date
) {
  const protectedEnd =
    new Date(
      start.getTime() +
      TITAN_REFERRAL_BLOCK_MINUTES *
        60 *
        1000
    );

  if (
    calendlyEnd &&
    Number.isFinite(
      calendlyEnd.getTime()
    ) &&
    calendlyEnd.getTime() >
      protectedEnd.getTime()
  ) {
    return calendlyEnd;
  }

  return protectedEnd;
}`;

replaceRequired(
  helperAnchor,
  helperReplacement,
  "Titan 30-minute helper"
);

/*
|--------------------------------------------------------------------------
| 3. AVAILABLE SLOT CONFLICT CHECKS ALSO RESERVE 30 MINUTES
|--------------------------------------------------------------------------
*/

replaceRequired(
`            const slotEnd =
              row?.end_time ||
              row?.endTime
                ? new Date(
                    row.end_time ||
                    row.endTime
                  )
                : new Date(
                    slotStart.getTime() +
                    input.durationMinutes *
                      60000
                  );`,
`            const calendlySlotEnd =
              row?.end_time ||
              row?.endTime
                ? new Date(
                    row.end_time ||
                    row.endTime
                  )
                : new Date(
                    slotStart.getTime() +
                    input.durationMinutes *
                      60000
                  );

            const slotEnd =
              titanReferralEnd(
                slotStart,
                calendlySlotEnd
              );`,
"available Calendly slot protection"
);

/*
|--------------------------------------------------------------------------
| 4. INITIAL CALENDLY → TITAN SYNC
|--------------------------------------------------------------------------
*/

const processStart =
  source.indexOf(
    "export async function processCalendlyBooking("
  );

const processEnd =
  source.indexOf(
    "export async function processCalendlyCancellation(",
    processStart
  );

if (
  processStart < 0 ||
  processEnd < 0
) {
  throw new Error(
    "Orbit 30-minute patch could not locate processCalendlyBooking."
  );
}

let processBlock =
  source.slice(
    processStart,
    processEnd
  );

function replaceInProcess(before, after, label) {
  if (processBlock.includes(after)) {
    return;
  }

  if (!processBlock.includes(before)) {
    throw new Error(
      `Orbit 30-minute patch missing process anchor: ${label}`
    );
  }

  processBlock =
    processBlock.replace(
      before,
      after
    );
}

replaceInProcess(
`  const end =
    new Date(
      fields.endAt
    );`,
`  const end =
    new Date(
      fields.endAt
    );

  const titanEnd =
    titanReferralEnd(
      start,
      end
    );`,
"process titanEnd"
);

replaceInProcess(
`        findTitanConflicts(
          start,
          end,
          busy
        ).filter(`,
`        findTitanConflicts(
          start,
          titanEnd,
          busy
        ).filter(`,
"process conflict uses 30 minutes"
);

replaceInProcess(
`        const durationMinutes =
          Math.max(
            15,
            Math.round(
              (
                end.getTime() -
                start.getTime()
              ) /
              60000
            )
          );`,
`        const durationMinutes =
          Math.max(
            TITAN_REFERRAL_BLOCK_MINUTES,
            Math.round(
              (
                end.getTime() -
                start.getTime()
              ) /
              60000
            )
          );`,
"process alternative slot duration"
);

/*
| Existing Titan events are intentionally PUT again at the same UID/URL.
| CalDAV PUT updates the same .ics resource, so old 15-minute test events become
| 30-minute blocks the next time Orbit syncs.
*/
const oldCreateSection =
`        /*
        | Keep the already-created Titan event on re-sync. This prevents Orbit
        | from duplicating the same Calendly booking each time Sync is pressed.
        */
        if (
          !titanEventUrl
        ) {
          const uid =
            \`cano-referral-\${
              input
                .inviteeUri
                .split("/")
                .pop() ||
              Date.now()
            }@canolawfirm.com\`;

          const eventResult =
            await createTitanCalendarEvent({
              uid,

              start,

              end,`;

const newCreateSection =
`        /*
        | Re-PUT the same Titan UID on every clean re-sync. CalDAV updates the
        | existing .ics resource instead of creating a duplicate. This also
        | upgrades older 15-minute Titan events to the protected 30-minute block.
        */
        {
          const uid =
            clean(
              existingMeeting
                ?.titan_event_uid
            ) ||
            \`cano-referral-\${
              input
                .inviteeUri
                .split("/")
                .pop() ||
              Date.now()
            }@canolawfirm.com\`;

          const eventResult =
            await createTitanCalendarEvent({
              uid,

              start,

              end:
                titanEnd,`;

replaceInProcess(
  oldCreateSection,
  newCreateSection,
  "process Titan upsert"
);

/*
| The old section has one extra closing brace for `if (!titanEventUrl)`.
| Remove only the first exact instance immediately after event URL assignment.
*/
replaceInProcess(
`          titanEventUrl =
            eventResult.eventUrl;
        }

        calendarStatus =
          "created";`,
`          titanEventUrl =
            eventResult.eventUrl;
        }

        calendarStatus =
          "created";`,
"process closing block"
);

source =
  source.slice(
    0,
    processStart
  ) +
  processBlock +
  source.slice(
    processEnd
  );

/*
|--------------------------------------------------------------------------
| 5. RECHECK TITAN CALENDAR ALSO USES / WRITES 30 MINUTES
|--------------------------------------------------------------------------
*/

const recheckStart =
  source.indexOf(
    "export async function recheckMeetingCalendar("
  );

if (recheckStart < 0) {
  throw new Error(
    "Orbit 30-minute patch could not locate recheckMeetingCalendar."
  );
}

let recheckBlock =
  source.slice(
    recheckStart
  );

function replaceInRecheck(before, after, label) {
  if (recheckBlock.includes(after)) {
    return;
  }

  if (!recheckBlock.includes(before)) {
    throw new Error(
      `Orbit 30-minute patch missing recheck anchor: ${label}`
    );
  }

  recheckBlock =
    recheckBlock.replace(
      before,
      after
    );
}

replaceInRecheck(
`  const end =
    new Date(
      meeting.end_at
    );`,
`  const end =
    new Date(
      meeting.end_at
    );

  const titanEnd =
    titanReferralEnd(
      start,
      end
    );`,
"recheck titanEnd"
);

replaceInRecheck(
`    findTitanConflicts(
      start,
      end,
      busy
    ).filter(`,
`    findTitanConflicts(
      start,
      titanEnd,
      busy
    ).filter(`,
"recheck conflicts"
);

replaceInRecheck(
`  const durationMinutes =
    Math.max(
      15,
      Math.round(
        (
          end.getTime() -
          start.getTime()
        ) /
        60000
      )
    );`,
`  const durationMinutes =
    Math.max(
      TITAN_REFERRAL_BLOCK_MINUTES,
      Math.round(
        (
          end.getTime() -
          start.getTime()
        ) /
        60000
      )
    );`,
"recheck alternatives"
);

/*
| Recheck previously skipped writing when titan_event_url already existed.
| Always PUT the same UID so existing events are resized to 30 minutes.
*/
const oldRecheckCreate =
`    if (!titanEventUrl) {
      const result =
        await createTitanCalendarEvent({
          uid:
            \`cano-referral-\${
              meeting.id
            }@canolawfirm.com\`,

          start,
          end,`;

const newRecheckCreate =
`    {
      const result =
        await createTitanCalendarEvent({
          uid:
            clean(
              titanEventUid
            ) ||
            \`cano-referral-\${
              meeting.id
            }@canolawfirm.com\`,

          start,
          end:
            titanEnd,`;

replaceInRecheck(
  oldRecheckCreate,
  newRecheckCreate,
  "recheck Titan upsert"
);

source =
  source.slice(
    0,
    recheckStart
  ) +
  recheckBlock;

fs.writeFileSync(
  file,
  source
);

console.log(
  "Applied Orbit build fix + 30-minute Titan referral hold."
);

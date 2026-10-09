import fs from "node:fs";
import path from "node:path";

const rel =
  "lib/pi/referral-meetings.ts";

const file =
  path.join(
    process.cwd(),
    rel
  );

if (
  !fs.existsSync(
    file
  )
) {
  throw new Error(
    `Missing ${rel}`
  );
}

let source =
  fs.readFileSync(
    file,
    "utf8"
  );

if (
  !source.includes(
    "selected_for_outreach?: boolean;"
  )
) {
  source =
    source.replace(
      "  linkedin_url?: string;",
      `  linkedin_url?: string;
  selected_for_outreach?: boolean;
  priority?: number;`
    );
}

if (
  !source.includes(
    "const TITAN_REFERRAL_BLOCK_MINUTES = 30;"
  )
) {
  const anchor =
`function arrayStrings(
  value: unknown
) {
  return Array.isArray(value)
    ? value
        .map(clean)
        .filter(Boolean)
    : [];
}`;

  if (
    source.includes(
      anchor
    )
  ) {
    source =
      source.replace(
        anchor,
`${anchor}

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
}`
      );
  }
}

/*
| Apply the minimum 30-minute hold with conservative replacements.
| These replacements are idempotent and do not alter Calendly's own 15-minute
| start/end stored in Supabase.
*/

source =
  source.replace(
`        findTitanConflicts(
          start,
          end,
          busy
        ).filter(`,
`        findTitanConflicts(
          start,
          titanReferralEnd(
            start,
            end
          ),
          busy
        ).filter(`
  );

source =
  source.replace(
`    findTitanConflicts(
      start,
      end,
      busy
    ).filter(`,
`    findTitanConflicts(
      start,
      titanReferralEnd(
        start,
        end
      ),
      busy
    ).filter(`
  );

source =
  source.replace(
`              start,

              end,

              summary:`,
`              start,

              end:
                titanReferralEnd(
                  start,
                  end
                ),

              summary:`
  );

source =
  source.replace(
`          start,
          end,

          summary:`,
`          start,
          end:
            titanReferralEnd(
              start,
              end
            ),

          summary:`
  );

source =
  source.replace(
`          Math.max(
            15,
            Math.round(`,
`          Math.max(
            TITAN_REFERRAL_BLOCK_MINUTES,
            Math.round(`
  );

source =
  source.replace(
`    Math.max(
      15,
      Math.round(`,
`    Math.max(
      TITAN_REFERRAL_BLOCK_MINUTES,
      Math.round(`
  );

fs.writeFileSync(
  file,
  source
);

console.log(
  "Applied Orbit TypeScript fix + 30-minute Titan protection."
);

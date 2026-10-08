import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const pagePath =
  path.join(
    root,
    "app/personal-injury/page.tsx"
  );

if (
  !fs.existsSync(
    pagePath
  )
) {
  throw new Error(
    `PI page not found: ${pagePath}`
  );
}

let source =
  fs.readFileSync(
    pagePath,
    "utf8"
  );

const importLine =
  'import ReferralMeetingWorkstation from "./ReferralMeetingWorkstation";';

if (
  !source.includes(
    importLine
  )
) {
  const anchor =
    'import styles from "./personal-injury.module.css";';

  if (
    !source.includes(
      anchor
    )
  ) {
    throw new Error(
      "Could not find PI CSS import anchor."
    );
  }

  source =
    source.replace(
      anchor,
      `${anchor}\n${importLine}`
    );
}

/*
|--------------------------------------------------------------------------
| ORBIT ROLE COPY
|--------------------------------------------------------------------------
*/

source =
  source.replace(
    '"Tracks follow-up timing, replies, meetings, and referral-partner relationship history."',
    '"Owns referral meetings from Calendly booking through Titan calendar sync, conflict detection, pre-call intelligence, and relationship follow-up."'
  );

source =
  source.replace(
    '"Relationship Follow-Up Agent"',
    '"Referral Meeting & Follow-Up Agent"'
  );

source =
  source.replace(
    'output: ["Follow-up queue", "Relationship history", "Referral log"],',
    'output: ["Upcoming meetings", "Pre-call intelligence", "Conflict queue", "Relationship history"],'
  );

/*
|--------------------------------------------------------------------------
| CUSTOM ORBIT WORKSTATION
|--------------------------------------------------------------------------
*/

const oldStart =
  '{["scout", "bridge", "reach", "orbit"].includes(selectedAgent.id) ? (';

const newStart =
  '{selectedAgent.id === "orbit" ? (\n                <ReferralMeetingWorkstation />\n              ) : ["scout", "bridge", "reach"].includes(selectedAgent.id) ? (';

if (
  source.includes(
    oldStart
  )
) {
  source =
    source.replace(
      oldStart,
      newStart
    );
} else if (
  !source.includes(
    '<ReferralMeetingWorkstation />'
  )
) {
  throw new Error(
    "Could not find Scout/Bridge/Reach/Orbit workstation routing anchor."
  );
}

fs.writeFileSync(
  pagePath,
  source
);

console.log(
  "Applied PI referral meeting / Orbit workstation patch."
);

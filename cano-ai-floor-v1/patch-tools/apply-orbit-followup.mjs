import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

function patchFile(
  rel,
  mutate
) {
  const file =
    path.join(
      root,
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

  const source =
    fs.readFileSync(
      file,
      "utf8"
    );

  const next =
    mutate(
      source
    );

  fs.writeFileSync(
    file,
    next
  );
}

/*
|--------------------------------------------------------------------------
| Fix Contact TypeScript declaration if prior 30-minute patch has not yet run.
|--------------------------------------------------------------------------
*/

patchFile(
  "lib/pi/referral-meetings.ts",
  (
    source
  ) => {
    if (
      source.includes(
        "selected_for_outreach?: boolean;"
      )
    ) {
      return source;
    }

    const anchor =
      "  linkedin_url?: string;";

    if (
      !source.includes(
        anchor
      )
    ) {
      throw new Error(
        "Orbit follow-up patch could not locate Contact type."
      );
    }

    return source.replace(
      anchor,
      `${anchor}
  selected_for_outreach?: boolean;
  priority?: number;`
    );
  }
);

/*
|--------------------------------------------------------------------------
| Render Orbit follow-up tracker inside the existing Orbit workstation.
|--------------------------------------------------------------------------
*/

patchFile(
  "app/personal-injury/ReferralMeetingWorkstation.tsx",
  (
    source
  ) => {
    const importLine =
      'import OrbitFollowUpPanel from "./OrbitFollowUpPanel";';

    if (
      !source.includes(
        importLine
      )
    ) {
      const anchor =
        'import styles from "./ReferralMeetingWorkstation.module.css";';

      if (
        !source.includes(
          anchor
        )
      ) {
        throw new Error(
          "Orbit follow-up patch could not find ReferralMeetingWorkstation styles import."
        );
      }

      source =
        source.replace(
          anchor,
          `${anchor}
${importLine}`
        );
    }

    if (
      !source.includes(
        "<OrbitFollowUpPanel />"
      )
    ) {
      const anchor =
`      <div
        className={
          styles.syncNote
        }
      >`;

      if (
        !source.includes(
          anchor
        )
      ) {
        throw new Error(
          "Orbit follow-up patch could not find syncNote render anchor."
        );
      }

      source =
        source.replace(
          anchor,
`      <OrbitFollowUpPanel />

${anchor}`
        );
    }

    return source;
  }
);

console.log(
  "Applied Orbit Titan inbox + follow-up tracker UI patch."
);

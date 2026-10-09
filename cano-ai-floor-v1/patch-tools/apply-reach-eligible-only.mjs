import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, value) {
  fs.writeFileSync(path.join(root, rel), value, "utf8");
}

function replaceOnce(source, oldValue, newValue, label) {
  if (source.includes(newValue)) {
    console.log(`${label}: already patched`);
    return source;
  }

  if (!source.includes(oldValue)) {
    throw new Error(
      `${label}: expected anchor was not found. The current file changed and needs a fresh patch.`
    );
  }

  return source.replace(oldValue, newValue);
}

/*
|--------------------------------------------------------------------------
| REACH WORKSTATION
|--------------------------------------------------------------------------
|
| Only true "approved + never sent" prospects belong in the Reach target list.
| Contacted / Replied / Meeting / Partner are downstream stages and should
| never be offered another first-touch Draft Email button.
|
| We also check actual sent outreach history so even if a prospect's stage
| was accidentally left "approved", Reach still hides it after a send.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/personal-injury/ReachWorkstation.tsx";

  let source =
    read(rel);

  const oldFilter = `      return workspace.referrals
        .filter(
          (prospect) =>
            [
              "approved",
              "contacted",
              "replied",
              "meeting",
              "partner",
            ].includes(
              prospect.relationship_status
            )
        )
        .filter(`;

  const newFilter = `      return workspace.referrals
        .filter(
          (prospect) => {
            if (
              prospect.relationship_status !==
              "approved"
            ) {
              return false;
            }

            /*
            | Defensive duplicate protection:
            | if a sent outbound email exists, this prospect has already
            | entered the contacted lane even if its relationship status
            | was not updated correctly.
            */
            const alreadyContacted =
              workspace.outreach.some(
                (item) =>
                  clean(
                    item.referral_prospect_id
                  ) ===
                    prospect.id &&
                  clean(
                    item.channel
                  ).toLowerCase() ===
                    "email" &&
                  clean(
                    item.direction
                  ).toLowerCase() !==
                    "inbound" &&
                  clean(
                    item.status
                  ).toLowerCase() ===
                    "sent"
              );

            return !alreadyContacted;
          }
        )
        .filter(`;

  source =
    replaceOnce(
      source,
      oldFilter,
      newFilter,
      "Reach eligible-target filter"
    );

  const oldDeps = `    [
      workspace.referrals,
      search,
    ]
  );`;

  const newDeps = `    [
      workspace.referrals,
      workspace.outreach,
      search,
    ]
  );`;

  source =
    replaceOnce(
      source,
      oldDeps,
      newDeps,
      "Reach eligible-target dependencies"
    );

  write(
    rel,
    source
  );

  console.log(
    `${rel}: patched`
  );
}

/*
|--------------------------------------------------------------------------
| REACH API
|--------------------------------------------------------------------------
|
| UI protection is not enough. Block duplicate first-touch drafting at the
| server too, so a stale tab / old button / direct request cannot start Reach
| for someone who is Contacted or farther along.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/api/pi/reach/run/route.ts";

  let source =
    read(rel);

  const contactType = `type Contact = {
  id: string;
  prospect_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  priority: number;
  selected_for_outreach: boolean;
};`;

  const contactTypePatched = `type Contact = {
  id: string;
  prospect_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  priority: number;
  selected_for_outreach: boolean;
};

type PriorOutreach = {
  id: string;
  referral_prospect_id?: string | null;
  channel?: string;
  direction?: string;
  status?: string;
};`;

  source =
    replaceOnce(
      source,
      contactType,
      contactTypePatched,
      "Reach prior-outreach type"
    );

  const oldStageGuard = `    const allowedStages =
      new Set([
        "approved",
        "contacted",
        "replied",
        "meeting",
        "partner",
      ]);

    if (
      !allowedStages.has(
        clean(
          prospect.relationship_status
        ).toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            \`Move \${prospect.organization_name} to Approved before Reach drafts external outreach.\`,
        },
        {
          status: 400,
        }
      );
    }

    const startedAt =`;

  const newStageGuard = `    const relationshipStatus =
      clean(
        prospect.relationship_status
      ).toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | FIRST-TOUCH ELIGIBILITY
    |--------------------------------------------------------------------------
    |
    | Reach creates the first outreach draft ONLY while the prospect is in
    | Approved. Contacted / Replied / Meeting / Partner belong to Orbit and the
    | relationship workflow, not back in first-touch Reach.
    |--------------------------------------------------------------------------
    */
    if (
      relationshipStatus !==
      "approved"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            \`\${prospect.organization_name} is already in the \${relationshipStatus || "unknown"} stage. Reach only creates first-touch drafts for Approved prospects.\`,
        },
        {
          status: 409,
        }
      );
    }

    /*
    | Second line of defense:
    | if the stage somehow remained Approved after a real send, do not allow
    | another first-touch draft for the same prospect.
    */
    const priorOutreach =
      await supabaseSelect<PriorOutreach>(
        "pi_outreach_events",
        {
          select:
            "id,referral_prospect_id,channel,direction,status",
          referral_prospect_id:
            eq(
              prospect.id
            ),
          channel:
            "eq.email",
          status:
            "eq.sent",
          limit:
            100,
        }
      );

    const hasSentOutbound =
      priorOutreach.some(
        (item) =>
          clean(
            item.direction
          ).toLowerCase() !==
          "inbound"
      );

    if (
      hasSentOutbound
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            \`\${prospect.organization_name} already has sent outreach history. Reach will not create a duplicate first-touch email. Continue the relationship through Orbit instead.\`,
        },
        {
          status: 409,
        }
      );
    }

    const startedAt =`;

  source =
    replaceOnce(
      source,
      oldStageGuard,
      newStageGuard,
      "Reach server eligibility guard"
    );

  write(
    rel,
    source
  );

  console.log(
    `${rel}: patched`
  );
}

console.log(
  "Applied Reach eligible-only / duplicate-first-touch protection."
);

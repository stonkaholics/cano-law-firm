import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(
    path.join(root, rel),
    "utf8"
  );
}

function write(rel, value) {
  fs.writeFileSync(
    path.join(root, rel),
    value,
    "utf8"
  );
}

function replaceOnce(
  source,
  oldValue,
  newValue,
  label
) {
  if (source.includes(newValue)) {
    console.log(
      `${label}: already patched`
    );
    return source;
  }

  if (!source.includes(oldValue)) {
    throw new Error(
      `${label}: expected anchor not found.`
    );
  }

  return source.replace(
    oldValue,
    newValue
  );
}

/*
|--------------------------------------------------------------------------
| 1. REACH DRAFTING POLICY
|--------------------------------------------------------------------------
|
| Keep the first-touch specific to WHY the prospect is a fit, but always give
| the recipient a concise picture of Cano's two main referral lanes.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/api/pi/reach/run/route.ts";

  let source =
    read(rel);

  const anchor = `    "Briefly explain the business reason for connecting: a potential professional referral relationship where either firm may be a useful resource when a matter is a better fit for the other. Do not frame this as quid pro quo.",
    "Prefer state-level framing such as Florida over city-level framing unless the city is specifically relevant.",`;

  const replacement = `    "Briefly explain the business reason for connecting: a potential professional referral relationship where either firm may be a useful resource when a matter is a better fit for the other. Do not frame this as quid pro quo.",
    "Always mention Cano's two primary referral lanes once in the body using natural language substantially similar to: We handle personal injury and immigration matters in Florida. Do not turn this into a service list and do not make immigration the lead unless it is relevant to the prospect.",
    "Lead with the prospect-specific reason for the introduction, then mention Cano's Personal Injury + Immigration capabilities once so the recipient understands the broader referral relationship.",
    "Prefer state-level framing such as Florida over city-level framing unless the city is specifically relevant.",`;

  source =
    replaceOnce(
      source,
      anchor,
      replacement,
      "Reach PI + Immigration drafting rule"
    );

  write(rel, source);
  console.log(
    `${rel}: patched`
  );
}

/*
|--------------------------------------------------------------------------
| 2. COMPLIANCE AUDIT MUST NEVER TURN A SUCCESSFUL TITAN SEND INTO AN ERROR
|--------------------------------------------------------------------------
|
| The live pi_compliance_reviews.status CHECK does not accept every historical
| status used by these routes. The actual workflow state already lives in
| pi_outreach_events + pi_referral_prospects.
|
| Therefore:
| - still ATTEMPT the audit insert
| - if its CHECK rejects the audit row, log it
| - NEVER return 500 after Titan already sent
| - NEVER block Approved -> Contacted / Orbit handoff
|--------------------------------------------------------------------------
*/

function addSafeComplianceHelper(source, label) {
  const marker =
    `async function safeComplianceInsert(`;

  if (source.includes(marker)) {
    console.log(
      `${label}: helper already present`
    );
    return source;
  }

  const cleanFn = `function clean(value: unknown) {
  return String(value || "").trim();
}`;

  const helper = `function clean(value: unknown) {
  return String(value || "").trim();
}

async function safeComplianceInsert(
  row: Record<string, any>
) {
  try {
    await supabaseInsert(
      "pi_compliance_reviews",
      row
    );

    return true;
  } catch (error) {
    /*
    | Compliance logging is secondary to the authoritative outreach state.
    | A CHECK mismatch here must never make an already-sent Titan message
    | appear failed to the UI.
    */
    console.warn(
      "Non-blocking pi_compliance_reviews audit insert failed:",
      error instanceof Error
        ? error.message
        : error
    );

    return false;
  }
}`;

  return replaceOnce(
    source,
    cleanFn,
    helper,
    label
  );
}

function replaceComplianceCalls(
  source,
  label
) {
  const needle =
    `await supabaseInsert(
        "pi_compliance_reviews",
        {`;

  if (!source.includes(needle)) {
    console.log(
      `${label}: no direct compliance calls remain`
    );
    return source;
  }

  let changed =
    source;

  while (
    changed.includes(needle)
  ) {
    changed =
      changed.replace(
        needle,
        `await safeComplianceInsert({`
      );
  }

  return changed;
}

{
  const rel =
    "app/api/pi/outreach/send/route.ts";

  let source =
    read(rel);

  source =
    addSafeComplianceHelper(
      source,
      "Titan send safe compliance helper"
    );

  source =
    replaceComplianceCalls(
      source,
      "Titan send compliance inserts"
    );

  /*
  | The closing syntax after replacement becomes:
  | await safeComplianceInsert({ ... });
  | which is already valid because only the table-name argument was removed.
  */

  write(rel, source);
  console.log(
    `${rel}: patched`
  );
}

{
  const rel =
    "app/api/pi/guard/decision/route.ts";

  if (
    fs.existsSync(
      path.join(root, rel)
    )
  ) {
    let source =
      read(rel);

    source =
      addSafeComplianceHelper(
        source,
        "Guard safe compliance helper"
      );

    source =
      replaceComplianceCalls(
        source,
        "Guard compliance insert"
      );

    write(rel, source);
    console.log(
      `${rel}: patched`
    );
  }
}

/*
|--------------------------------------------------------------------------
| 3. REACH APPROVAL QUEUE SHOULD CONTAIN ONLY ACTIVE DRAFTS
|--------------------------------------------------------------------------
|
| Old code put ANY item with metadata.agent === reach into the right-side list,
| which means SENT records continued to show there forever.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/personal-injury/ReachWorkstation.tsx";

  let source =
    read(rel);

  const oldReachDrafts = `  const reachDrafts =
    useMemo(
      () =>
        workspace.outreach.filter(
          (item) =>
            clean(
              item.metadata?.agent
            ).toLowerCase() ===
              "reach" ||
            (
              clean(
                item.status
              ).toLowerCase() ===
                "draft" &&
              clean(
                item.channel
              ).toLowerCase() ===
                "email"
            )
        ),
      [workspace.outreach]
    );

  const pendingDrafts =
    reachDrafts.filter(
      (item) =>
        clean(
          item.status
        ).toLowerCase() ===
        "draft"
    );`;

  const newReachDrafts = `  const reachDrafts =
    useMemo(
      () =>
        workspace.outreach.filter(
          (item) => {
            const status =
              clean(
                item.status
              ).toLowerCase();

            const isActive =
              status ===
                "draft" ||
              status ===
                "approved";

            if (!isActive) {
              return false;
            }

            const agent =
              clean(
                item.metadata?.agent
              ).toLowerCase();

            const channel =
              clean(
                item.channel
              ).toLowerCase();

            return (
              agent ===
                "reach" ||
              channel ===
                "email"
            );
          }
        ),
      [workspace.outreach]
    );

  /*
  | Approved drafts are still active Reach work, so the headline number should
  | match the actual visible approval queue.
  */
  const pendingDrafts =
    reachDrafts;`;

  source =
    replaceOnce(
      source,
      oldReachDrafts,
      newReachDrafts,
      "Reach active approval queue"
    );

  write(rel, source);
  console.log(
    `${rel}: patched`
  );
}

console.log(
  "Applied final Reach prompt + non-blocking compliance + active queue fixes."
);

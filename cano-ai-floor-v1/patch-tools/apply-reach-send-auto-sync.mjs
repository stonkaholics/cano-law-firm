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
      `${label}: expected anchor was not found. Current source changed and needs a refreshed patch.`
    );
  }

  return source.replace(oldValue, newValue);
}

/*
|--------------------------------------------------------------------------
| 1) REACH: INSTANTLY RECONCILE AFTER REAL SEND
|--------------------------------------------------------------------------
|
| Current behavior:
| - Titan successfully sends
| - API updates Supabase
| - Reach waits for loadWorkspace()
| - modal / queue can visually remain stale until refresh
|
| New behavior:
| - as soon as send API returns success, update Reach state immediately
| - mark outreach sent locally
| - mark prospect contacted locally
| - close the draft review immediately
| - broadcast the status change to the main PI floor / Scout
| - silently reconcile against Supabase in the background
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/personal-injury/ReachWorkstation.tsx";

  let source = read(rel);

  const oldOfficialSend = `        if (mode === "test") {
          setNotice(
            \`Test email sent through Titan Mail to \${data.recipient}. Check the inbox formatting before sending officially.\`
          );
        } else {
          setSelectedDraft(null);
          await loadWorkspace();
          setNotice(
            \`Email sent through Titan Mail to \${data.recipient}. The referral is now Contacted and ready for Orbit follow-up.\`
          );
        }`;

  const newOfficialSend = `        if (mode === "test") {
          setNotice(
            \`Test email sent through Titan Mail to \${data.recipient}. Check the inbox formatting before sending officially.\`
          );
        } else {
          const prospectId =
            clean(
              draft.referral_prospect_id ||
              data?.prospectId ||
              data?.row?.referral_prospect_id
            );

          /*
          |--------------------------------------------------------------------------
          | OPTIMISTIC / IMMEDIATE UI TRANSITION
          |--------------------------------------------------------------------------
          |
          | Do not make the user wait for another Supabase fetch before the UI
          | reflects a send we already know succeeded.
          |--------------------------------------------------------------------------
          */
          setWorkspace(
            (current) => ({
              ...current,

              referrals:
                current.referrals.map(
                  (prospect) =>
                    prospect.id === prospectId
                      ? {
                          ...prospect,
                          relationship_status:
                            "contacted",
                        }
                      : prospect
                ),

              outreach:
                current.outreach.map(
                  (item) =>
                    item.id === draft.id
                      ? {
                          ...item,
                          status:
                            "sent",
                          occurred_at:
                            data?.row?.occurred_at ||
                            new Date().toISOString(),
                          metadata: {
                            ...(item.metadata || {}),
                            ...(data?.row?.metadata || {}),
                            send_status:
                              "sent",
                          },
                        }
                      : item
                ),
            })
          );

          /*
          | Reach queue instantly loses this item because activeReachDrafts only
          | contains draft / approved rows.
          */
          setSelectedDraft(
            null
          );

          /*
          | Tell the main PI floor (including Scout's Referral Engine) that this
          | prospect moved from Approved -> Contacted. This keeps Scout and Reach
          | synchronized without a page refresh.
          */
          if (prospectId) {
            window.dispatchEvent(
              new CustomEvent(
                "cano:pi-referral-status-changed",
                {
                  detail: {
                    prospectId,
                    status:
                      "contacted",
                    outreachEventId:
                      draft.id,
                    source:
                      "reach_titan_send",
                  },
                }
              )
            );
          }

          setNotice(
            \`Email sent through Titan Mail to \${data.recipient}. The referral moved to Contacted and Orbit now owns follow-up.\`
          );

          /*
          | Reconcile quietly after the instant transition. We intentionally do
          | not await this because the UI should not stay blocked or stale.
          */
          void loadWorkspace();
        }`;

  source =
    replaceOnce(
      source,
      oldOfficialSend,
      newOfficialSend,
      "Reach post-send automatic sync"
    );

  write(rel, source);
  console.log(`${rel}: patched`);
}

/*
|--------------------------------------------------------------------------
| 2) MAIN PI FLOOR / SCOUT: RECEIVE REACH STATUS BROADCAST
|--------------------------------------------------------------------------
|
| Reach is rendered as a sibling bridge in the PI layout, so its local React
| state is separate from page.tsx. This lightweight browser event gives the
| floor an immediate local update after a successful Titan send.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/personal-injury/page.tsx";

  let source = read(rel);

  const oldEffect = `  useEffect(() => {
    void loadWorkspace();
  }, []);


  async function pollWorkspaceAfterAgent(`;

  const newEffect = `  useEffect(() => {
    void loadWorkspace();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | CROSS-WORKSTATION REFERRAL STATUS SYNC
  |--------------------------------------------------------------------------
  |
  | Reach emits this event only after Titan confirms an official send.
  | Update Scout / Referral Engine immediately so Approved disappears and the
  | same prospect becomes Contacted without requiring a manual refresh.
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    const handleReferralStatusChanged = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent<{
          prospectId?: string;
          status?: ReferralStatus;
          outreachEventId?: string;
          source?: string;
        }>;

      const prospectId =
        String(
          customEvent.detail?.prospectId ||
          ""
        ).trim();

      const status =
        customEvent.detail?.status;

      if (
        !prospectId ||
        !status
      ) {
        return;
      }

      setWorkspace(
        (current) => ({
          ...current,

          referrals:
            current.referrals.map(
              (prospect) =>
                prospect.id ===
                prospectId
                  ? {
                      ...prospect,
                      relationship_status:
                        status,
                    }
                  : prospect
            ),

          outreach:
            current.outreach.map(
              (item) =>
                item.id ===
                customEvent.detail
                  ?.outreachEventId
                  ? {
                      ...item,
                      status:
                        "sent",
                    }
                  : item
            ),
        })
      );

      setAgentMessage(
        status ===
          "contacted"
          ? "Titan Mail sent successfully. Referral moved to Contacted and was handed to Orbit for follow-up."
          : \`Referral moved to \${status}.\`
      );

      /*
      | A background reconciliation keeps every secondary field authoritative,
      | but the status transition above is instantaneous.
      */
      window.setTimeout(
        () => {
          void loadWorkspace();
        },
        300
      );
    };

    window.addEventListener(
      "cano:pi-referral-status-changed",
      handleReferralStatusChanged
    );

    return () => {
      window.removeEventListener(
        "cano:pi-referral-status-changed",
        handleReferralStatusChanged
      );
    };
  }, []);


  async function pollWorkspaceAfterAgent(`;

  source =
    replaceOnce(
      source,
      oldEffect,
      newEffect,
      "PI floor Reach-to-Scout live sync"
    );

  write(rel, source);
  console.log(`${rel}: patched`);
}

/*
|--------------------------------------------------------------------------
| 3) SEND API: RETURN THE STATE TRANSITION EXPLICITLY
|--------------------------------------------------------------------------
|
| The database update already exists and is correct. We only enrich the
| response so the client has authoritative IDs/status for immediate sync.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/api/pi/outreach/send/route.ts";

  let source = read(rel);

  const oldReturn = `    return NextResponse.json({
      ok: true,
      mode,
      recipient:
        realRecipient,
      sender:
        delivery.sender,
      messageId:
        delivery.messageId,
      accepted:
        delivery.accepted,
      rejected:
        delivery.rejected,
      response:
        delivery.response,
      row:
        updated[0] || null,
    });`;

  const newReturn = `    return NextResponse.json({
      ok: true,
      mode,
      recipient:
        realRecipient,
      sender:
        delivery.sender,
      messageId:
        delivery.messageId,
      accepted:
        delivery.accepted,
      rejected:
        delivery.rejected,
      response:
        delivery.response,

      prospectId:
        clean(
          draft.referral_prospect_id
        ),

      relationshipStatus:
        "contacted",

      orbitHandoff:
        "ready",

      row:
        updated[0] || null,
    });`;

  source =
    replaceOnce(
      source,
      oldReturn,
      newReturn,
      "Titan send response state payload"
    );

  write(rel, source);
  console.log(`${rel}: patched`);
}

console.log(
  "Applied Reach send -> Contacted -> Orbit automatic live-sync patch."
);

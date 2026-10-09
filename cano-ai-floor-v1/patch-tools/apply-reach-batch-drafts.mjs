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
    throw new Error(`${label}: expected anchor not found`);
  }

  console.log(`${label}: patched`);
  return source.replace(oldValue, newValue);
}

const rel = "app/personal-injury/ReachWorkstation.tsx";
let source = read(rel);

/*
|--------------------------------------------------------------------------
| 1) Helper: determine whether a prospect already owns an active Reach draft
|--------------------------------------------------------------------------
*/

source = replaceOnce(
  source,
`function stageLabel(status: string) {
  const labels: Record<string, string> = {
    new: "New",
    researching: "Researching",
    approved: "Approved",
    contacted: "Contacted",
    replied: "Replied",
    meeting: "Meeting",
    partner: "Partner",
    not_fit: "Not Fit",
  };

  return labels[status] || status || "Unknown";
}`,
`function stageLabel(status: string) {
  const labels: Record<string, string> = {
    new: "New",
    researching: "Researching",
    approved: "Approved",
    contacted: "Contacted",
    replied: "Replied",
    meeting: "Meeting",
    partner: "Partner",
    not_fit: "Not Fit",
  };

  return labels[status] || status || "Unknown";
}

function hasActiveDraftForProspect(
  workspace: Workspace,
  prospectId: string
) {
  return workspace.outreach.some(
    (item) => {
      if (
        clean(
          item.referral_prospect_id
        ) !== prospectId
      ) {
        return false;
      }

      const status =
        clean(
          item.status
        ).toLowerCase();

      if (
        ![
          "draft",
          "approved",
        ].includes(
          status
        )
      ) {
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
        agent === "reach" ||
        channel === "email"
      );
    }
  );
}`,
  "Reach active-draft helper"
);

/*
|--------------------------------------------------------------------------
| 2) Replace one global running prospect with a true multi-draft queue
|--------------------------------------------------------------------------
*/

source = replaceOnce(
  source,
`  const [loading, setLoading] = useState(false);
  const [runningProspectId, setRunningProspectId] =
    useState<string | null>(null);
  const [draftTarget, setDraftTarget] =
    useState<DraftTarget | null>(null);
  const [selectedDraft, setSelectedDraft] =
    useState<OutreachEvent | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const pollRef = useRef<number | null>(null);`,
`  const [loading, setLoading] = useState(false);

  /*
  | Multiple firms can draft at the same time.
  | Only the specific firms currently drafting are locked.
  */
  const [runningProspectIds, setRunningProspectIds] =
    useState<string[]>([]);

  const [selectedDraft, setSelectedDraft] =
    useState<OutreachEvent | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  /*
  | One lightweight poller watches all in-flight Reach jobs.
  */
  const pollRef = useRef<number | null>(null);
  const draftTargetsRef =
    useRef<Record<string, DraftTarget>>({});
  const draftAttemptsRef =
    useRef<Record<string, number>>({});`,
  "Reach multi-draft state"
);

/*
|--------------------------------------------------------------------------
| 3) Replace single-target polling with multiplex polling
|--------------------------------------------------------------------------
*/

const oldPolling = `  const startDraftPolling = useCallback(
    (target: DraftTarget) => {
      stopPolling();

      let attempts = 0;

      const check = async () => {
        attempts += 1;

        const next =
          await loadWorkspace();

        if (!next) {
          return;
        }

        const draft =
          findDraftForTarget(
            next,
            target
          );

        if (draft) {
          setSelectedDraft(draft);
          setRunningProspectId(null);
          setNotice(
            "Reach finished the draft. It is saved and waiting for human approval."
          );
          stopPolling();
          return;
        }

        if (attempts >= 30) {
          setRunningProspectId(null);
          setError(
            "Reach accepted the request, but no draft appeared within about 90 seconds. Open the latest Reach execution in n8n and inspect the last completed node."
          );
          stopPolling();
        }
      };

      void check();

      pollRef.current =
        window.setInterval(
          () => void check(),
          3000
        );
    },
    [
      findDraftForTarget,
      loadWorkspace,
      stopPolling,
    ]
  );`;

const newPolling = `  const startDraftPolling = useCallback(
    (target: DraftTarget) => {
      draftTargetsRef.current[
        target.prospectId
      ] = target;

      draftAttemptsRef.current[
        target.prospectId
      ] = 0;

      /*
      | If the shared poller is already running, the new target has simply
      | joined the existing batch. Do not restart or cancel the other jobs.
      */
      if (
        pollRef.current !==
        null
      ) {
        return;
      }

      const check = async () => {
        const next =
          await loadWorkspace();

        if (!next) {
          return;
        }

        const targets =
          Object.values(
            draftTargetsRef.current
          );

        if (!targets.length) {
          stopPolling();
          return;
        }

        const completedNames: string[] =
          [];
        const timedOutNames: string[] =
          [];

        for (
          const currentTarget
          of targets
        ) {
          const prospectId =
            currentTarget.prospectId;

          draftAttemptsRef.current[
            prospectId
          ] =
            Number(
              draftAttemptsRef
                .current[
                prospectId
              ] || 0
            ) + 1;

          const draft =
            findDraftForTarget(
              next,
              currentTarget
            );

          if (draft) {
            delete draftTargetsRef
              .current[
              prospectId
            ];

            delete draftAttemptsRef
              .current[
              prospectId
            ];

            setRunningProspectIds(
              (current) =>
                current.filter(
                  (id) =>
                    id !==
                    prospectId
                )
            );

            /*
            | IMPORTANT UX:
            | Do NOT auto-open the finished draft.
            | It simply appears in Reach Drafts and the user can click it
            | whenever they want.
            */
            completedNames.push(
              currentTarget
                .organizationName
            );

            continue;
          }

          if (
            Number(
              draftAttemptsRef
                .current[
                prospectId
              ] || 0
            ) >= 30
          ) {
            delete draftTargetsRef
              .current[
              prospectId
            ];

            delete draftAttemptsRef
              .current[
              prospectId
            ];

            setRunningProspectIds(
              (current) =>
                current.filter(
                  (id) =>
                    id !==
                    prospectId
                )
            );

            timedOutNames.push(
              currentTarget
                .organizationName
            );
          }
        }

        if (
          completedNames.length
        ) {
          setNotice(
            completedNames.length === 1
              ? \`\${completedNames[0]} draft is ready in the Reach Drafts queue.\`
              : \`\${completedNames.length} Reach drafts are ready in the queue.\`
          );
        }

        if (
          timedOutNames.length
        ) {
          setError(
            \`Reach accepted \${timedOutNames.length} request(s), but no draft appeared within about 90 seconds. Check the latest Reach n8n execution for: \${timedOutNames.join(", ")}.\`
          );
        }

        if (
          !Object.keys(
            draftTargetsRef.current
          ).length
        ) {
          stopPolling();
        }
      };

      void check();

      pollRef.current =
        window.setInterval(
          () => void check(),
          3000
        );
    },
    [
      findDraftForTarget,
      loadWorkspace,
      stopPolling,
    ]
  );`;

source = replaceOnce(
  source,
  oldPolling,
  newPolling,
  "Reach multiplex draft polling"
);

/*
|--------------------------------------------------------------------------
| 4) Allow multiple simultaneous runReach calls
|--------------------------------------------------------------------------
*/

source = replaceOnce(
  source,
`      if (
        runningProspectId
      ) {
        return;
      }`,
`      if (
        runningProspectIds.includes(
          prospect.id
        ) ||
        hasActiveDraftForProspect(
          workspace,
          prospect.id
        )
      ) {
        return;
      }`,
  "Reach prospect-only lock"
);

source = replaceOnce(
  source,
`      setRunningProspectId(
        prospect.id
      );
      setSelectedDraft(null);
      setError("");
      setNotice(
        \`Reach is drafting an introduction for \${prospect.organization_name}.\`
      );`,
`      setRunningProspectIds(
        (current) =>
          current.includes(
            prospect.id
          )
            ? current
            : [
                ...current,
                prospect.id,
              ]
      );

      /*
      | Keep whatever draft the user is currently viewing open.
      | Starting another draft should not hijack the review panel.
      */
      setError("");
      setNotice(
        \`Reach started drafting for \${prospect.organization_name}. You can queue additional firms while it works.\`
      );`,
  "Reach start concurrent draft"
);

source = replaceOnce(
  source,
`        setDraftTarget(
          target
        );

        startDraftPolling(
          target
        );`,
`        startDraftPolling(
          target
        );`,
  "Reach remove single draft target"
);

source = replaceOnce(
  source,
`      } catch (caught) {
        setRunningProspectId(
          null
        );
        setError(`,
`      } catch (caught) {
        setRunningProspectIds(
          (current) =>
            current.filter(
              (id) =>
                id !==
                prospect.id
            )
        );

        delete draftTargetsRef
          .current[
          prospect.id
        ];

        delete draftAttemptsRef
          .current[
          prospect.id
        ];

        setError(`,
  "Reach failed-job unlock"
);

source = replaceOnce(
  source,
`    [
      runningProspectId,
      startDraftPolling,
    ]
  );`,
`    [
      runningProspectIds,
      startDraftPolling,
      workspace,
    ]
  );`,
  "Reach concurrent dependencies"
);

/*
|--------------------------------------------------------------------------
| 5) If workspace already shows a draft, clear any stale in-progress lock
|--------------------------------------------------------------------------
*/

const effectAnchor = `  useEffect(() => {
    const clickHandler = (
      event: MouseEvent
    ) => {`;

source = replaceOnce(
  source,
  effectAnchor,
`  useEffect(() => {
    if (
      !runningProspectIds.length
    ) {
      return;
    }

    setRunningProspectIds(
      (current) =>
        current.filter(
          (prospectId) =>
            !hasActiveDraftForProspect(
              workspace,
              prospectId
            )
        )
    );
  }, [
    workspace.outreach,
  ]);

  useEffect(() => {
    const clickHandler = (
      event: MouseEvent
    ) => {`,
  "Reach stale lock reconciliation"
);

/*
|--------------------------------------------------------------------------
| 6) Per-card state: Drafting / Draft Ready / Draft Email
|--------------------------------------------------------------------------
*/

source = replaceOnce(
  source,
`                    const isRunning =
                      runningProspectId ===
                      prospect.id;`,
`                    const isRunning =
                      runningProspectIds.includes(
                        prospect.id
                      );

                    const hasActiveDraft =
                      hasActiveDraftForProspect(
                        workspace,
                        prospect.id
                      );`,
  "Reach per-card drafting state"
);

source = replaceOnce(
  source,
`                            disabled={
                              !hasEmail ||
                              Boolean(
                                runningProspectId
                              )
                            }`,
`                            disabled={
                              !hasEmail ||
                              isRunning ||
                              hasActiveDraft
                            }`,
  "Reach only lock current prospect"
);

source = replaceOnce(
  source,
`                            {isRunning
                              ? "Drafting…"
                              : "Draft Email"}`,
`                            {isRunning
                              ? "Drafting…"
                              : hasActiveDraft
                              ? "Draft Ready"
                              : "Draft Email"}`,
  "Reach card button label"
);

/*
|--------------------------------------------------------------------------
| 7) Finished drafts never auto-open
|--------------------------------------------------------------------------
|
| Old auto-open is removed above in the new multiplex poller. Existing queue
| rows remain clickable, which is exactly the desired review behavior.
|--------------------------------------------------------------------------
*/

write(rel, source);

console.log(
  "Applied Reach batch drafting queue patch: concurrent jobs, prospect-only locks, no auto-open."
);

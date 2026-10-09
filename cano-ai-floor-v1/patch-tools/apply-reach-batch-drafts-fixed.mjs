import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = "app/personal-injury/ReachWorkstation.tsx";
const file = path.join(root, rel);

let source = fs.readFileSync(file, "utf8");

function mustReplaceRegex(regex, replacement, label) {
  if (!regex.test(source)) {
    throw new Error(`${label}: pattern not found`);
  }

  source = source.replace(regex, replacement);
  console.log(`${label}: patched`);
}

/*
|--------------------------------------------------------------------------
| 1) ADD ACTIVE-DRAFT HELPER IF MISSING
|--------------------------------------------------------------------------
*/

if (!source.includes("function hasActiveDraftForProspect(")) {
  mustReplaceRegex(
    /function stageLabel\(status: string\) \{[\s\S]*?\n\}/,
    (match) => `${match}

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
        ].includes(status)
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
    "active-draft helper"
  );
}

/*
|--------------------------------------------------------------------------
| 2) REPLACE SINGLE RUNNING PROSPECT STATE WITH MULTI-RUN STATE
|--------------------------------------------------------------------------
*/

if (!source.includes("const [runningProspectIds, setRunningProspectIds]")) {
  mustReplaceRegex(
    /  const \[runningProspectId, setRunningProspectId\] =\s*\n\s*useState<string \| null>\(null\);\s*\n\s*const \[draftTarget, setDraftTarget\] =\s*\n\s*useState<DraftTarget \| null>\(null\);/,
`  const [runningProspectIds, setRunningProspectIds] =
    useState<string[]>([]);`,
    "multi-draft state"
  );
}

if (!source.includes("const draftTargetsRef")) {
  mustReplaceRegex(
    /  const pollRef = useRef<number \| null>\(null\);/,
`  const pollRef = useRef<number | null>(null);

  const draftTargetsRef =
    useRef<Record<string, DraftTarget>>({});

  const draftAttemptsRef =
    useRef<Record<string, number>>({});`,
    "batch polling refs"
  );
}

/*
|--------------------------------------------------------------------------
| 3) REPLACE SINGLE-TARGET POLLER WITH MULTI-TARGET POLLER
|--------------------------------------------------------------------------
*/

if (!source.includes("completedNames: string[]")) {
  mustReplaceRegex(
    /  const startDraftPolling = useCallback\([\s\S]*?\n  \);\n\n  const runReach = useCallback\(/,
`  const startDraftPolling = useCallback(
    (target: DraftTarget) => {
      draftTargetsRef.current[
        target.prospectId
      ] = target;

      draftAttemptsRef.current[
        target.prospectId
      ] = 0;

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
              ? \`\${completedNames[0]} draft is ready in Reach Drafts.\`
              : \`\${completedNames.length} Reach drafts are ready in the queue.\`
          );
        }

        if (
          timedOutNames.length
        ) {
          setError(
            \`Reach accepted \${timedOutNames.length} request(s), but no draft appeared within about 90 seconds. Check n8n for: \${timedOutNames.join(", ")}.\`
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
  );

  const runReach = useCallback(`,
    "multi-target polling"
  );
}

/*
|--------------------------------------------------------------------------
| 4) RUNREACH: LOCK ONLY THE CURRENT PROSPECT
|--------------------------------------------------------------------------
*/

mustReplaceRegex(
  /      if \(\s*\n\s*runningProspectId\s*\n\s*\) \{\s*\n\s*return;\s*\n\s*\}/,
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
  "per-prospect run lock"
);

mustReplaceRegex(
  /      setRunningProspectId\(\s*\n\s*prospect\.id\s*\n\s*\);\s*\n\s*setSelectedDraft\(null\);\s*\n\s*setError\(""\);\s*\n\s*setNotice\(\s*\n\s*`Reach is drafting an introduction for \$\{prospect\.organization_name\}\.`\s*\n\s*\);/,
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

      setError("");
      setNotice(
        \`Reach started drafting for \${prospect.organization_name}. You can queue additional firms while it works.\`
      );`,
  "concurrent start state"
);

source = source.replace(
  /        setDraftTarget\(\s*\n\s*target\s*\n\s*\);\s*\n\s*\n\s*startDraftPolling\(/,
  `        startDraftPolling(`
);

mustReplaceRegex(
  /      \} catch \(caught\) \{\s*\n\s*setRunningProspectId\(\s*\n\s*null\s*\n\s*\);/,
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
        ];`,
  "failed prospect unlock"
);

mustReplaceRegex(
  /    \[\s*\n\s*runningProspectId,\s*\n\s*startDraftPolling,\s*\n\s*\]\s*\n\s*\);/,
`    [
      runningProspectIds,
      startDraftPolling,
      workspace,
    ]
  );`,
  "runReach dependencies"
);

/*
|--------------------------------------------------------------------------
| 5) RECONCILE COMPLETED DRAFTS WITHOUT AUTO-OPENING THEM
|--------------------------------------------------------------------------
*/

if (!source.includes("!hasActiveDraftForProspect(\n              workspace,\n              prospectId")) {
  mustReplaceRegex(
    /  useEffect\(\(\) => \{\s*\n\s*const clickHandler =/,
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
    const clickHandler =`,
    "completed-draft lock reconciliation"
  );
}

/*
|--------------------------------------------------------------------------
| 6) CARD BUTTONS: EACH FIRM CONTROLS ITSELF
|--------------------------------------------------------------------------
*/

mustReplaceRegex(
  /                    const isRunning =\s*\n\s*runningProspectId ===\s*\n\s*prospect\.id;/,
`                    const isRunning =
                      runningProspectIds.includes(
                        prospect.id
                      );

                    const hasActiveDraft =
                      hasActiveDraftForProspect(
                        workspace,
                        prospect.id
                      );`,
  "card-level draft state"
);

mustReplaceRegex(
  /                            disabled=\{\s*\n\s*!hasEmail \|\|\s*\n\s*Boolean\(\s*\n\s*runningProspectId\s*\n\s*\)\s*\n\s*\}/,
`                            disabled={
                              !hasEmail ||
                              isRunning ||
                              hasActiveDraft
                            }`,
  "card-level button lock"
);

mustReplaceRegex(
  /                            \{isRunning\s*\n\s*\? "Drafting…"\s*\n\s*: "Draft Email"\}/,
`                            {isRunning
                              ? "Drafting…"
                              : hasActiveDraft
                              ? "Draft Ready"
                              : "Draft Email"}`,
  "draft button labels"
);

/*
|--------------------------------------------------------------------------
| 7) NO AUTO-OPEN WHEN DRAFT FINISHES
|--------------------------------------------------------------------------
|
| The new poller never calls setSelectedDraft(draft).
| Drafts simply appear in the right-side Reach Drafts queue.
|--------------------------------------------------------------------------
*/

fs.writeFileSync(file, source, "utf8");

console.log(
  "Applied Reach batch-drafts FIXED patch."
);

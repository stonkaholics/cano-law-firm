import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rel = "app/personal-injury/ReachWorkstation.tsx";
const file = path.join(root, rel);

let source = fs.readFileSync(file, "utf8");

/*
|--------------------------------------------------------------------------
| ROOT CAUSE
|--------------------------------------------------------------------------
|
| The batch patch itself was working:
| - multiple requests could be started
| - n8n finished
| - drafts were saved
|
| But this effect depended on runReach:
|
|   useEffect(..., [loadWorkspace, runReach, stopPolling])
|
| Every time runningProspectIds changed, runReach was recreated.
| React then ran the effect cleanup, and that cleanup called stopPolling().
|
| Result:
| - shared poller died almost immediately
| - cards stayed stuck on Drafting...
| - drafts appeared only after manually clicking Refresh
|
| Fix:
| - document click-handler cleanup ONLY removes the listener
| - it no longer kills the active draft poller
| - add a separate true-unmount cleanup for the poller
|--------------------------------------------------------------------------
*/

const cleanupWithStop = `    return () => {
      document.removeEventListener(
        "click",
        clickHandler,
        true
      );
      stopPolling();
    };
  }, [
    loadWorkspace,
    runReach,
    stopPolling,
  ]);`;

const cleanupWithoutStop = `    return () => {
      document.removeEventListener(
        "click",
        clickHandler,
        true
      );
    };
  }, [
    loadWorkspace,
    runReach,
  ]);`;

if (source.includes(cleanupWithStop)) {
  source = source.replace(
    cleanupWithStop,
    cleanupWithoutStop
  );
  console.log(
    "Reach click-handler no longer kills batch poller: patched"
  );
} else if (
  source.includes(
    `document.removeEventListener(
        "click",
        clickHandler,
        true
      );
      stopPolling();`
  )
) {
  source = source.replace(
    `document.removeEventListener(
        "click",
        clickHandler,
        true
      );
      stopPolling();`,
    `document.removeEventListener(
        "click",
        clickHandler,
        true
      );`
  );

  console.log(
    "Reach click-handler stopPolling removed with fallback anchor"
  );
} else {
  console.log(
    "Reach click-handler already appears safe"
  );
}

/*
|--------------------------------------------------------------------------
| TRUE COMPONENT UNMOUNT CLEANUP
|--------------------------------------------------------------------------
|
| stopPolling is stable (useCallback with []), so this effect runs once and
| only clears the interval if the Reach bridge itself is actually unmounted.
|--------------------------------------------------------------------------
*/

const unmountCleanup = `  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [
    stopPolling,
  ]);

`;

if (
  !source.includes(
    `return () => {
      stopPolling();
    };
  }, [
    stopPolling,
  ]);`
  )
) {
  const approvedAnchor =
    `  const approvedProspects =
    useMemo(() => {`;

  if (!source.includes(approvedAnchor)) {
    throw new Error(
      "Reach auto-refresh fix: approvedProspects anchor not found"
    );
  }

  source = source.replace(
    approvedAnchor,
    `${unmountCleanup}${approvedAnchor}`
  );

  console.log(
    "Reach true-unmount poller cleanup: added"
  );
}

/*
|--------------------------------------------------------------------------
| POLLING HEALTH / UX
|--------------------------------------------------------------------------
|
| Keep the interval alive while ANY draft target remains in flight.
| When all targets are resolved, the batch poller already stops itself.
|--------------------------------------------------------------------------
*/

fs.writeFileSync(
  file,
  source,
  "utf8"
);

console.log(
  "Applied Reach batch auto-refresh fix. Drafts should now appear automatically without clicking Refresh."
);

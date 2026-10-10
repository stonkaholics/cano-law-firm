import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(
  process.cwd(),
  "app",
  "personal-injury",
  "page.tsx"
);

if (!fs.existsSync(pagePath)) {
  throw new Error(
    "Pulse pipeline tracker V2 fix: page.tsx not found."
  );
}

let source =
  fs.readFileSync(
    pagePath,
    "utf8"
  );

const marker =
  "PULSE_PIPELINE_TRACKER_V2_FIX";

/*
|--------------------------------------------------------------------------
| The V1 patch made reportResearchTasks required on LeadEngine.
| There are multiple LeadEngine render locations on the page.
| Add the prop to EVERY render that still does not have it.
|--------------------------------------------------------------------------
*/

const anchor =
`            incidentSources={workspace.incidentSources}
            searchTerm={searchTerm}`;

const replacement =
`            incidentSources={workspace.incidentSources}
            reportResearchTasks={workspace.reportResearchTasks || []}
            searchTerm={searchTerm}`;

const indentedAnchor =
`                  incidentSources={workspace.incidentSources}
                  searchTerm={searchTerm}`;

const indentedReplacement =
`                  incidentSources={workspace.incidentSources}
                  reportResearchTasks={workspace.reportResearchTasks || []}
                  searchTerm={searchTerm}`;

let changed = false;

if (
  source.includes(anchor)
) {
  source =
    source.split(anchor)
      .join(replacement);

  changed = true;
}

if (
  source.includes(
    indentedAnchor
  )
) {
  source =
    source.split(
      indentedAnchor
    )
      .join(
        indentedReplacement
      );

  changed = true;
}

/*
|--------------------------------------------------------------------------
| Defensive verification:
| Every <LeadEngine> block must contain reportResearchTasks.
|--------------------------------------------------------------------------
*/

const starts = [];
let index = 0;

while (
  (
    index =
      source.indexOf(
        "<LeadEngine",
        index
      )
  ) !== -1
) {
  starts.push(index);
  index += 11;
}

for (
  let i = 0;
  i < starts.length;
  i++
) {
  const start =
    starts[i];

  const end =
    source.indexOf(
      "/>",
      start
    );

  if (end === -1) {
    throw new Error(
      "Pulse pipeline tracker V2 fix: could not find closing /> for LeadEngine #" +
      (i + 1)
    );
  }

  const block =
    source.slice(
      start,
      end + 2
    );

  if (
    !block.includes(
      "reportResearchTasks="
    )
  ) {
    throw new Error(
      "Pulse pipeline tracker V2 fix: LeadEngine #" +
      (i + 1) +
      " is still missing reportResearchTasks."
    );
  }
}

if (
  !source.includes(
    marker
  )
) {
  source =
    source.replace(
      `function LeadEngine({`,
      `/* ${marker} */\nfunction LeadEngine({`
    );
}

fs.writeFileSync(
  pagePath,
  source,
  "utf8"
);

console.log(
  "Pulse pipeline tracker V2 fix complete. Verified " +
  starts.length +
  " LeadEngine render(s)."
);

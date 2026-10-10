import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, value) {
  fs.writeFileSync(path.join(root, rel), value, "utf8");
}

const rel = "app/personal-injury/page.tsx";
let source = read(rel);

/*
|--------------------------------------------------------------------------
| WHY THE PREVIOUS BUILD FAILED
|--------------------------------------------------------------------------
|
| Pulse Phase 2 added three REQUIRED LeadEngine props:
|   onRunRecords
|   onRunTrace
|   onRunSentinel
|
| The page has TWO LeadEngine renders:
|   1. the main Leads tab
|   2. the Pulse workstation modal
|
| The first patch wired the workstation render but missed the main Leads-tab
| render. TypeScript therefore rejected the build because that LeadEngine
| instance was missing the three required props.
|
| This patch wires the main Leads-tab render too.
|--------------------------------------------------------------------------
*/

if (!source.includes('requestedFrom: "lead_engine"')) {
  throw new Error(
    "Pulse Phase 2 build fix: could not find the main LeadEngine render."
  );
}

const mainLeadAnchor = `            onResearchIncident={(incidentId) =>
              runPiAgent("pulse", {
                mode: "research_incident",
                incidentId,
                requestedFrom: "lead_engine",
              })
            }`;

const mainLeadReplacement = `${mainLeadAnchor}
            onRunRecords={(incidentId) =>
              runPiAgent("records", {
                incidentId,
                mode: "records_official_lookup",
                requestedFrom: "lead_engine",
              })
            }
            onRunTrace={(incidentId) =>
              runPiAgent("trace", {
                incidentId,
                mode: "trace_identity_contact",
                requestedFrom: "lead_engine",
              })
            }
            onRunSentinel={(incidentId) =>
              runPiAgent("sentinel", {
                incidentId,
                mode: "sentinel_accident_review",
                requestedFrom: "lead_engine",
              })
            }`;

if (source.includes('requestedFrom: "lead_engine",\n              })\n            }\n            onRunRecords=')) {
  console.log("Main LeadEngine specialist callbacks: already patched");
} else if (source.includes(mainLeadAnchor)) {
  source = source.replace(mainLeadAnchor, mainLeadReplacement);
  console.log("Main LeadEngine specialist callbacks: patched");
} else {
  throw new Error(
    "Pulse Phase 2 build fix: main LeadEngine onResearchIncident anchor not found."
  );
}

/*
|--------------------------------------------------------------------------
| KEEP SPECIALIST DESKS INSIDE THE ACCIDENT ENGINE
|--------------------------------------------------------------------------
|
| If Records / Trace / Sentinel are clicked from the visual floor, they should
| open the same accident intelligence engine as Pulse instead of falling into
| the generic compliance workstation.
|--------------------------------------------------------------------------
*/

source = source.replace(
  `              ) : ["pulse", "intake"].includes(selectedAgent.id) ? (`,
  `              ) : ["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id) ? (`
);

/*
|--------------------------------------------------------------------------
| SPECIALIST RUN BUTTON
|--------------------------------------------------------------------------
|
| The generic workstation Run button sends manual_<id>_run. For the three new
| accident specialists, use the actual Pulse modes so n8n's Which Pulse Mode?
| switch receives something useful.
|--------------------------------------------------------------------------
*/

const genericRun = `                        ? undefined
                      : runPiAgent(selectedAgent.id as any, {
                          mode: \`manual_\${selectedAgent.id}_run\`,
                          geography: "Florida",
                          requestedFrom: "agent_workstation",
                        })`;

const specialistRun = `                        ? undefined
                      : runPiAgent(selectedAgent.id as any, {
                          mode:
                            selectedAgent.id === "records"
                              ? "records_official_lookup"
                              : selectedAgent.id === "trace"
                              ? "trace_identity_contact"
                              : selectedAgent.id === "sentinel"
                              ? "sentinel_accident_review"
                              : \`manual_\${selectedAgent.id}_run\`,
                          geography: "Florida",
                          requestedFrom: "agent_workstation",
                        })`;

if (source.includes(genericRun)) {
  source = source.replace(genericRun, specialistRun);
  console.log("Specialist workstation run modes: patched");
} else {
  console.log("Specialist workstation run modes: anchor already changed; skipped safely");
}

write(rel, source);

console.log(
  "Applied Pulse Phase 2 build-fail fix: both LeadEngine renders are now fully wired."
);

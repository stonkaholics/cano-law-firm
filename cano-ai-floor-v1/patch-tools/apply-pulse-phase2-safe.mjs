import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, value) {
  fs.writeFileSync(path.join(root, rel), value, "utf8");
}

function insertAfter(source, anchor, insertion, label) {
  if (source.includes(insertion.trim())) {
    console.log(`${label}: already present`);
    return source;
  }
  const i = source.indexOf(anchor);
  if (i < 0) {
    console.log(`${label}: anchor not found, skipped safely`);
    return source;
  }
  console.log(`${label}: patched`);
  return (
    source.slice(0, i + anchor.length) +
    insertion +
    source.slice(i + anchor.length)
  );
}

/* =========================================================
   API ROUTING
   ========================================================= */

{
  const rel = "app/api/pi/agents/run/route.ts";
  let source = read(rel);

  if (!source.includes('"records"')) {
    source = source.replace(
      `"pulse",`,
      `"pulse",
    "records",
    "trace",
    "sentinel",`
    );
  }

  if (!source.includes("const pulseSpecialistMode")) {
    const anchor = `    const requestPayload =
      cleanObject(
        body?.request
      );`;

    const insertion = `

    const pulseSpecialistMode: Record<string, string> = {
      records: "records_official_lookup",
      trace: "trace_identity_contact",
      sentinel: "sentinel_accident_review",
    };

    const isPulseSpecialist =
      ["records", "trace", "sentinel"].includes(agentId);

    const routedAgentId =
      isPulseSpecialist
        ? "pulse"
        : agentId;

    const routedRequest =
      isPulseSpecialist
        ? {
            ...requestPayload,
            specialistAgent: agentId,
            mode:
              String(requestPayload?.mode || "").trim() ||
              pulseSpecialistMode[agentId],
          }
        : requestPayload;`;

    source = insertAfter(
      source,
      anchor,
      insertion,
      "Pulse specialist API routing"
    );
  }

  if (source.includes(`      agentId,

      request:
        normalizedRequest,`)) {
    source = source.replace(
      `      agentId,

      request:
        normalizedRequest,`,
      `      agentId:
        typeof routedAgentId !== "undefined"
          ? routedAgentId
          : agentId,

      request:
        typeof routedRequest !== "undefined" &&
        ["records", "trace", "sentinel"].includes(agentId)
          ? routedRequest
          : normalizedRequest,`
    );
  }

  write(rel, source);
  console.log(`${rel}: safe Pulse specialist routing complete`);
}

/* =========================================================
   PAGE
   ========================================================= */

{
  const rel = "app/personal-injury/page.tsx";
  let source = read(rel);

  // Allow specialist IDs through the typed runner.
  if (!source.includes(`      | "records"`)) {
    source = source.replace(
      `      | "pulse"
      | "medintel"`,
      `      | "pulse"
      | "records"
      | "trace"
      | "sentinel"
      | "medintel"`
    );
  }

  // Keep these props OPTIONAL so a missed render can never break TypeScript again.
  if (!source.includes("onRunRecords?:")) {
    source = source.replace(
      `  onResearchIncident: (incidentId: string) => void;`,
      `  onResearchIncident: (incidentId: string) => void;
  onRunRecords?: (incidentId: string) => void;
  onRunTrace?: (incidentId: string) => void;
  onRunSentinel?: (incidentId: string) => void;`
    );
  }

  if (!source.includes("  onRunRecords,")) {
    source = source.replace(
      `  onResearchIncident,
}: {`,
      `  onResearchIncident,
  onRunRecords,
  onRunTrace,
  onRunSentinel,
}: {`
    );
  }

  // If an earlier failed attempt made these required, downgrade them back to optional.
  source = source
    .replace(
      `  onRunRecords: (incidentId: string) => void;`,
      `  onRunRecords?: (incidentId: string) => void;`
    )
    .replace(
      `  onRunTrace: (incidentId: string) => void;`,
      `  onRunTrace?: (incidentId: string) => void;`
    )
    .replace(
      `  onRunSentinel: (incidentId: string) => void;`,
      `  onRunSentinel?: (incidentId: string) => void;`
    );

  // Add basic specialist metrics safely.
  if (!source.includes("const identityResolvedCount")) {
    const anchor = `  const readySources = incidentSources.filter(
    (source) => source.status === "ready"
  ).length;`;

    const insertion = `

  const identityResolvedCount =
    incidentPeople.filter((person) =>
      Boolean(String(person.name || "").trim())
    ).length;

  const contactCandidateCount =
    incidentPeople.filter((person) =>
      Boolean(
        String(person.phone || "").trim() ||
        String(person.email || "").trim()
      )
    ).length;`;

    source = insertAfter(
      source,
      anchor,
      insertion,
      "Pulse Phase 2 metrics"
    );
  }

  // Add per-card controls only if the existing research action anchor is available.
  if (!source.includes("Run Records")) {
    const anchor = `            {intel ? "Refresh Intelligence" : isHistoricalIncident(incident) ? "Research Backfill" : "Research Incident"}
          </button>`;

    const insertion = `

          <button
            onClick={() => onRunRecords?.(incident.id)}
            disabled={Boolean(runningAgent) || !onRunRecords}
            title="Resolve official agency, report identifiers, filing/public status, and source provenance."
          >
            <FileSearch size={12} />
            Run Records
          </button>

          <button
            onClick={() => onRunTrace?.(incident.id)}
            disabled={
              Boolean(runningAgent) ||
              !onRunTrace ||
              !(identityKnown || reportAccessible || caseNumber || reportNumber)
            }
            title="Resolve verified party identity and source-traceable contact candidates."
          >
            <Search size={12} />
            Run Trace
          </button>

          <button
            onClick={() => onRunSentinel?.(incident.id)}
            disabled={
              Boolean(runningAgent) ||
              !onRunSentinel ||
              !contactKnown
            }
            title="Review provenance, identity/contact confidence, representation, and timing gates."
          >
            <ShieldCheck size={12} />
            Run Sentinel
          </button>`;

    source = insertAfter(
      source,
      anchor,
      insertion,
      "Pulse incident specialist controls"
    );
  }

  // Main Leads tab callbacks.
  if (
    source.includes('requestedFrom: "lead_engine"') &&
    !source.includes('requestedFrom: "lead_engine_records"')
  ) {
    const anchor = `            onResearchIncident={(incidentId) =>
              runPiAgent("pulse", {
                mode: "research_incident",
                incidentId,
                requestedFrom: "lead_engine",
              })
            }`;

    const insertion = `
            onRunRecords={(incidentId) =>
              runPiAgent("records", {
                incidentId,
                mode: "records_official_lookup",
                requestedFrom: "lead_engine_records",
              })
            }
            onRunTrace={(incidentId) =>
              runPiAgent("trace", {
                incidentId,
                mode: "trace_identity_contact",
                requestedFrom: "lead_engine_trace",
              })
            }
            onRunSentinel={(incidentId) =>
              runPiAgent("sentinel", {
                incidentId,
                mode: "sentinel_accident_review",
                requestedFrom: "lead_engine_sentinel",
              })
            }`;

    source = insertAfter(
      source,
      anchor,
      insertion,
      "Main LeadEngine specialist callbacks"
    );
  }

  // Pulse workstation callbacks.
  if (
    source.includes('requestedFrom: "pulse_workstation"') &&
    !source.includes('requestedFrom: "pulse_workstation_records"')
  ) {
    const anchor = `                  onResearchIncident={(incidentId) =>
                    runPiAgent("pulse", {
                      mode: "research_incident",
                      incidentId,
                      requestedFrom: "pulse_workstation",
                    })
                  }`;

    const insertion = `
                  onRunRecords={(incidentId) =>
                    runPiAgent("records", {
                      incidentId,
                      mode: "records_official_lookup",
                      requestedFrom: "pulse_workstation_records",
                    })
                  }
                  onRunTrace={(incidentId) =>
                    runPiAgent("trace", {
                      incidentId,
                      mode: "trace_identity_contact",
                      requestedFrom: "pulse_workstation_trace",
                    })
                  }
                  onRunSentinel={(incidentId) =>
                    runPiAgent("sentinel", {
                      incidentId,
                      mode: "sentinel_accident_review",
                      requestedFrom: "pulse_workstation_sentinel",
                    })
                  }`;

    source = insertAfter(
      source,
      anchor,
      insertion,
      "Pulse workstation specialist callbacks"
    );
  }

  // Keep all four accident-intelligence desks in the same engine.
  source = source.replace(
    `["pulse", "intake"].includes(selectedAgent.id)`,
    `["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id)`
  );

  // If Phase 1 already expanded it, this is a no-op.
  source = source.replace(
    `["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id)`,
    `["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id)`
  );

  // Add a lightweight pipeline explainer if absent.
  if (!source.includes("PULSE SPECIALIST PIPELINE")) {
    const anchor = `      <div className={styles.incidentWatchPanel}>`;

    const insertion = `      <div className={styles.pulsePipelinePanel}>
        <div className={styles.pulsePipelineHead}>
          <div>
            <span>PULSE SPECIALIST PIPELINE</span>
            <strong>Pulse → Records → Trace → Sentinel</strong>
          </div>
          <small>
            Official evidence unlocks identity research; verified contact candidates unlock Sentinel review.
          </small>
        </div>
        <div className={styles.pulsePipelineSteps}>
          <div><em>1</em><strong>Pulse</strong><span>Find and prioritize incident signals.</span></div>
          <div><em>2</em><strong>Records</strong><span>Resolve official reports, IDs, and source provenance.</span></div>
          <div><em>3</em><strong>Trace</strong><span>Resolve supported identities and contact candidates.</span></div>
          <div><em>4</em><strong>Sentinel</strong><span>Review provenance, confidence, representation, and timing gates.</span></div>
        </div>
      </div>

`;

    const i = source.indexOf(anchor);
    if (i >= 0) {
      source =
        source.slice(0, i) +
        insertion +
        source.slice(i);
      console.log("Pulse pipeline explainer: patched");
    } else {
      console.log("Pulse pipeline explainer: anchor not found, skipped safely");
    }
  }

  write(rel, source);
  console.log(`${rel}: safe Pulse Phase 2 page patch complete`);
}

/* =========================================================
   CSS
   ========================================================= */

{
  const rel = "app/personal-injury/personal-injury.module.css";
  let source = read(rel);

  if (!source.includes(".pulsePipelinePanel{") && !source.includes(".pulsePipelinePanel {")) {
    source += `

.pulsePipelinePanel{
  margin:0 0 12px;
  padding:12px;
  border:1px solid rgba(95,201,159,.12);
  border-radius:8px;
  background:linear-gradient(135deg,rgba(95,201,159,.025),rgba(94,169,255,.012));
}
.pulsePipelineHead{
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  margin-bottom:9px;
}
.pulsePipelineHead span{
  display:block;
  color:#69c6a3;
  font-size:7px;
  font-weight:900;
  letter-spacing:.09em;
}
.pulsePipelineHead strong{
  display:block;
  margin-top:3px;
  color:#d7e7e1;
  font-size:13px;
}
.pulsePipelineHead small{
  max-width:430px;
  color:#708e99;
  font-size:7px;
  line-height:1.45;
  text-align:right;
}
.pulsePipelineSteps{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:7px;
}
.pulsePipelineSteps>div{
  min-height:74px;
  padding:9px;
  border:1px solid rgba(124,166,189,.08);
  border-radius:7px;
  background:rgba(2,11,17,.38);
}
.pulsePipelineSteps em{
  display:grid;
  place-items:center;
  width:21px;
  height:21px;
  margin-bottom:6px;
  border:1px solid rgba(95,201,159,.16);
  border-radius:50%;
  color:#79cdaa;
  background:rgba(95,201,159,.025);
  font-size:7px;
  font-style:normal;
  font-weight:900;
}
.pulsePipelineSteps strong{
  display:block;
  color:#cfdee3;
  font-size:9px;
}
.pulsePipelineSteps span{
  display:block;
  margin-top:4px;
  color:#6d8995;
  font-size:7px;
  line-height:1.45;
}
.incidentResearchActions{
  flex-wrap:wrap;
}
.incidentResearchActions button{
  white-space:nowrap;
}
@media(max-width:900px){
  .pulsePipelineSteps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pulsePipelineHead{display:block}
  .pulsePipelineHead small{display:block;margin-top:5px;text-align:left}
}
@media(max-width:520px){
  .pulsePipelineSteps{grid-template-columns:1fr}
}
`;
  }

  write(rel, source);
  console.log(`${rel}: safe Pulse Phase 2 CSS complete`);
}

console.log("SAFE Pulse Phase 2 patch completed without brittle anchor failures.");

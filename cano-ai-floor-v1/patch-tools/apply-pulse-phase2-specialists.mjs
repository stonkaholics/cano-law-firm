import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function write(rel, value) {
  fs.writeFileSync(path.join(root, rel), value, "utf8");
}

// 1) API: allow Records / Trace / Sentinel desks while routing them through Pulse in n8n.
{
  const rel = "app/api/pi/agents/run/route.ts";
  let source = read(rel);

  if (!source.includes('"records",')) {
    source = source.replace(
      `    "pulse",\n    "beacon",`,
      `    "pulse",\n    "records",\n    "trace",\n    "sentinel",\n    "beacon",`
    );
  }

  if (!source.includes("const pulseSpecialistMode")) {
    const anchor = `    const requestPayload =\n      cleanObject(\n        body?.request\n      );`;
    const insertion = `${anchor}\n\n    const pulseSpecialistMode: Record<string, string> = {\n      records: "records_official_lookup",\n      trace: "trace_identity_contact",\n      sentinel: "sentinel_accident_review",\n    };\n\n    const routedAgentId =\n      ["records", "trace", "sentinel"].includes(agentId)\n        ? "pulse"\n        : agentId;\n\n    const specialistRequest =\n      ["records", "trace", "sentinel"].includes(agentId)\n        ? {\n            ...requestPayload,\n            specialistAgent: agentId,\n            mode:\n              String(requestPayload?.mode || "").trim() ||\n              pulseSpecialistMode[agentId],\n          }\n        : requestPayload;`;
    if (!source.includes(anchor)) throw new Error("Pulse Phase 2 API: requestPayload anchor not found");
    source = source.replace(anchor, insertion);
  }

  source = source.replace(
    `      agentId,\n\n      request:\n        normalizedRequest,`,
    `      agentId:\n        routedAgentId,\n\n      request:\n        ["records", "trace", "sentinel"].includes(agentId)\n          ? specialistRequest\n          : normalizedRequest,`
  );

  source = source.replace(
    `        agentId,\n        webhook:`,
    `        agentId,\n        routedAgentId,\n        webhook:`
  );

  source = source.replace(
    `        request:\n          normalizedRequest,`,
    `        request:\n          ["records", "trace", "sentinel"].includes(agentId)\n            ? specialistRequest\n            : normalizedRequest,`
  );

  source = source.replace(
    `          agentId === "scout"\n            ? "Scout accepted the job in Apollo test mode. The workflow is capped at 10 reserved Apollo calls per rolling hour."\n            : \`${agentId} accepted the job. The PI n8n brain is now processing it.\`,`,
    `          agentId === "scout"\n            ? "Scout accepted the job in Apollo test mode. The workflow is capped at 10 reserved Apollo calls per rolling hour."\n            : ["records", "trace", "sentinel"].includes(agentId)\n            ? \`${agentId} accepted the job through the Pulse specialist router.\`\n            : \`${agentId} accepted the job. The PI n8n brain is now processing it.\`,`
  );

  write(rel, source);
  console.log(`${rel}: specialist routing patched`);
}

// 2) page.tsx: specialist runs, stage metrics, per-incident controls and pipeline explainer.
{
  const rel = "app/personal-injury/page.tsx";
  let source = read(rel);

  source = source.replace(
    `      | "pulse"\n      | "medintel"`,
    `      | "pulse"\n      | "records"\n      | "trace"\n      | "sentinel"\n      | "medintel"`
  );

  if (!source.includes("onRunRecords:")) {
    source = source.replace(
      `  onEligibilityScan,\n  onResearchIncident,\n}: {`,
      `  onEligibilityScan,\n  onResearchIncident,\n  onRunRecords,\n  onRunTrace,\n  onRunSentinel,\n}: {`
    );
    source = source.replace(
      `  onEligibilityScan: () => void;\n  onResearchIncident: (incidentId: string) => void;\n}) {`,
      `  onEligibilityScan: () => void;\n  onResearchIncident: (incidentId: string) => void;\n  onRunRecords: (incidentId: string) => void;\n  onRunTrace: (incidentId: string) => void;\n  onRunSentinel: (incidentId: string) => void;\n}) {`
    );
  }

  if (!source.includes("const identityResolvedCount")) {
    const anchor = `  const readySources = incidentSources.filter(\n    (source) => source.status === "ready"\n  ).length;`;
    const insert = `${anchor}\n\n  const identityResolvedCount = incidentPeople.filter((person) => Boolean(String(person.name || "").trim())).length;\n  const contactCandidateCount = incidentPeople.filter((person) => Boolean(String(person.phone || "").trim() || String(person.email || "").trim())).length;\n  const incidentsWithContact = new Set(incidentPeople.filter((person) => Boolean(String(person.phone || "").trim() || String(person.email || "").trim())).map((person) => person.incident_id));\n  const sentinelReadyCount = incidents.filter((incident) => incidentsWithContact.has(incident.id) && incident.status !== "blocked" && incident.status !== "archived").length;`;
    if (!source.includes(anchor)) throw new Error("Pulse Phase 2 page: readySources anchor not found");
    source = source.replace(anchor, insert);
  }

  if (!source.includes("<span>IDENTITIES RESOLVED</span>")) {
    const anchor = `        <div className={styles.pulseSnapshotCard}>\n          <span>SOURCES READY</span>\n          <strong>\n            {readySources}/{incidentSources.length || 0}\n          </strong>\n          <small>public feeds online</small>\n        </div>`;
    const insert = `${anchor}\n        <div className={styles.pulseSnapshotCard}><span>IDENTITIES RESOLVED</span><strong>{identityResolvedCount}</strong><small>party records</small></div>\n        <div className={styles.pulseSnapshotCard}><span>CONTACT CANDIDATES</span><strong>{contactCandidateCount}</strong><small>phone / email candidates</small></div>\n        <div className={styles.pulseSnapshotCard}><span>SENTINEL READY</span><strong>{sentinelReadyCount}</strong><small>contact-bearing incidents</small></div>`;
    if (!source.includes(anchor)) throw new Error("Pulse Phase 2 page: snapshot anchor not found");
    source = source.replace(anchor, insert);
  }

  if (!source.includes("Run Records")) {
    const anchor = `        <div className={styles.incidentResearchActions}>\n          <button\n            onClick={() => onResearchIncident(incident.id)}\n            disabled={Boolean(runningAgent)}\n            title={isHistoricalIncident(incident) ? "Research this backfill incident and verify its source before any outreach decision" : "Build or refresh case intelligence for this incident"}\n          >\n            <FileSearch size={12} />\n            {intel ? "Refresh Intelligence" : isHistoricalIncident(incident) ? "Research Backfill" : "Research Incident"}\n          </button>`;
    const insert = `${anchor}\n\n          <button onClick={() => onRunRecords(incident.id)} disabled={Boolean(runningAgent)} title="Resolve official agency, report identifiers, filing/public status, and source provenance."><FileSearch size={12} />Run Records</button>\n\n          <button onClick={() => onRunTrace(incident.id)} disabled={Boolean(runningAgent) || !(identityKnown || reportAccessible || caseNumber || reportNumber)} title={identityKnown || reportAccessible || caseNumber || reportNumber ? "Resolve verified party identity and source-traceable contact candidates." : "Trace unlocks after Records resolves an identity-bearing source or report identifier."}><Search size={12} />Run Trace</button>\n\n          <button onClick={() => onRunSentinel(incident.id)} disabled={Boolean(runningAgent) || !contactKnown} title={contactKnown ? "Review provenance, contact confidence, representation and timing gates." : "Sentinel unlocks after Trace produces at least one contact candidate."}><ShieldCheck size={12} />Run Sentinel</button>`;
    if (!source.includes(anchor)) throw new Error("Pulse Phase 2 page: incident action anchor not found");
    source = source.replace(anchor, insert);
  }

  if (!source.includes("PULSE SPECIALIST PIPELINE")) {
    const anchor = `      <div className={styles.incidentWatchPanel}>`;
    const insert = `      <div className={styles.pulsePipelinePanel}>\n        <div className={styles.pulsePipelineHead}><div><span>PULSE SPECIALIST PIPELINE</span><strong>Incident → Records → Trace → Sentinel</strong></div><small>Each stage only unlocks when the prior stage has enough verified evidence.</small></div>\n        <div className={styles.pulsePipelineSteps}>\n          <div><em>1</em><strong>Pulse</strong><span>Find and prioritize public incident signals.</span></div>\n          <div><em>2</em><strong>Records</strong><span>Resolve official agency, report IDs, filing/access status, and source chain.</span></div>\n          <div><em>3</em><strong>Trace</strong><span>Resolve verified party identities and contact candidates with provenance.</span></div>\n          <div><em>4</em><strong>Sentinel</strong><span>Review source quality, identity/contact confidence, representation, and timing gates.</span></div>\n        </div>\n      </div>\n\n${anchor}`;
    if (!source.includes(anchor)) throw new Error("Pulse Phase 2 page: incidentWatchPanel anchor not found");
    source = source.replace(anchor, insert);
  }

  if (!source.includes("onRunRecords={(incidentId)")) {
    const anchor = `                  onResearchIncident={(incidentId) =>\n                    runPiAgent("pulse", {\n                      mode: "research_incident",\n                      incidentId,\n                      requestedFrom: "pulse_workstation",\n                    })\n                  }`;
    const insert = `${anchor}\n                  onRunRecords={(incidentId) => runPiAgent("records", { incidentId, mode: "records_official_lookup", requestedFrom: "records_workstation" })}\n                  onRunTrace={(incidentId) => runPiAgent("trace", { incidentId, mode: "trace_identity_contact", requestedFrom: "trace_workstation" })}\n                  onRunSentinel={(incidentId) => runPiAgent("sentinel", { incidentId, mode: "sentinel_accident_review", requestedFrom: "sentinel_workstation" })}`;
    if (!source.includes(anchor)) throw new Error("Pulse Phase 2 page: LeadEngine invocation anchor not found");
    source = source.replace(anchor, insert);
  }

  write(rel, source);
  console.log(`${rel}: Pulse Phase 2 specialist workflow patched`);
}

// 3) CSS
{
  const rel = "app/personal-injury/personal-injury.module.css";
  let source = read(rel);
  if (!source.includes(".pulsePipelinePanel {")) {
    source += `\n\n.pulsePipelinePanel{margin:0 0 12px;padding:12px;border:1px solid rgba(95,201,159,.12);border-radius:8px;background:linear-gradient(135deg,rgba(95,201,159,.025),rgba(94,169,255,.012))}.pulsePipelineHead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:9px}.pulsePipelineHead span{display:block;color:#69c6a3;font-size:6px;font-weight:900;letter-spacing:.09em}.pulsePipelineHead strong{display:block;margin-top:3px;color:#d7e7e1;font-size:11px}.pulsePipelineHead small{max-width:430px;color:#708e99;font-size:6.5px;line-height:1.45;text-align:right}.pulsePipelineSteps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pulsePipelineSteps>div{min-height:74px;padding:9px;border:1px solid rgba(124,166,189,.08);border-radius:7px;background:rgba(2,11,17,.38)}.pulsePipelineSteps em{display:grid;place-items:center;width:21px;height:21px;margin-bottom:6px;border:1px solid rgba(95,201,159,.16);border-radius:50%;color:#79cdaa;background:rgba(95,201,159,.025);font-size:6px;font-style:normal;font-weight:900}.pulsePipelineSteps strong{display:block;color:#cfdee3;font-size:8px}.pulsePipelineSteps span{display:block;margin-top:4px;color:#6d8995;font-size:6.3px;line-height:1.45}.incidentResearchActions{flex-wrap:wrap}.incidentResearchActions button{white-space:nowrap}@media(max-width:900px){.pulsePipelineSteps{grid-template-columns:repeat(2,minmax(0,1fr))}.pulsePipelineHead{display:block}.pulsePipelineHead small{display:block;margin-top:5px;text-align:left}}@media(max-width:520px){.pulsePipelineSteps{grid-template-columns:1fr}}\n`;
  }
  write(rel, source);
  console.log(`${rel}: Pulse Phase 2 styles patched`);
}

console.log("Applied Pulse Phase 2 full build.");

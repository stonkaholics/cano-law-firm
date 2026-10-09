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
| REFERRAL DESK ORDER
|--------------------------------------------------------------------------
| Scout -> Reach -> Guard -> Orbit
|
| Bridge is intentionally removed from the visual referral team because Scout
| already owns professional referral discovery + enrichment and Bridge was
| duplicating that function without a unique workstation.
|--------------------------------------------------------------------------
*/

const oldFilters =
`  const managerAgents = agents.filter((agent) => agent.zone === "manager");
  const growthAgents = agents.filter((agent) => agent.zone === "growth");
  const incidentAgents = agents.filter((agent) => agent.zone === "incident");`;

const newFilters =
`  const managerAgents = agents.filter((agent) => agent.zone === "manager");

  const referralAgentOrder = [
    "scout",
    "reach",
    "guard",
    "orbit",
  ];

  const growthAgents = agents
    .filter(
      (agent) =>
        agent.zone === "growth" &&
        referralAgentOrder.includes(agent.id)
    )
    .sort(
      (a, b) =>
        referralAgentOrder.indexOf(a.id) -
        referralAgentOrder.indexOf(b.id)
    );

  const incidentAgents = agents.filter((agent) => agent.zone === "incident");`;

if (source.includes(newFilters)) {
  console.log("Referral agent order: already patched");
} else if (source.includes(oldFilters)) {
  source = source.replace(oldFilters, newFilters);
  console.log("Referral agent order: patched");
} else {
  throw new Error("Referral agent order: expected filter anchor not found");
}

/*
|--------------------------------------------------------------------------
| REFERRAL NETWORK COPY
|--------------------------------------------------------------------------
*/

source = source.replace(
`Professional referral operations only: Scout and Bridge find firms, Reach drafts the introduction, Guard reviews referral outreach, and Orbit owns replies, meetings, and follow-up.`,
`Professional referral operations only: Scout finds and enriches firms, Reach drafts the introduction, Guard reviews referral outreach, and Orbit owns replies, meetings, and follow-up.`
);

source = source.replace(
`kicker="SCOUT · OUTREACH · QA · FOLLOW-UP"`,
`kicker="DISCOVERY · OUTREACH · QA · FOLLOW-UP"`
);

/*
|--------------------------------------------------------------------------
| PROFESSIONAL REFERRAL ENGINE LABEL
|--------------------------------------------------------------------------
*/

source = source.replace(
`<span className={styles.panelEyebrow}>SCOUT + BRIDGE</span>`,
`<span className={styles.panelEyebrow}>SCOUT · PROFESSIONAL REFERRAL DISCOVERY</span>`
);

source = source.replace(
`Build repeatable lawyer-to-lawyer and professional relationships.
            Discovery and enrichment can be automated; outreach remains
            approval-gated.`,
`Build repeatable lawyer-to-lawyer and professional relationships.
            Scout owns discovery, firm research, and contact enrichment.
            Reach, Guard, and Orbit take over after a prospect is approved.`
);

/*
|--------------------------------------------------------------------------
| BRIDGE WORKSTATION CLEANUP
|--------------------------------------------------------------------------
| Keep the Bridge definition in code for backwards compatibility with old links
| or historical state, but no longer render it as a desk and do not route it to
| Scout's workstation.
|--------------------------------------------------------------------------
*/

source = source.replace(
`{["scout", "bridge", "reach", "guard", "orbit"].includes(selectedAgent.id) ? (`,
`{["scout", "reach", "guard", "orbit"].includes(selectedAgent.id) ? (`
);

write(rel, source);

console.log(
  "Applied referral desk order + Bridge cleanup. Visual order is Scout -> Reach -> Guard -> Orbit."
);

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
    throw new Error(`${label}: anchor not found`);
  }

  console.log(`${label}: patched`);
  return source.replace(oldValue, newValue);
}

const rel = "app/personal-injury/page.tsx";
let source = read(rel);

/*
|--------------------------------------------------------------------------
| 1) AGENT ZONES
|--------------------------------------------------------------------------
*/

source = replaceOnce(
  source,
`  zone: "manager" | "growth" | "accidents" | "nursing" | "wrongful";`,
`  zone:
    | "manager"
    | "growth"
    | "incident"
    | "support"
    | "accidents"
    | "nursing"
    | "wrongful";`,
  "PI agent zone types"
);

/*
|--------------------------------------------------------------------------
| 2) MANAGERS STAY FLOOR-WIDE; GUARD BECOMES REFERRAL-ONLY
|--------------------------------------------------------------------------
*/

source = source.replace(
`    role: "Compliance & Quality Manager",
    shortRole: "Compliance + QA",
    description:
      "Maintains human-approval gates, marketing and solicitation controls, source-traceability expectations, and quality-review flags across the PI floor.",
    zone: "manager",
    icon: ShieldCheck,
    capabilities: [
      "Human-approval gates",
      "Marketing and solicitation review",
      "Source-traceability checks",
      "Missing-input detection",
      "Quality and compliance escalation",
    ],
    output: [
      "Compliance queue",
      "Quality review flags",
      "Blocked actions",
      "Attorney approval status",
    ],`,
`    role: "Referral Outreach Guard",
    shortRole: "Compliance + QA",
    description:
      "Reviews professional referral outreach only. Guard checks Reach drafts for source integrity, unsupported claims, sender identity, tone, and approval status before a human allows an email to send.",
    zone: "growth",
    icon: ShieldCheck,
    capabilities: [
      "Review Reach referral drafts",
      "Check unsupported recipient claims",
      "Check source and contact provenance",
      "Check professional tone and sender identity",
      "Preserve human approval gates",
    ],
    output: [
      "Referral outreach review",
      "Required Reach edits",
      "Approval recommendation",
      "Human decision status",
    ],`
);

/*
|--------------------------------------------------------------------------
| 3) PULSE BECOMES ACCIDENT INTELLIGENCE COORDINATOR
|--------------------------------------------------------------------------
*/

source = source.replace(
`    role: "Lead Operations Manager",
    shortRole: "Lead Ops",
    description:
      "Owns the inbound PI lead queue from calls, forms, advertising, directories, referrals, public incident intelligence, and future integrations.",
    zone: "growth",
    icon: HeartPulse,
    capabilities: [
      "Deduplicate leads",
      "Prioritize response speed",
      "Track source attribution",
      "Route qualified leads by practice area",
      "Coordinate incident-intelligence research",
    ],
    output: [
      "Lead queue",
      "Qualification status",
      "Source attribution",
      "Practice-area routing",
    ],`,
`    role: "Accident Intelligence Coordinator",
    shortRole: "Incident Intel",
    description:
      "Owns public accident intelligence from first incident signal through official-record research, identity resolution, contact provenance, solicitation timing, and handoff to accident-specific compliance review.",
    zone: "incident",
    icon: HeartPulse,
    capabilities: [
      "Coordinate live accident source monitoring",
      "Normalize incident and official-record intelligence",
      "Prioritize incidents for deeper research",
      "Coordinate identity and contact resolution",
      "Track solicitation and report-access timing",
    ],
    output: [
      "Accident intelligence queue",
      "Official-record status",
      "Identity resolution status",
      "Contact-resolution queue",
    ],`
);

/*
|--------------------------------------------------------------------------
| 4) NON-REFERRAL GROWTH UTILITIES REMAIN AVAILABLE BUT LEAVE THE DESK GROUP
|--------------------------------------------------------------------------
*/

for (const id of [
  "intake",
  "beacon",
  "radar",
  "launch",
  "ledger",
]) {
  const marker = `    id: "${id}",`;
  const idx = source.indexOf(marker);

  if (idx < 0) continue;

  const next = source.indexOf(
    `  },`,
    idx
  );

  if (next < 0) continue;

  const block =
    source.slice(
      idx,
      next + 4
    );

  const changed =
    block.replace(
      `    zone: "growth",`,
      `    zone: "support",`
    );

  source =
    source.slice(0, idx) +
    changed +
    source.slice(next + 4);
}

/*
|--------------------------------------------------------------------------
| 5) ADD ACCIDENT-INTELLIGENCE SPECIALISTS USED BY PULSE
|--------------------------------------------------------------------------
*/

if (!source.includes(`id: "records"`)) {
  const anchor =
`  {
    id: "intake",`;

  if (!source.includes(anchor)) {
    throw new Error(
      "Incident specialists: intake anchor not found"
    );
  }

  const incidentAgents = `  {
    id: "records",
    name: "Records",
    role: "Official Accident Records Specialist",
    shortRole: "Official Records",
    description:
      "Works behind Pulse to resolve the investigating agency, report identifiers, report availability, filing dates, and source provenance from supported public and official systems.",
    zone: "incident",
    icon: FileSearch,
    capabilities: [
      "Resolve investigating agency",
      "Resolve crash and case identifiers",
      "Track report filing and access dates",
      "Preserve source provenance",
      "Flag unresolved official-record gaps",
    ],
    output: [
      "Official-record identity",
      "Report access status",
      "Agency/source chain",
      "Missing-record queue",
    ],
    status: "review",
    runnable: false,
  },
  {
    id: "trace",
    name: "Trace",
    role: "Identity & Contact Resolution Specialist",
    shortRole: "Identity + Contact",
    description:
      "Turns verified accident-party identities into source-traceable contact candidates. Trace never guesses a person or treats an unsupported same-name match as verified.",
    zone: "incident",
    icon: Search,
    capabilities: [
      "Resolve party identities",
      "Compare public identity evidence",
      "Organize phone and email candidates",
      "Score identity and contact confidence",
      "Preserve contact-source provenance",
    ],
    output: [
      "Identity candidates",
      "Contact candidates",
      "Confidence classification",
      "Provenance chain",
    ],
    status: "review",
    runnable: false,
  },
  {
    id: "sentinel",
    name: "Sentinel",
    role: "Accident Research & Outreach Gatekeeper",
    shortRole: "Accident QA",
    description:
      "Keeps accident research separate from referral Guard. Sentinel checks source provenance, identity confidence, contact confidence, representation flags, report-access timing, and solicitation timing before any accident record can become actionable.",
    zone: "incident",
    icon: ShieldCheck,
    capabilities: [
      "Verify accident source provenance",
      "Review identity/contact confidence",
      "Track representation flags",
      "Track report and solicitation gates",
      "Block unsupported or premature outreach",
    ],
    output: [
      "Accident research review",
      "Blocked-action reasons",
      "Contact verification status",
      "Human-review queue",
    ],
    status: "review",
    runnable: false,
  },

${anchor}`;

  source = source.replace(
    anchor,
    incidentAgents
  );
}

/*
|--------------------------------------------------------------------------
| 6) FLOOR FILTERS + THREE CLEAR OPERATING LANES
|--------------------------------------------------------------------------
*/

source = replaceOnce(
  source,
`  const managerAgents = agents.filter((agent) => agent.zone === "manager");
  const growthAgents = agents.filter((agent) => agent.zone === "growth");
  const accidentAgents = agents.filter((agent) => agent.zone === "accidents");`,
`  const managerAgents = agents.filter((agent) => agent.zone === "manager");
  const growthAgents = agents.filter((agent) => agent.zone === "growth");
  const incidentAgents = agents.filter((agent) => agent.zone === "incident");
  const accidentAgents = agents.filter((agent) => agent.zone === "accidents");`,
  "agent department filters"
);

source = source.replace(
`              title="Managers"
              kicker="COMMAND · STRATEGY · QA · COORDINATION"
              description="Cross-practice leadership for workflow coordination, case strategy, compliance, quality control, and attorney decision support."`,
`              title="Managers"
              kicker="COMMAND · STRATEGY · COORDINATION"
              description="Floor-wide leadership for PI operations, workflow coordination, case strategy, priorities, and attorney decision support. Referral and accident compliance now live with their own specialist teams."`
);

source = source.replace(
`              title="Growth & Intake"
              kicker="ACQUISITION · REFERRALS · QUALIFICATION · CONVERSION"
              description="Gets the right matters into the firm, classifies them, routes them to the correct practice team, and measures what actually produces signed cases."`,
`              title="Referral Network"
              kicker="SCOUT · OUTREACH · QA · FOLLOW-UP"
              description="Professional referral operations only: Scout and Bridge find firms, Reach drafts the introduction, Guard reviews referral outreach, and Orbit owns replies, meetings, and follow-up."`
);

const referralDepartment =
`            <FloorDepartment
              title="Referral Network"
              kicker="SCOUT · OUTREACH · QA · FOLLOW-UP"
              description="Professional referral operations only: Scout and Bridge find firms, Reach drafts the introduction, Guard reviews referral outreach, and Orbit owns replies, meetings, and follow-up."
              agents={growthAgents}
              onOpen={setSelectedAgent}
              tone="growth"
            />`;

if (
  source.includes(referralDepartment) &&
  !source.includes(
    `title="Accident Intelligence"`
  )
) {
  source = source.replace(
    referralDepartment,
`${referralDepartment}

            <FloorDepartment
              title="Accident Intelligence"
              kicker="INCIDENTS · OFFICIAL RECORDS · IDENTITY · CONTACT · QA"
              description="Pre-matter accident research only. Pulse coordinates incident discovery, Records resolves official sources, Trace resolves identities and contact candidates, and Sentinel controls provenance and timing gates."
              agents={incidentAgents}
              onOpen={setSelectedAgent}
              tone="incident"
            />`
  );
}

/*
|--------------------------------------------------------------------------
| 7) FLOOR DEPARTMENT TONE
|--------------------------------------------------------------------------
*/

source = source.replace(
`  tone: "manager" | "growth" | "accidents" | "nursing" | "wrongful";`,
`  tone:
    | "manager"
    | "growth"
    | "incident"
    | "accidents"
    | "nursing"
    | "wrongful";`
);

source = source.replace(
`          : tone === "accidents"
          ? styles.departmentAccidents`,
`          : tone === "incident"
          ? styles.departmentIncident
          : tone === "accidents"
          ? styles.departmentAccidents`
);

/*
|--------------------------------------------------------------------------
| 8) WORKSTATION ROUTING
|--------------------------------------------------------------------------
*/

source = source.replace(
`{["scout", "bridge", "reach", "orbit"].includes(selectedAgent.id) ? (`,
`{["scout", "bridge", "reach", "guard", "orbit"].includes(selectedAgent.id) ? (`
);

source = source.replace(
`} : ["pulse", "intake"].includes(selectedAgent.id) ? (`,
`} : ["pulse", "records", "trace", "sentinel", "intake"].includes(selectedAgent.id) ? (`
);

/*
|--------------------------------------------------------------------------
| 9) REFERRAL GUARD IS SEPARATE FROM ACCIDENT SENTINEL
|--------------------------------------------------------------------------
*/

source = source.replace(
`          <ComplianceCenter
            incidents={workspace.incidents}
            outreach={workspace.outreach}`,
`          <ComplianceCenter
            incidents={[]}
            outreach={workspace.outreach}`
);

source = source.replace(
`            Compliance Center`,
`            Referral Guard`
);

/*
|--------------------------------------------------------------------------
| 10) PULSE PHASE 1 — NORMALIZED INCIDENT / PERSON / CONTACT DISPLAY
|--------------------------------------------------------------------------
*/

source = source.replace(
`          <span className={styles.panelEyebrow}>PULSE + INTAKE + LEDGER</span>
          <h2>Inbound PI Lead Engine</h2>
          <p>
            One queue for calls, forms, Google Ads, Meta, directories, and
            professional referrals. The goal is response speed, qualification,
            attribution, and signed-case conversion.
          </p>`,
`          <span className={styles.panelEyebrow}>PULSE + RECORDS + TRACE + SENTINEL</span>
          <h2>Accident Intelligence Engine</h2>
          <p>
            Turn public incident signals into source-traceable accident intelligence:
            official records first, then verified party identity, then contact candidates,
            then accident-specific compliance review. Research can happen before an
            outreach window opens; outreach remains separately gated.
          </p>`
);

source = source.replace(
`            title="Recheck incident aging windows and refresh the Guard review queue"`,
`            title="Recheck incident aging windows and refresh the Sentinel review queue"`
);

source = source.replace(
`          <span>PULSE + GUARD · INCIDENT WATCH</span>`,
`          <span>PULSE + SENTINEL · INCIDENT WATCH</span>`
);

source = source.replace(
`              gates have passed and Guard approves the communication.`,
`              gates have passed and Sentinel clears the accident record for human review.`
);

source = source.replace(
`<small>prepare Guard review</small>`,
`<small>prepare Sentinel review</small>`
);

source = source.replace(
`source provenance must be verified before Guard can treat it as an operational outreach candidate.`,
`source provenance must be verified before Sentinel can treat it as an operational candidate.`
);

source = source.replace(
`outreach still requires Guard review`,
`outreach still requires Sentinel + human review`
);

source = source.replace(
`          <span>GUARD HANDOFF</span>
              <h4>Review Queue</h4>
              <p>Compliance review queue generated from real live incidents only.</p>`,
`          <span>SENTINEL HANDOFF</span>
              <h4>Accident Review Queue</h4>
              <p>Accident-specific provenance, identity, contact, representation, and timing review generated from real incident records only.</p>`
);

source = source.replace(
`                  <strong>No live incidents are due for Guard review yet.</strong>`,
`                  <strong>No live incidents are due for Sentinel review yet.</strong>`
);

/*
|--------------------------------------------------------------------------
| 11) CONTACT QUALITY HELPERS
|--------------------------------------------------------------------------
*/

if (
  !source.includes(
    "const accidentContactConfidence ="
  )
) {
  const helperAnchor =
`  const boolFromMeta = (value: any) => value === true || value === "true" || value === 1;`;

  if (!source.includes(helperAnchor)) {
    throw new Error(
      "Pulse Phase 1: boolFromMeta anchor not found"
    );
  }

  const helpers = `${helperAnchor}

  const accidentContactConfidence = (
    person: IncidentPerson
  ) => {
    const meta =
      person.metadata || {};

    const raw =
      meta.contact_confidence ??
      meta.contactConfidence ??
      meta.confidence ??
      meta.match_confidence ??
      meta.matchConfidence ??
      0;

    const value =
      Number(raw);

    return Number.isFinite(value)
      ? Math.max(
          0,
          Math.min(
            100,
            value <= 1
              ? value * 100
              : value
          )
        )
      : 0;
  };

  const accidentIdentityConfidence = (
    person: IncidentPerson
  ) => {
    const meta =
      person.metadata || {};

    const raw =
      meta.identity_confidence ??
      meta.identityConfidence ??
      meta.person_confidence ??
      meta.personConfidence ??
      0;

    const value =
      Number(raw);

    return Number.isFinite(value)
      ? Math.max(
          0,
          Math.min(
            100,
            value <= 1
              ? value * 100
              : value
          )
        )
      : 0;
  };

  const accidentContactQuality = (
    person: IncidentPerson
  ) => {
    const hasMethod =
      Boolean(
        person.phone ||
        person.email
      );

    if (!hasMethod) {
      return "IDENTITY ONLY";
    }

    const confidence =
      accidentContactConfidence(
        person
      );

    if (confidence >= 85) {
      return "VERIFIED";
    }

    if (confidence >= 65) {
      return "LIKELY";
    }

    return "UNVERIFIED";
  };`;

  source = source.replace(
    helperAnchor,
    helpers
  );
}

/*
|--------------------------------------------------------------------------
| 12) PERSON / CONTACT RESOLUTION PANEL ON EACH INCIDENT
|--------------------------------------------------------------------------
*/

if (
  !source.includes(
    "styles.incidentPeoplePanel"
  )
) {
  const datesAnchor =
`        <div className={styles.incidentDates}>`;

  if (!source.includes(datesAnchor)) {
    throw new Error(
      "Pulse Phase 1: incident dates anchor not found"
    );
  }

  const peoplePanel = `        {!compact ? (
          <div className={styles.incidentPeoplePanel}>
            <div className={styles.incidentPeopleHead}>
              <div>
                <span>IDENTITY + CONTACT RESOLUTION</span>
                <strong>
                  {people.length
                    ? \`\${people.length} party record\${people.length === 1 ? "" : "s"}\`
                    : "No verified party identity yet"}
                </strong>
              </div>

              <em>
                {people.some(
                  (person) =>
                    person.phone ||
                    person.email
                )
                  ? "CONTACT CANDIDATES"
                  : "IDENTITY RESEARCH"}
              </em>
            </div>

            {people.length ? (
              <div className={styles.incidentPeopleList}>
                {people
                  .slice(0, 6)
                  .map((person) => {
                    const contactConfidence =
                      accidentContactConfidence(
                        person
                      );

                    const identityConfidence =
                      accidentIdentityConfidence(
                        person
                      );

                    const quality =
                      accidentContactQuality(
                        person
                      );

                    return (
                      <div
                        className={styles.incidentPersonRow}
                        key={person.id}
                      >
                        <div className={styles.incidentPersonIdentity}>
                          <strong>
                            {person.name ||
                              "Identity pending"}
                          </strong>
                          <span>
                            {person.role ||
                              "party role pending"}
                          </span>
                        </div>

                        <div className={styles.incidentPersonMethods}>
                          <span>
                            <Phone size={11} />
                            {person.phone ||
                              "No verified phone"}
                          </span>
                          <span>
                            <Mail size={11} />
                            {person.email ||
                              "No verified email"}
                          </span>
                        </div>

                        <div className={styles.incidentPersonSources}>
                          <span>
                            ID SOURCE
                            <strong>
                              {person.identity_source ||
                                "Not recorded"}
                            </strong>
                          </span>
                          <span>
                            CONTACT SOURCE
                            <strong>
                              {person.contact_source ||
                                "Not resolved"}
                            </strong>
                          </span>
                        </div>

                        <div className={styles.incidentPersonConfidence}>
                          <em
                            className={
                              quality === "VERIFIED"
                                ? styles.contactVerified
                                : quality === "LIKELY"
                                ? styles.contactLikely
                                : styles.contactUnverified
                            }
                          >
                            {quality}
                          </em>

                          <small>
                            Identity{" "}
                            {identityConfidence
                              ? \`\${Math.round(identityConfidence)}%\`
                              : "—"}
                            {" · "}
                            Contact{" "}
                            {contactConfidence
                              ? \`\${Math.round(contactConfidence)}%\`
                              : "—"}
                          </small>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className={styles.incidentPeopleEmpty}>
                <Search size={13} />
                <div>
                  <strong>
                    Trace has no verified identity to work from yet.
                  </strong>
                  <span>
                    Resolve the official report / party identity first. Contact enrichment should never begin from an unsupported same-name guess.
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : null}

${datesAnchor}`;

  source = source.replace(
    datesAnchor,
    peoplePanel
  );
}

write(rel, source);
console.log(
  `${rel}: floor reorg + Pulse Phase 1 patched`
);

/*
|--------------------------------------------------------------------------
| 13) CSS
|--------------------------------------------------------------------------
*/

const cssRel =
  "app/personal-injury/personal-injury.module.css";

let css =
  read(cssRel);

if (
  !css.includes(
    ".departmentIncident {"
  )
) {
  css += `

/* =========================================================
   FLOOR ORGANIZATION · REFERRALS VS ACCIDENT INTELLIGENCE
   ========================================================= */

.departmentIncident {
  --dept-accent: #5fc99f;
  --dept-accent-rgb: 95, 201, 159;
  grid-column: 1 / -1;
}

.departmentIncident .departmentDeskGrid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-width: 920px;
}

@media (max-width: 1180px) {
  .departmentIncident {
    grid-column: 1;
  }

  .departmentIncident .departmentDeskGrid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .departmentIncident .departmentDeskGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 470px) {
  .departmentIncident .departmentDeskGrid {
    grid-template-columns: 1fr;
  }
}

/* =========================================================
   PULSE PHASE 1 · PARTY / CONTACT RESOLUTION
   ========================================================= */

.incidentPeoplePanel {
  margin: 8px 0 9px;
  padding: 9px;
  border: 1px solid rgba(95, 201, 159, .13);
  border-radius: 7px;
  background:
    linear-gradient(
      135deg,
      rgba(95, 201, 159, .025),
      rgba(107, 184, 255, .012)
    );
}

.incidentPeopleHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
}

.incidentPeopleHead span {
  display: block;
  color: #66a98e;
  font-size: 5.5px;
  font-weight: 900;
  letter-spacing: .09em;
}

.incidentPeopleHead strong {
  display: block;
  margin-top: 3px;
  color: #d2e3dd;
  font-size: 9px;
}

.incidentPeopleHead em {
  flex: 0 0 auto;
  padding: 4px 6px;
  border: 1px solid rgba(95, 201, 159, .14);
  border-radius: 999px;
  color: #7bc9a9;
  background: rgba(95, 201, 159, .025);
  font-size: 5.5px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: .05em;
}

.incidentPeopleList {
  display: grid;
  gap: 6px;
}

.incidentPersonRow {
  display: grid;
  grid-template-columns:
    minmax(135px, .8fr)
    minmax(180px, 1fr)
    minmax(180px, 1fr)
    auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid rgba(124, 166, 189, .08);
  border-radius: 6px;
  background: rgba(3, 14, 21, .42);
}

.incidentPersonIdentity strong,
.incidentPersonMethods span,
.incidentPersonSources strong {
  display: block;
}

.incidentPersonIdentity strong {
  color: #d4e2e6;
  font-size: 8.5px;
}

.incidentPersonIdentity span {
  display: block;
  margin-top: 3px;
  color: #688997;
  font-size: 6.5px;
  text-transform: capitalize;
}

.incidentPersonMethods {
  display: grid;
  gap: 4px;
}

.incidentPersonMethods span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #8ba7b3;
  font-size: 7px;
  overflow-wrap: anywhere;
}

.incidentPersonMethods svg {
  flex: 0 0 auto;
  color: #69b8ef;
}

.incidentPersonSources {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.incidentPersonSources > span {
  color: #557583;
  font-size: 5px;
  font-weight: 900;
  letter-spacing: .06em;
}

.incidentPersonSources strong {
  margin-top: 3px;
  color: #8fa6b0;
  font-size: 6.5px;
  font-weight: 650;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.incidentPersonConfidence {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.incidentPersonConfidence em {
  padding: 4px 6px;
  border-radius: 999px;
  font-size: 5.5px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: .045em;
}

.incidentPersonConfidence small {
  color: #617e8b;
  font-size: 5.5px;
  white-space: nowrap;
}

.contactVerified {
  color: #78d5a6;
  border: 1px solid rgba(100,215,160,.2);
  background: rgba(100,215,160,.04);
}

.contactLikely {
  color: #dfc177;
  border: 1px solid rgba(224,191,133,.2);
  background: rgba(224,191,133,.04);
}

.contactUnverified {
  color: #7792a0;
  border: 1px solid rgba(124,166,189,.11);
  background: rgba(124,166,189,.02);
}

.incidentPeopleEmpty {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 8px;
  border: 1px dashed rgba(124,166,189,.1);
  border-radius: 6px;
}

.incidentPeopleEmpty svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #6c9db5;
}

.incidentPeopleEmpty strong {
  display: block;
  color: #a9bec6;
  font-size: 7.5px;
}

.incidentPeopleEmpty span {
  display: block;
  margin-top: 3px;
  color: #617f8d;
  font-size: 6.5px;
  line-height: 1.45;
}

@media (max-width: 1100px) {
  .incidentPersonRow {
    grid-template-columns:
      minmax(130px, .8fr)
      minmax(180px, 1.2fr);
  }

  .incidentPersonConfidence {
    justify-items: start;
  }
}

@media (max-width: 650px) {
  .incidentPersonRow {
    grid-template-columns: 1fr;
  }

  .incidentPersonSources {
    grid-template-columns: 1fr;
  }
}
`;
}

write(cssRel, css);

console.log(
  `${cssRel}: department + Pulse contact CSS patched`
);

console.log(
  "Applied Cano PI floor reorganization + Pulse Phase 1 full build."
);

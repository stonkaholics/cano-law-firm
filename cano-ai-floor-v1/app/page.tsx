"use client";

import {
  Scale,
  Landmark,
  Brain,
  Files,
  ShieldCheck,
  Presentation,
  Search,
  Clock3,
  MessageSquareMore,
  Activity,
  Building2,
  X,
  ArrowRight,
} from "lucide-react";
import { useMemo, useState } from "react";

type AgentStatus = "Ready" | "Working" | "Needs Review";

type Agent = {
  id: string;
  name: string;
  role: string;
  shortRole: string;
  description: string;
  status: AgentStatus;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  zone: "Coordinator" | "Immigration Research" | "Case Operations";
  capabilities: string[];
  output: string[];
};

const agents: Agent[] = [
  {
    id: "santiago",
    name: "Santiago",
    role: "AI Office Coordinator",
    shortRole: "Coordinator",
    description:
      "The communication and routing desk for the entire Cano AI team. Santiago receives Slack/Vercel requests, routes work to the right specialist, and reports results back.",
    status: "Ready",
    icon: MessageSquareMore,
    zone: "Coordinator",
    capabilities: [
      "Receive Slack and in-app instructions",
      "Assign tasks to the correct specialist",
      "Track active matters and agent progress",
      "Summarize what is happening across the floor",
      "Send back attorney-ready status updates",
    ],
    output: [
      "Task assignment",
      "Matter routing",
      "Status summaries",
      "Office-wide updates",
      "Agent notifications",
    ],
  },
  {
    id: "habeas",
    name: "Elena",
    role: "Habeas Research Specialist",
    shortRole: "Habeas",
    description:
      "Builds attorney-ready habeas research packets from case facts, statutes, regulations, and controlling authority.",
    status: "Ready",
    icon: Scale,
    zone: "Immigration Research",
    capabilities: [
      "Analyze detention facts and procedural history",
      "Research controlling and persuasive authority",
      "Find favorable and adverse cases",
      "Map facts to legal arguments",
      "Surface unresolved attorney questions",
    ],
    output: [
      "Case theory",
      "Authority table",
      "Fact-to-law matrix",
      "Argument outline",
      "Adverse authority",
    ],
  },
  {
    id: "bond",
    name: "Mateo",
    role: "Immigration Bond Specialist",
    shortRole: "Bond",
    description:
      "Organizes bond factors, evidence, risks, and missing proof into a structured attorney preparation packet.",
    status: "Ready",
    icon: Landmark,
    zone: "Immigration Research",
    capabilities: [
      "Review criminal and immigration history",
      "Organize community and family ties",
      "Assess dangerousness and flight-risk evidence",
      "Identify missing supporting documents",
      "Prepare likely government arguments",
    ],
    output: [
      "Bond factor matrix",
      "Evidence checklist",
      "Risk issues",
      "Government argument preview",
      "Hearing prep notes",
    ],
  },
  {
    id: "research",
    name: "Lex",
    role: "Case Law Research Librarian",
    shortRole: "Research",
    description:
      "Handles targeted legal research questions and returns traceable sources for attorney review.",
    status: "Working",
    icon: Search,
    zone: "Immigration Research",
    capabilities: [
      "Targeted case-law research",
      "Statutory and regulatory research",
      "Jurisdiction filtering",
      "Authority summaries",
      "Citation collection",
    ],
    output: [
      "Research memo",
      "Case table",
      "Source links",
      "Quoted propositions",
      "Open research questions",
    ],
  },
  {
    id: "casebrain",
    name: "Case Brain",
    role: "Matter Intelligence Agent",
    shortRole: "Case Brain",
    description:
      "Maintains the structured picture of a matter: people, dates, documents, issues, contradictions, and missing information.",
    status: "Ready",
    icon: Brain,
    zone: "Case Operations",
    capabilities: [
      "Build master case summaries",
      "Extract names, dates, A-numbers, and events",
      "Create matter timelines",
      "Detect contradictions",
      "Track missing information",
    ],
    output: [
      "60-second matter brief",
      "Master timeline",
      "Issue map",
      "Missing-data list",
      "People and entity index",
    ],
  },
  {
    id: "documents",
    name: "Docket",
    role: "Document Assembly Specialist",
    shortRole: "Documents",
    description:
      "Turns messy client uploads into organized, searchable, compressed filing packets.",
    status: "Ready",
    icon: Files,
    zone: "Case Operations",
    capabilities: [
      "Classify and rename documents",
      "Prepare exhibit order",
      "Create searchable PDFs",
      "Remove duplicate files",
      "Compress packets to filing limits",
    ],
    output: [
      "Merged PDF",
      "Exhibit index",
      "Renamed source set",
      "Compressed filing packet",
      "Document inventory",
    ],
  },
  {
    id: "qa",
    name: "Veritas",
    role: "Filing QA Specialist",
    shortRole: "Filing QA",
    description:
      "Performs a pre-filing quality check for consistency, completeness, attachments, signatures, and formatting.",
    status: "Needs Review",
    icon: ShieldCheck,
    zone: "Case Operations",
    capabilities: [
      "Check names and case identifiers",
      "Verify exhibit references",
      "Check signatures and dates",
      "Flag missing attachments",
      "Review pagination and duplicates",
    ],
    output: [
      "QA checklist",
      "Issue list",
      "Missing-item report",
      "Filing readiness status",
      "Attorney review flags",
    ],
  },
  {
    id: "hearing",
    name: "Avery",
    role: "Hearing Prep Specialist",
    shortRole: "Hearing Prep",
    description:
      "Converts the matter, research, and evidence into an attorney-facing hearing preparation binder.",
    status: "Ready",
    icon: Presentation,
    zone: "Case Operations",
    capabilities: [
      "Create concise case overview",
      "Organize strongest and weakest facts",
      "List likely opposing arguments",
      "Reference key exhibits",
      "Prepare likely questions",
    ],
    output: [
      "Hearing brief",
      "Key-facts sheet",
      "Exhibit references",
      "Question list",
      "Argument outline",
    ],
  },
  {
    id: "timeline",
    name: "Chronos",
    role: "Deadline & Timeline Specialist",
    shortRole: "Timeline",
    description:
      "Extracts important dates and maintains a clean chronological view of case events and upcoming deadlines.",
    status: "Ready",
    icon: Clock3,
    zone: "Case Operations",
    capabilities: [
      "Extract dates from matter materials",
      "Build event chronology",
      "Identify apparent deadlines",
      "Prepare calendar-ready data",
      "Flag conflicting dates",
    ],
    output: [
      "Master chronology",
      "Deadline list",
      "Calendar-ready events",
      "Date conflict report",
      "Upcoming actions",
    ],
  },
];

function statusClass(status: AgentStatus) {
  if (status === "Working") return "status working";
  if (status === "Needs Review") return "status review";
  return "status ready";
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? null,
    [selectedId]
  );

  const coordinator = agents.find((a) => a.zone === "Coordinator");
  const immigration = agents.filter((a) => a.zone === "Immigration Research");
  const caseOps = agents.filter((a) => a.zone === "Case Operations");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-title">CANO LAW FIRM</div>
            <div className="brand-subtitle">AI LEGAL OPERATIONS FLOOR</div>
          </div>
        </div>

        <div className="system-pill">
          <span className="live-dot" />
          Systems Online
        </div>
      </header>

      <section className="page-head">
        <div>
          <div className="eyebrow">
            <Building2 size={14} />
            CANO AI OFFICE · FLOOR 01
          </div>
          <h1>Visual Command Center</h1>
          <p>
            Click the visual desks or the operational cards. Both open the same
            workstation and keep the floor easy to monitor at a glance.
          </p>
        </div>

        <div className="quick-stat">
          <Activity size={17} />
          <div>
            <strong>{agents.length}</strong>
            <span>agents online</span>
          </div>
        </div>
      </section>

      <section className="dashboard-shell">
        <div className="visual-side">
          <div className="section-topline">
            <span>VISUAL FLOOR VIEW</span>
            <small>Top visual desks work just like the operations cards</small>
          </div>

          <div className="visual-floor">
            {coordinator && (
              <div className="center-stage">
                <div className="zone-badge">AI COORDINATION DESK</div>
                <VisualDesk
                  agent={coordinator}
                  featured
                  onOpen={setSelectedId}
                />
              </div>
            )}

            <div className="visual-zone">
              <div className="zone-badge">IMMIGRATION RESEARCH POD</div>
              <div className="visual-desk-grid visual-three">
                {immigration.map((agent) => (
                  <VisualDesk
                    key={agent.id}
                    agent={agent}
                    onOpen={setSelectedId}
                  />
                ))}
              </div>
            </div>

            <div className="floor-divider">
              <div className="divider-line" />
              <span>CANO CENTRAL</span>
              <div className="divider-line" />
            </div>

            <div className="visual-zone">
              <div className="zone-badge">CASE OPERATIONS</div>
              <div className="visual-desk-grid visual-four">
                {caseOps.map((agent) => (
                  <VisualDesk
                    key={agent.id}
                    agent={agent}
                    onOpen={setSelectedId}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="ops-side">
          <div className="section-topline">
            <span>OPERATIONAL SECTION</span>
            <small>Click any card to open the same agent</small>
          </div>

          <div className="ops-stack">
            <div className="ops-panel compact">
              <div className="panel-title">Floor Activity</div>

              <ActivityRow
                title="Lex is researching"
                text="Immigration detention authority packet"
                meta="Research Pod"
              />
              <ActivityRow
                title="Veritas needs review"
                text="2 filing items flagged for attorney attention"
                meta="Case Ops"
              />
              <ActivityRow
                title="Santiago available"
                text="Ready to route Slack or in-app requests"
                meta="Coordinator"
              />
            </div>

            <div className="ops-panel agent-list-panel">
              <div className="panel-title">All Workstations</div>
              <div className="ops-agent-list">
                {agents.map((agent) => (
                  <OpsAgentCard
                    key={agent.id}
                    agent={agent}
                    active={selectedId === agent.id}
                    onOpen={setSelectedId}
                  />
                ))}
              </div>
            </div>

            <div className="ops-panel compact">
              <div className="panel-title">Workflow</div>
              <div className="workflow">
                {["Matter", "Santiago", "Case Brain", "Specialist", "QA", "Attorney"].map(
                  (step, index, arr) => (
                    <div className="workflow-item" key={step}>
                      <div className="workflow-node">{step}</div>
                      {index < arr.length - 1 && <ArrowRight size={14} />}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </aside>
      </section>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
          <aside className="agent-panel" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-btn"
              onClick={() => setSelectedId(null)}
              aria-label="Close agent panel"
            >
              <X size={20} />
            </button>

            <div className="agent-panel-head">
              <div className="agent-large-icon">
                <selected.icon size={28} strokeWidth={1.8} />
              </div>
              <div>
                <div className={statusClass(selected.status)}>
                  <span />
                  {selected.status}
                </div>
                <h2>{selected.name}</h2>
                <p>{selected.role}</p>
              </div>
            </div>

            <p className="agent-description">{selected.description}</p>

            <div className="detail-section">
              <h3>Capabilities</h3>
              <ul>
                {selected.capabilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="detail-section">
              <h3>Typical Output</h3>
              <div className="chips">
                {selected.output.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div className="agent-actions">
              <button className="primary-btn">Open Workstation</button>
              <button className="secondary-btn">Assign Matter</button>
            </div>

            <div className="v1-note">
              Visual desk + operations card are now synced to the same agent
              workstation.
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function VisualDesk({
  agent,
  onOpen,
  featured = false,
}: {
  agent: Agent;
  onOpen: (id: string) => void;
  featured?: boolean;
}) {
  const Icon = agent.icon;

  return (
    <button
      className={`visual-desk ${featured ? "featured-desk" : ""}`}
      onClick={() => onOpen(agent.id)}
    >
      <div className="desk-status-row">
        <div className="desk-icon-box">
          <Icon size={featured ? 22 : 18} strokeWidth={1.8} />
        </div>
        <div className={statusClass(agent.status)}>
          <span />
          {agent.status}
        </div>
      </div>

      <div className="desk-illustration">
        <div className="monitor-frame">
          <div className="screen-glow" />
          <div className="screen-lines">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="agent-body">
          <div className="agent-head" />
          <div className="agent-torso" />
          <div className="chair-back" />
        </div>

        <div className="desk-surface-bar">
          <div className="keyboard" />
          <div className="mouse" />
          <div className="coffee" />
        </div>
      </div>

      <div className="visual-desk-label">
        <strong>{agent.name}</strong>
        <span>{agent.shortRole}</span>
      </div>
    </button>
  );
}

function OpsAgentCard({
  agent,
  onOpen,
  active,
}: {
  agent: Agent;
  onOpen: (id: string) => void;
  active: boolean;
}) {
  const Icon = agent.icon;

  return (
    <button
      className={`ops-agent-card ${active ? "ops-agent-card-active" : ""}`}
      onClick={() => onOpen(agent.id)}
    >
      <div className="ops-agent-left">
        <div className="ops-agent-icon">
          <Icon size={18} strokeWidth={1.9} />
        </div>
        <div className="ops-agent-copy">
          <strong>{agent.name}</strong>
          <span>{agent.role}</span>
        </div>
      </div>

      <div className={statusClass(agent.status)}>
        <span />
        {agent.status}
      </div>
    </button>
  );
}

function ActivityRow({
  title,
  text,
  meta,
}: {
  title: string;
  text: string;
  meta: string;
}) {
  return (
    <div className="activity-row">
      <div className="activity-icon">
        <Activity size={15} />
      </div>
      <div className="activity-copy">
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <small>{meta}</small>
    </div>
  );
}
 

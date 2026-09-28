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
  ChevronRight,
  X,
  Activity,
  Building2,
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
  zone: "Immigration Research" | "Case Operations";
  capabilities: string[];
  output: string[];
};

const agents: Agent[] = [
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
      "Assess available dangerousness / flight-risk evidence",
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

  const immigration = agents.filter((a) => a.zone === "Immigration Research");
  const caseOps = agents.filter((a) => a.zone === "Case Operations");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-title">CANO LAW FIRM</div>
            <div className="brand-subtitle">AI Legal Operations Floor</div>
          </div>
        </div>

        <div className="system-pill">
          <span className="live-dot" />
          Systems Online
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">
            <Building2 size={15} />
            CANO AI OFFICE · FLOOR 01
          </div>
          <h1>Legal Operations Command Center</h1>
          <p>
            Specialized AI agents prepare research, organize case information,
            assemble documents, and surface attorney review items.
          </p>
        </div>

        <div className="hero-stat">
          <Activity size={18} />
          <div>
            <strong>{agents.length}</strong>
            <span>specialists online</span>
          </div>
        </div>
      </section>

      <section className="floor-wrap">
        <div className="floor-heading">
          <span>LIVE FLOOR VIEW</span>
          <small>Click any workstation to open the agent</small>
        </div>

        <div className="floor">
          <Zone title="IMMIGRATION RESEARCH POD" agents={immigration} onOpen={setSelectedId} />
          <div className="hallway">
            <div className="hall-line" />
            <span>CANO CENTRAL</span>
            <div className="hall-line" />
          </div>
          <Zone title="CASE OPERATIONS" agents={caseOps} onOpen={setSelectedId} />
        </div>
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <div className="panel-title">Floor Activity</div>
          <ActivityRow
            title="Lex is researching"
            text="Immigration detention authority packet"
            meta="Research Pod"
          />
          <ActivityRow
            title="Veritas needs review"
            text="2 filing items flagged for attorney attention"
            meta="Case Operations"
          />
          <ActivityRow
            title="All other agents ready"
            text="Waiting for a matter or task"
            meta="System"
          />
        </div>

        <div className="panel">
          <div className="panel-title">V1 Workflow</div>
          <div className="workflow">
            {["Matter", "Case Brain", "Research", "Documents", "QA", "Attorney"].map(
              (item, index, array) => (
                <div className="workflow-item" key={item}>
                  <div className="workflow-node">{item}</div>
                  {index < array.length - 1 && <ChevronRight size={16} />}
                </div>
              )
            )}
          </div>
          <p className="panel-note">
            This first rendition is visual only. Next we connect each desk to
            Cano's actual n8n workflows and case data.
          </p>
        </div>
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
              V1 placeholder — these buttons become live once the workstation
              connects to n8n/Supabase.
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function Zone({
  title,
  agents,
  onOpen,
}: {
  title: string;
  agents: Agent[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="zone">
      <div className="zone-title">{title}</div>
      <div className="desk-grid">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <button
              className="desk"
              key={agent.id}
              onClick={() => onOpen(agent.id)}
            >
              <div className="desk-top">
                <div className="mini-avatar">
                  <Icon size={21} strokeWidth={1.9} />
                </div>
                <div className={statusClass(agent.status)}>
                  <span />
                  {agent.status}
                </div>
              </div>

              <div className="monitor">
                <div className="monitor-glow" />
                <div className="monitor-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="desk-surface">
                <div className="keyboard" />
                <div className="coffee" />
              </div>

              <div className="desk-label">
                <strong>{agent.name}</strong>
                <span>{agent.shortRole}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
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
        <Activity size={16} />
      </div>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <small>{meta}</small>
    </div>
  );
}

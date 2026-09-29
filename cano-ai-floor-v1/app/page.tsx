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
  ChevronRight,
  X,
  Activity,
  Building2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SantiagoWorkstation from "./components/SantiagoWorkstation";
import CaseBrainWorkstation, {
  type StoredCaseMatter,
} from "./components/CaseBrainWorkstation";
import SpecialistWorkstation, {
  type SpecialistAgentId,
  type SpecialistState,
} from "./components/SpecialistWorkstation";

type AgentStatus = "Ready" | "Working" | "Needs Review" | "Review Ready";

type RoutingState = {
  matterId: string;
  target: string;
  routedAt: string;
  routedBy: string;
};

type Agent = {
  id: string;
  name: string;
  role: string;
  shortRole: string;
  description: string;
  status: AgentStatus;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  zone: "Manager Offices" | "Immigration Research" | "Case Operations";
  capabilities: string[];
  output: string[];
};

const baseAgents: Agent[] = [
  {
    id: "santiago",
    name: "Santiago",
    role: "AI Office Coordinator",
    shortRole: "Coordinator",
    description:
      "Routes Slack and in-app requests, assigns work to the right specialist, and keeps the office synced.",
    status: "Ready",
    icon: MessageSquareMore,
    zone: "Manager Offices",
    capabilities: [
      "Receive Slack and in-app requests",
      "Assign work to specialists",
      "Track office-wide task status",
      "Provide matter summaries",
      "Coordinate the AI team",
    ],
    output: [
      "Task routing",
      "Office status updates",
      "Matter summaries",
      "Assignment logs",
      "Agent notifications",
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
    zone: "Manager Offices",
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
  if (status === "Needs Review" || status === "Review Ready") return "status review";
  return "status ready";
}

function statusDotClass(status: AgentStatus) {
  if (status === "Working") return "visual-dot working";
  if (status === "Needs Review" || status === "Review Ready") return "visual-dot review";
  return "visual-dot ready";
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [santiagoOpen, setSantiagoOpen] = useState(false);
  const [caseBrainOpen, setCaseBrainOpen] = useState(false);
  const [caseBrainMatter, setCaseBrainMatter] = useState<StoredCaseMatter | null>(null);
  const [caseBrainRefreshing, setCaseBrainRefreshing] = useState(false);
  const [specialistOpenId, setSpecialistOpenId] =
    useState<SpecialistAgentId | null>(null);
  const [specialistStates, setSpecialistStates] =
    useState<Record<string, SpecialistState>>({});
  const [routingState, setRoutingState] = useState<RoutingState | null>(null);
  const [sharedStateError, setSharedStateError] = useState("");
  const [santiagoInitialTab, setSantiagoInitialTab] =
    useState<"intake" | "dispatch" | "activity">("intake");

  async function loadSpecialistStates(mondayItemId?: string) {
    if (!mondayItemId) {
      setSpecialistStates({});
      return;
    }

    try {
      const res = await fetch(
        `/api/agents/state?mondayItemId=${encodeURIComponent(
          mondayItemId
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (res.ok && data?.ok !== false) {
        setSpecialistStates(data?.agents || {});
      }
    } catch {}
  }

  async function loadSharedState() {
    try {
      const res = await fetch("/api/matters/active", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to load shared Cano AI state."
        );
      }

      setSharedStateError("");
      setCaseBrainMatter(data.matter || null);

      if (data.matter?.mondayItemId || data.matter?.matterId) {
        await loadSpecialistStates(
          data.matter.mondayItemId || data.matter.matterId
        );
      } else {
        setSpecialistStates({});
      }

      if (data.matter?.routing) {
        setRoutingState({
          matterId: data.matter.matterId,
          target: data.matter.routing.target,
          routedAt: data.matter.routing.routedAt,
          routedBy: data.matter.routing.routedBy,
        });
      } else {
        setRoutingState(null);
      }
    } catch (error) {
      setSharedStateError(
        error instanceof Error
          ? error.message
          : "Unable to load shared Cano AI state."
      );
    }
  }

  useEffect(() => {
    loadSharedState();

    const delay =
      caseBrainMatter?.caseBrainStatus === "case_brain_processing"
        ? 2500
        : 15000;

    const interval = window.setInterval(
      loadSharedState,
      delay
    );

    const focusHandler = () => loadSharedState();
    window.addEventListener("focus", focusHandler);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", focusHandler);
    };
  }, [caseBrainMatter?.caseBrainStatus]);

  const agents = useMemo(() => {
    return baseAgents.map((agent) => {
      if (agent.id === "casebrain") {
        if (caseBrainRefreshing) {
          return { ...agent, status: "Working" as AgentStatus };
        }

        if (caseBrainMatter) {
          return { ...agent, status: "Review Ready" as AgentStatus };
        }
      }

      if (agent.id === "documents") {
        return { ...agent, status: "Ready" as AgentStatus };
      }

      const specialistState = specialistStates[agent.id];
      const runStatus = specialistState?.run?.status;

      if (runStatus === "working") {
        return { ...agent, status: "Working" as AgentStatus };
      }

      if (
        runStatus === "review_ready" ||
        runStatus === "needs_review"
      ) {
        return { ...agent, status: "Review Ready" as AgentStatus };
      }

      const routedTarget = routingState?.target || "";

      const routeMap: Record<string, string> = {
        "Elena · Habeas": "habeas",
        "Mateo · Bond": "bond",
        "Lex · Research": "research",
        "Chronos · Timeline": "timeline",
        "Veritas · Filing QA": "qa",
        "Avery · Hearing Prep": "hearing",
      };

      const routedAgentId = routeMap[routedTarget];

      if (routedAgentId && agent.id === routedAgentId) {
        return { ...agent, status: "Working" as AgentStatus };
      }

      return agent;
    });
  }, [
    caseBrainMatter,
    caseBrainRefreshing,
    routingState,
    specialistStates,
  ]);

  const selected = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? null,
    [agents, selectedId]
  );

  const managerOffices = agents.filter((a) => a.zone === "Manager Offices");
  const immigration = agents.filter((a) => a.zone === "Immigration Research");
  const caseOps = agents.filter((a) => a.zone === "Case Operations");

  function openSantiago(tab: "intake" | "dispatch" | "activity") {
    setSelectedId(null);
    setSantiagoInitialTab(tab);
    setSantiagoOpen(true);
  }

  function handleCaseBrainReady(matter: StoredCaseMatter) {
    setCaseBrainMatter(matter);

    if (matter.routing) {
      setRoutingState({
        matterId: matter.matterId,
        target: matter.routing.target,
        routedAt: matter.routing.routedAt || "",
        routedBy: matter.routing.routedBy || "Santiago",
      });
    } else {
      setRoutingState(null);
    }

    setSantiagoOpen(false);
    setCaseBrainOpen(true);
  }

  function handleMatterUpdated(matter: StoredCaseMatter) {
    setCaseBrainMatter(matter);

    if (matter.routing) {
      setRoutingState({
        matterId: matter.matterId,
        target: matter.routing.target,
        routedAt: matter.routing.routedAt || "",
        routedBy: matter.routing.routedBy || "Santiago",
      });
    } else {
      setRoutingState(null);
    }
  }


  async function refreshCaseBrainMatter(openWhenDone = true) {
    if (!caseBrainMatter || caseBrainRefreshing) return;

    setCaseBrainRefreshing(true);

    try {
      const mondayItemId =
        caseBrainMatter.mondayItemId ||
        caseBrainMatter.caseBrain?.matter?.monday_item_id ||
        caseBrainMatter.matterId;

      const res = await fetch("/api/santiago/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh_case_brain",
          matterId: caseBrainMatter.matterId,
          mondayItemId,
          preview: null,
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.warning ||
          data?.error ||
          "Unable to start Case Brain refresh."
        );
      }

      // Do not wait for n8n. The shared state will change when the
      // completion callback writes the new snapshot to Supabase.
      let attempts = 0;
      const previousSavedAt = caseBrainMatter.savedAt || "";

      while (attempts < 48) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempts === 0 ? 1200 : 2500)
        );
        attempts += 1;

        const statusRes = await fetch(
          `/api/matters/status?mondayItemId=${encodeURIComponent(
            mondayItemId
          )}`,
          { cache: "no-store" }
        );

        const statusData = await statusRes.json();

        if (!statusRes.ok || statusData?.ok === false) {
          continue;
        }

        const matter = statusData?.matter as StoredCaseMatter;

        if (
          matter?.caseBrainStatus === "review_ready" &&
          matter?.savedAt &&
          matter.savedAt !== previousSavedAt
        ) {
          handleMatterUpdated(matter);
          if (openWhenDone) setCaseBrainOpen(true);
          return;
        }
      }

      // It is still running in the background. Shared-state polling
      // on the main page will pick it up when complete.
      await loadSharedState();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to refresh Case Brain."
      );
    } finally {
      setCaseBrainRefreshing(false);
    }
  }

  const BUILT_SPECIALISTS: SpecialistAgentId[] = [
    "habeas",
    "bond",
    "research",
    "timeline",
    "qa",
    "hearing",
  ];

  function isBuiltSpecialist(id: string): id is SpecialistAgentId {
    return BUILT_SPECIALISTS.includes(id as SpecialistAgentId);
  }

  function openSpecialist(id: SpecialistAgentId) {
    setSelectedId(null);
    setSpecialistOpenId(id);
  }

  async function runSpecialistFromPanel(id: SpecialistAgentId) {
    if (!caseBrainMatter) return;

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mondayItemId:
            caseBrainMatter.mondayItemId ||
            caseBrainMatter.matterId,
          agentId: id,
          triggerType: specialistStates[id]?.run
            ? "refresh"
            : "manual",
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to start specialist."
        );
      }

      await loadSpecialistStates(
        caseBrainMatter.mondayItemId ||
        caseBrainMatter.matterId
      );

      openSpecialist(id);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to start specialist."
      );
    }
  }

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

      <section className="hero">
        <div>
          <div className="eyebrow">
            <Building2 size={15} />
            CANO AI OFFICE · FLOOR 01
          </div>
          <h1>Legal Operations Command Center</h1>
          <p>
            Track the visual AI floor above and use the operational center below.
            Both views open the same workstations.
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

      {sharedStateError && (
        <section className="shared-state-error">
          <strong>Shared database connection needs attention</strong>
          <span>{sharedStateError}</span>
        </section>
      )}

      {caseBrainMatter && (
        <section className="active-matter-strip">
          <div>
            <span>ACTIVE CASE BRAIN MATTER</span>
            <strong>
              {String(
                caseBrainMatter.caseBrain?.people?.detainee?.name ||
                caseBrainMatter.caseBrain?.people?.detainee?.full_name ||
                `Matter ${caseBrainMatter.matterId}`
              )}
            </strong>
          </div>
          <div className="active-matter-meta">
            <span>{caseBrainMatter.caseBrainStatus?.replaceAll("_", " ") || "review ready"}</span>
            <button onClick={() => setCaseBrainOpen(true)}>Open Case Brain</button>
          </div>
        </section>
      )}

      <section className="visual-floor-wrap">
        <div className="visual-floor-heading">
          <span>VISUAL FLOOR VIEW</span>
          <small>Click any visual agent desk to open the workstation</small>
        </div>

        <div className="visual-floor-board">
          <div className="visual-top-label left">MANAGER OFFICES</div>
          <div className="visual-top-label right">OPEN AGENT FLOOR</div>

          <div className="visual-floor-layout">
            <div className="manager-office-box">
              <div className="manager-grid">
                {managerOffices.map((agent) => (
                  <VisualNode key={agent.id} agent={agent} onOpen={setSelectedId} />
                ))}
              </div>
            </div>

            <div className="visual-divider" />

            <div className="open-floor-box">
              <div className="open-floor-grid">
                {immigration.map((agent) => (
                  <VisualNode key={agent.id} agent={agent} onOpen={setSelectedId} />
                ))}
                {caseOps.map((agent) => (
                  <VisualNode key={agent.id} agent={agent} onOpen={setSelectedId} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="floor-wrap">
        <div className="floor-heading">
          <span>OPERATION CENTER</span>
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
          {caseBrainMatter && (
            <ActivityRow
              title="Case Brain review ready"
              text={caseBrainMatter.caseBrain?.summary?.brief || "Matter analysis completed"}
              meta="Case Brain"
            />
          )}
          <ActivityRow
            title="Lex is researching"
            text="Immigration detention authority packet"
            meta="Research Pod"
          />
          <ActivityRow
            title="Santiago available"
            text="Ready to pull Monday matters and route work"
            meta="Manager Office"
          />
        </div>

        <div className="panel">
          <div className="panel-title">V1 Workflow</div>
          <div className="workflow">
            {["Matter", "Santiago", "Case Brain", "Specialist", "QA", "Attorney"].map(
              (item, index, array) => (
                <div className="workflow-item" key={item}>
                  <div className="workflow-node">{item}</div>
                  {index < array.length - 1 && <ChevronRight size={16} />}
                </div>
              )
            )}
          </div>
          <p className="panel-note">
            Case Brain now receives a real Monday matter from Santiago and can open the returned analysis in its workstation.
          </p>
        </div>
      </section>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
          <aside className="agent-panel" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedId(null)} aria-label="Close agent panel">
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
                {selected.capabilities.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div className="detail-section">
              <h3>Typical Output</h3>
              <div className="chips">
                {selected.output.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>

            <div className="agent-actions">
              <button
                className="primary-btn"
                disabled={
                  selected.id === "documents" ||
                  (isBuiltSpecialist(selected.id) && !caseBrainMatter)
                }
                onClick={() => {
                  if (selected.id === "santiago") {
                    openSantiago("dispatch");
                  } else if (selected.id === "casebrain") {
                    setSelectedId(null);
                    setCaseBrainOpen(true);
                  } else if (isBuiltSpecialist(selected.id)) {
                    openSpecialist(selected.id);
                  }
                }}
              >
                {selected.id === "documents"
                  ? "Not Connected"
                  : "Open Workstation"}
              </button>

              {selected.id === "santiago" ? (
                <button
                  className="secondary-btn"
                  onClick={() => openSantiago("intake")}
                >
                  Assign Matter
                </button>
              ) : selected.id === "casebrain" ? (
                <button
                  className="secondary-btn"
                  disabled={!caseBrainMatter || caseBrainRefreshing}
                  onClick={() => refreshCaseBrainMatter(true)}
                >
                  {caseBrainRefreshing
                    ? "Refreshing..."
                    : caseBrainMatter
                    ? "Refresh Analysis"
                    : "Awaiting Matter"}
                </button>
              ) : selected.id === "documents" ? (
                <button className="secondary-btn" disabled>
                  Documents V2
                </button>
              ) : isBuiltSpecialist(selected.id) ? (
                <button
                  className="secondary-btn"
                  disabled={!caseBrainMatter}
                  onClick={() =>
                    runSpecialistFromPanel(
                      selected.id as SpecialistAgentId
                    )
                  }
                >
                  {specialistStates[selected.id]?.run
                    ? "Refresh Analysis"
                    : "Run Agent"}
                </button>
              ) : (
                <button className="secondary-btn" disabled>
                  Coming Soon
                </button>
              )}
            </div>

            <div className="v1-note">
              {selected.id === "santiago"
                ? "Santiago assigns and routes matters."
                : selected.id === "casebrain"
                ? "Case Brain maintains the shared matter intelligence record."
                : selected.id === "documents"
                ? "Docket/Documents is intentionally not connected in this build."
                : isBuiltSpecialist(selected.id)
                ? caseBrainMatter
                  ? "This specialist runs asynchronously and saves every result to Supabase."
                  : "Complete Case Brain first."
                : "Specialist not connected."}
            </div>
          </aside>
        </div>
      )}

      {santiagoOpen && (
        <SantiagoWorkstation
          key={santiagoInitialTab}
          initialTab={santiagoInitialTab}
          onClose={() => setSantiagoOpen(false)}
          onCaseBrainReady={handleCaseBrainReady}
          activeMatter={caseBrainMatter}
          onMatterUpdated={handleMatterUpdated}
          onOpenCaseBrain={() => {
            setSantiagoOpen(false);
            setCaseBrainOpen(true);
          }}
        />
      )}

      {caseBrainOpen && (
        <CaseBrainWorkstation
          matter={caseBrainMatter}
          refreshing={caseBrainRefreshing}
          onRefresh={() => refreshCaseBrainMatter(false)}
          onClose={() => setCaseBrainOpen(false)}
        />
      )}

      {specialistOpenId && (
        <SpecialistWorkstation
          agentId={specialistOpenId}
          matter={caseBrainMatter}
          initialState={specialistStates[specialistOpenId]}
          onStateUpdated={(agentId, state) => {
            setSpecialistStates((current) => ({
              ...current,
              [agentId]: state,
            }));
          }}
          onClose={() => setSpecialistOpenId(null)}
        />
      )}
    </main>
  );
}

function VisualNode({ agent, onOpen }: { agent: Agent; onOpen: (id: string) => void }) {
  const Icon = agent.icon;
  return (
    <button className="visual-node" onClick={() => onOpen(agent.id)}>
      <div className="visual-node-label">{agent.shortRole.toUpperCase()}</div>
      <div className="visual-desk-figure">
        <div className="visual-monitor left" />
        <div className="visual-monitor right" />
        <div className="visual-head" />
        <div className="visual-body" />
        <div className="visual-desk-base" />
        <div className={statusDotClass(agent.status)} />
      </div>
      <div className="visual-node-name">{agent.name}</div>
      <div className="visual-node-icon"><Icon size={14} strokeWidth={1.9} /></div>
    </button>
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
            <button className="desk" key={agent.id} onClick={() => onOpen(agent.id)}>
              <div className="desk-top">
                <div className="mini-avatar"><Icon size={21} strokeWidth={1.9} /></div>
                <div className={statusClass(agent.status)}><span />{agent.status}</div>
              </div>
              <div className="monitor">
                <div className="monitor-glow" />
                <div className="monitor-lines"><span /><span /><span /></div>
              </div>
              <div className="desk-surface"><div className="keyboard" /><div className="coffee" /></div>
              <div className="desk-label"><strong>{agent.name}</strong><span>{agent.shortRole}</span></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivityRow({ title, text, meta }: { title: string; text: string; meta: string }) {
  return (
    <div className="activity-row">
      <div className="activity-icon"><Activity size={16} /></div>
      <div><strong>{title}</strong><span>{text}</span></div>
      <small>{meta}</small>
    </div>
  );
}

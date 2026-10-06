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
  UsersRound,
  BrainCircuit,
  FilePenLine,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import SantiagoWorkstation from "./components/SantiagoWorkstation";
import CaseBrainWorkstation, {
  type StoredCaseMatter,
} from "./components/CaseBrainWorkstation";
import SpecialistWorkstation, {
  type SpecialistAgentId,
  type SpecialistState,
} from "./components/SpecialistWorkstation";
import MatterCenter, {
  type MatterQueueItem,
} from "./components/MatterCenter";
import IntelligenceManagerWorkstation from "./components/IntelligenceManagerWorkstation";
import DraftManagerWorkstation from "./components/DraftManagerWorkstation";
import OperationsCenterDashboard from "./components/OperationsCenterDashboard";

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
    id: "synthesis",
    name: "Atlas",
    role: "Matter Intelligence Manager",
    shortRole: "Intelligence",
    description:
      "Compiles Case Brain and every specialist's separate analysis into one live attorney-facing matter dossier without overwriting the source records.",
    status: "Ready",
    icon: BrainCircuit,
    zone: "Manager Offices",
    capabilities: [
      "Compile all specialist intelligence",
      "Surface cross-agent consensus",
      "Deduplicate blockers and next actions",
      "Expose disagreements and assumptions",
      "Maintain the attorney-facing matter brief",
    ],
    output: [
      "Executive intelligence brief",
      "Team consensus",
      "Specialist summaries",
      "Cross-agent conflict map",
      "Attorney decision points",
    ],
  },
  {
    id: "drafting",
    name: "Scribe",
    role: "Legal Drafting Manager",
    shortRole: "Drafting",
    description:
      "Compiles the approved matter record, verified legal research, and firm templates into attorney-review habeas or bond motion drafts.",
    status: "Ready",
    icon: FilePenLine,
    zone: "Manager Offices",
    capabilities: [
      "Generate long-form habeas working drafts",
      "Generate bond motion working drafts",
      "Use verified specialist research",
      "Apply Cano firm templates when supplied",
      "Hold drafts for attorney approval",
    ],
    output: [
      "Attorney working draft",
      "Missing-fact placeholders",
      "Authority checklist",
      "Attorney approval status",
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
  const [matterCenterOpen, setMatterCenterOpen] = useState(false);
  const [intelligenceManagerOpen, setIntelligenceManagerOpen] =
    useState(false);
  const [draftManagerOpen, setDraftManagerOpen] = useState(false);
  const [matters, setMatters] = useState<MatterQueueItem[]>([]);
  const [mattersLoading, setMattersLoading] = useState(false);
  const [resettingMatter, setResettingMatter] = useState(false);
  const [santiagoInitialTab, setSantiagoInitialTab] =
    useState<"intake" | "dispatch" | "activity">("intake");

  // Keep the selected matter outside the polling closure so background
  // refreshes can never snap the UI back to a previously selected matter.
  const activeMatterIdRef = useRef<string | null>(null);
  const ACTIVE_MATTER_STORAGE_KEY = "cano_active_monday_item_id";

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

  function applyMatterContext(matter: MatterQueueItem | StoredCaseMatter | null) {
    const mondayItemId = matter
      ? matter.mondayItemId || matter.matterId
      : null;

    activeMatterIdRef.current = mondayItemId || null;

    if (typeof window !== "undefined") {
      if (mondayItemId) {
        window.localStorage.setItem(
          ACTIVE_MATTER_STORAGE_KEY,
          mondayItemId
        );
      } else {
        window.localStorage.removeItem(
          ACTIVE_MATTER_STORAGE_KEY
        );
      }
    }

    setCaseBrainMatter(matter || null);

    const specialistMap =
      (matter as MatterQueueItem | null)?.specialists || {};
    setSpecialistStates(specialistMap);

    if (matter?.routing) {
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

  async function loadAllMatters({
    preserveSelection = true,
  }: {
    preserveSelection?: boolean;
  } = {}) {
    setMattersLoading(true);

    try {
      const res = await fetch("/api/matters?limit=150", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to load shared Cano AI matters."
        );
      }

      const nextMatters: MatterQueueItem[] = Array.isArray(data.matters)
        ? data.matters
        : [];

      setSharedStateError("");
      setMatters(nextMatters);

      const rememberedMondayId =
        activeMatterIdRef.current ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem(
              ACTIVE_MATTER_STORAGE_KEY
            )
          : null);

      const currentMondayId =
        rememberedMondayId ||
        caseBrainMatter?.mondayItemId ||
        caseBrainMatter?.matterId ||
        null;

      const refreshedSelection =
        preserveSelection && currentMondayId
          ? nextMatters.find(
              (matter) =>
                (matter.mondayItemId || matter.matterId) ===
                currentMondayId
            )
          : null;

      const nextSelected =
        refreshedSelection ||
        (!currentMondayId ? nextMatters[0] || null : null);

      if (nextSelected) {
        applyMatterContext(nextSelected);
      } else if (!nextMatters.length) {
        applyMatterContext(null);
      }

      return nextMatters;
    } catch (error) {
      setSharedStateError(
        error instanceof Error
          ? error.message
          : "Unable to load shared Cano AI state."
      );
      return [];
    } finally {
      setMattersLoading(false);
    }
  }

  async function loadSharedState() {
    await loadAllMatters({ preserveSelection: true });
  }

  async function selectMatter(matter: MatterQueueItem | StoredCaseMatter) {
    applyMatterContext(matter);

    const mondayItemId =
      matter.mondayItemId || matter.matterId;

    await loadSpecialistStates(mondayItemId);
  }

  async function openMatterCaseBrain(matter: MatterQueueItem) {
    await selectMatter(matter);
    setMatterCenterOpen(false);
    setCaseBrainOpen(true);
  }

  const anyWorkRunning = useMemo(() => {
    return matters.some((matter) => {
      if (matter.caseBrainStatus === "case_brain_processing") {
        return true;
      }

      return Object.values(matter.specialists || {}).some(
        (state) => state?.run?.status === "working"
      );
    });
  }, [matters]);

  useEffect(() => {
    loadSharedState();

    const interval = window.setInterval(
      loadSharedState,
      anyWorkRunning ? 2500 : 15000
    );

    const focusHandler = () => loadSharedState();
    window.addEventListener("focus", focusHandler);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", focusHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyWorkRunning]);

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

      const allAgentStates = matters
        .map((matter) => matter.specialists?.[agent.id])
        .filter(Boolean);

      if (
        allAgentStates.some(
          (state) => state?.run?.status === "working"
        )
      ) {
        return { ...agent, status: "Working" as AgentStatus };
      }

      if (
        allAgentStates.some(
          (state) =>
            state?.run?.status === "review_ready" ||
            state?.run?.status === "needs_review"
        )
      ) {
        return { ...agent, status: "Review Ready" as AgentStatus };
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
    matters,
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
    // A newly assigned matter immediately becomes the active command-center
    // matter and stays active while polling continues in the background.
    applyMatterContext(matter);
    void loadAllMatters({ preserveSelection: true });

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
    applyMatterContext(matter);
    void loadAllMatters({ preserveSelection: true });

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


  async function resetMatterRecord(
    matter: MatterQueueItem | StoredCaseMatter
  ) {
    if (resettingMatter) return;

    const mondayItemId =
      matter.mondayItemId || matter.matterId;

    const matterName = String(
      matter.caseBrain?.people?.detainee?.name ||
      matter.caseBrain?.people?.detainee?.full_name ||
      matter.monday?.preview?.detaineeName ||
      matter.monday?.preview?.name ||
      `Matter ${mondayItemId}`
    );

    const confirmed = window.confirm(
      `Clear all AI work for ${matterName}?\n\n` +
      `This deletes Case Brain snapshots, specialist outputs/runs, routing history, ` +
      `pipeline history, and Atlas synthesis. Monday references and Monday intake data remain. ` +
      `You can then assign the matter again through Santiago for a clean auto-routing test.`
    );

    if (!confirmed) return;

    setResettingMatter(true);
    setSharedStateError("");

    try {
      const res = await fetch("/api/matters/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mondayItemId,
          mode: "all_ai",
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to clear the matter."
        );
      }

      const activeMondayId =
        caseBrainMatter?.mondayItemId ||
        caseBrainMatter?.matterId;

      if (activeMondayId === mondayItemId) {
        setSpecialistStates({});
        setRoutingState(null);
        setCaseBrainOpen(false);
        setIntelligenceManagerOpen(false);
        setSpecialistOpenId(null);
      }

      const hadActiveMatter = Boolean(caseBrainMatter);
      await loadAllMatters({ preserveSelection: true });
      if (!hadActiveMatter) applyMatterContext(null);
    } catch (error) {
      setSharedStateError(
        error instanceof Error
          ? error.message
          : "Unable to clear the matter."
      );
    } finally {
      setResettingMatter(false);
    }
  }


  async function removeMatterRecord(
    matter: MatterQueueItem | StoredCaseMatter
  ) {
    const mondayItemId = matter.mondayItemId || matter.matterId;
    const matterName = String(
      matter.caseBrain?.people?.detainee?.name ||
      matter.caseBrain?.people?.detainee?.full_name ||
      matter.monday?.preview?.detaineeName ||
      matter.monday?.preview?.name ||
      `Matter ${mondayItemId}`
    );

    const confirmed = window.confirm(
      `Remove ${matterName} from Cano AI?\n\n` +
      `This removes the Cano AI matter, Case Brain, specialist work, Atlas, drafts, and routing history. ` +
      `The Monday.com source item is NOT deleted, so you can assign it again later through Santiago.`
    );
    if (!confirmed) return;

    try {
      const activeMondayId = caseBrainMatter?.mondayItemId || caseBrainMatter?.matterId;
      const wasActive = activeMondayId === mondayItemId;
      const res = await fetch("/api/matters/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mondayItemId, mode: "remove_from_workspace" }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Unable to remove matter.");

      if (wasActive) {
        applyMatterContext(null);
        setCaseBrainOpen(false);
        setIntelligenceManagerOpen(false);
        setDraftManagerOpen(false);
        setSpecialistOpenId(null);
      }

      const next = await loadAllMatters({ preserveSelection: !wasActive });
      if (wasActive) applyMatterContext(null);
      setMatters(next);
    } catch (error) {
      setSharedStateError(error instanceof Error ? error.message : "Unable to remove matter.");
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

        <div className="topbar-actions">
          <button
            type="button"
            className="matter-center-button"
            onClick={() => setMatterCenterOpen(true)}
            aria-label={`Open Matter Center with ${matters.length} shared matters`}
            title="Open Matter Center"
          >
            <UsersRound size={15} />
            <span className="matter-center-label">Matter Center</span>
            <strong className="matter-count-badge">{matters.length}</strong>
          </button>

          <div className="system-pill">
            <span className="live-dot" />
            <span className="system-pill-label">Systems Online</span>
          </div>
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

        <div className="hero-stat-stack">
          <div className="hero-stat">
            <Activity size={18} />
            <div>
              <strong>{agents.length}</strong>
              <span>specialists online</span>
            </div>
          </div>
          <div className="hero-stat">
            <UsersRound size={18} />
            <div>
              <strong>{matters.length}</strong>
              <span>shared matters</span>
            </div>
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
            <span>ACTIVE COMMAND-CENTER MATTER</span>
            <strong>
              {String(
                caseBrainMatter.caseBrain?.people?.detainee?.name ||
                caseBrainMatter.caseBrain?.people?.detainee?.full_name ||
                caseBrainMatter.monday?.preview?.detaineeName ||
                caseBrainMatter.monday?.preview?.name ||
                `Matter ${caseBrainMatter.matterId}`
              )}
            </strong>
          </div>
          <div className="active-matter-meta">
            <span>
              {caseBrainMatter.caseBrainStatus?.replaceAll("_", " ") ||
                "review ready"}
            </span>
            <button
              className="active-switch-btn"
              onClick={() => setMatterCenterOpen(true)}
            >
              Switch Matter
            </button>
            <button onClick={() => setCaseBrainOpen(true)}>
              Open Case Brain
            </button>
          </div>
        </section>
      )}

      {!caseBrainMatter && matters.length > 0 && (
        <section className="active-matter-strip empty-selection">
          <div>
            <span>NO MATTER SELECTED</span>
            <strong>{matters.length} shared matters available</strong>
          </div>
          <div className="active-matter-meta">
            <button onClick={() => setMatterCenterOpen(true)}>
              Open Matter Center
            </button>
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

      <section className="operations-center-wrap">
        <div className="floor-heading">
          <span>OPERATION CENTER</span>
          <small>
            Active-matter authority, case theory, specialist progress, and attorney decision support
          </small>
        </div>

        <OperationsCenterDashboard
          matter={caseBrainMatter}
          states={specialistStates}
          onOpenSpecialist={openSpecialist}
          onOpenCaseBrain={() => setCaseBrainOpen(true)}
          onOpenAtlas={() => setIntelligenceManagerOpen(true)}
          onOpenDraft={() => setDraftManagerOpen(true)}
        />
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
                  } else if (selected.id === "synthesis") {
                    setSelectedId(null);
                    setIntelligenceManagerOpen(true);
                  } else if (selected.id === "drafting") {
                    setSelectedId(null);
                    setDraftManagerOpen(true);
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
              ) : selected.id === "drafting" ? (
                <button
                  className="secondary-btn"
                  disabled={!caseBrainMatter}
                  onClick={() => {
                    setSelectedId(null);
                    setDraftManagerOpen(true);
                  }}
                >
                  Open Draft Manager
                </button>
              ) : selected.id === "synthesis" ? (
                <button
                  className="secondary-btn"
                  disabled={!caseBrainMatter}
                  onClick={() => {
                    setSelectedId(null);
                    setIntelligenceManagerOpen(true);
                  }}
                >
                  Open Intelligence
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
                : selected.id === "drafting"
                ? "Scribe creates attorney-review drafts from the verified matter record and firm templates; nothing is filed automatically."
                : selected.id === "synthesis"
                ? "Atlas compiles the live matter dossier while preserving every agent's individual output."
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

      {matterCenterOpen && (
        <MatterCenter
          matters={matters}
          selectedMatterId={
            caseBrainMatter?.mondayItemId ||
            caseBrainMatter?.matterId ||
            null
          }
          loading={mattersLoading}
          onRefresh={() => {
            void loadAllMatters({ preserveSelection: true });
          }}
          onSelect={(matter) => {
            void selectMatter(matter);
            setMatterCenterOpen(false);
          }}
          onOpenCaseBrain={(matter) => {
            void openMatterCaseBrain(matter);
          }}
          onResetMatter={(matter) => {
            void resetMatterRecord(matter);
          }}
          onRemoveMatter={(matter) => {
            void removeMatterRecord(matter);
          }}
          onClose={() => setMatterCenterOpen(false)}
        />
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
          onMatterUpdated={handleMatterUpdated}
          specialistStates={specialistStates}
          onOpenSpecialist={(agentId) => {
            if (agentId === "synthesis") {
              setCaseBrainOpen(false);
              setIntelligenceManagerOpen(true);
            } else if (isBuiltSpecialist(agentId)) {
              setCaseBrainOpen(false);
              openSpecialist(agentId);
            }
          }}
          onClose={() => setCaseBrainOpen(false)}
        />
      )}

      {intelligenceManagerOpen && (
        <IntelligenceManagerWorkstation
          matter={caseBrainMatter}
          states={specialistStates}
          onOpenDrafting={() => {
            setIntelligenceManagerOpen(false);
            setDraftManagerOpen(true);
          }}
          onUpdated={() => {
            void loadAllMatters({ preserveSelection: true });
            if (caseBrainMatter) {
              void loadSpecialistStates(
                caseBrainMatter.mondayItemId ||
                caseBrainMatter.matterId
              );
            }
          }}
          onOpenAgent={(agentId) => {
            if (agentId === "synthesis") return;
            setIntelligenceManagerOpen(false);
            openSpecialist(agentId);
          }}
          onClose={() => setIntelligenceManagerOpen(false)}
        />
      )}

      {draftManagerOpen && (
        <DraftManagerWorkstation
          matter={caseBrainMatter}
          states={specialistStates}
          onUpdated={() => {
            void loadAllMatters({ preserveSelection: true });
            if (caseBrainMatter) {
              void loadSpecialistStates(caseBrainMatter.mondayItemId || caseBrainMatter.matterId);
            }
          }}
          onClose={() => setDraftManagerOpen(false)}
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
          onSelectMatter={(matter) => {
            void selectMatter(matter);
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

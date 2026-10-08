#!/usr/bin/env python3
from pathlib import Path
import hashlib
import sys

PAGE = Path("cano-ai-floor-v1/app/page.tsx")
AGENTS = Path("cano-ai-floor-v1/lib/supabase/agents.ts")

EXPECTED_PAGE_SHA1 = "94a3f884c2576b683c0fe0a43d4e89089e7937d8"
EXPECTED_AGENTS_SHA1 = "c38abaea2e5ed95bc58a8f2204fe1efcee1c0e48"

def sha1(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()

def fail(message):
    print(f"ABORT: {message}")
    sys.exit(1)

def replace_once(text, old, new, label):
    if old not in text:
        fail(f"Could not find patch target: {label}. Nothing was modified.")
    return text.replace(old, new, 1)

if not PAGE.exists() or not AGENTS.exists():
    fail("Run this from the cano-law-firm repository root.")

actual_page = sha1(PAGE)
actual_agents = sha1(AGENTS)

if actual_page != EXPECTED_PAGE_SHA1:
    fail(
        f"app/page.tsx changed. Expected {EXPECTED_PAGE_SHA1}, "
        f"found {actual_page}. Nothing was modified."
    )

if actual_agents != EXPECTED_AGENTS_SHA1:
    fail(
        f"lib/supabase/agents.ts changed. Expected {EXPECTED_AGENTS_SHA1}, "
        f"found {actual_agents}. Nothing was modified."
    )

page = PAGE.read_text(encoding="utf-8")
agents = AGENTS.read_text(encoding="utf-8")

page = replace_once(
    page,
    'import DraftManagerWorkstation from "./components/DraftManagerWorkstation";\n'
    'import OperationsCenterDashboard from "./components/OperationsCenterDashboard";',
    'import DraftManagerWorkstation from "./components/DraftManagerWorkstation";\n'
    'import GovernmentResponseWorkstation from "./components/GovernmentResponseWorkstation";\n'
    'import OperationsCenterDashboard from "./components/OperationsCenterDashboard";',
    "Rhea workstation import",
)

chronos = """  {
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
  },"""

rhea_block = chronos + """
  {
    id: "rebuttal",
    name: "Rhea",
    role: "Government Response & Rebuttal Specialist",
    shortRole: "Gov Response",
    description:
      "Analyzes a government response, opposition, or motion and prepares an attorney-review reply grounded in Case Brain, prior drafting work, and verified legal research.",
    status: "Ready",
    icon: FilePenLine,
    zone: "Case Operations",
    capabilities: [
      "Analyze government returns and opposition filings",
      "Map every material government argument",
      "Compare government assertions against Case Brain",
      "Review government-cited authority",
      "Draft a complete attorney-review response",
    ],
    output: [
      "Government argument map",
      "Fact-dispute list",
      "Authority response checklist",
      "Attorney working reply",
      "DOCX / PDF export",
    ],
  },"""

page = replace_once(page, chronos, rhea_block, "Rhea visual desk")

page = replace_once(
    page,
    '  const [draftManagerOpen, setDraftManagerOpen] = useState(false);\n'
    '  const [matters, setMatters] = useState<MatterQueueItem[]>([]);',
    '  const [draftManagerOpen, setDraftManagerOpen] = useState(false);\n'
    '  const [governmentResponseOpen, setGovernmentResponseOpen] = useState(false);\n'
    '  const [matters, setMatters] = useState<MatterQueueItem[]>([]);',
    "Rhea open state",
)

page = replace_once(
    page,
    '        "Avery · Hearing Prep": "hearing",\n'
    '      };',
    '        "Avery · Hearing Prep": "hearing",\n'
    '        "Rhea · Government Response": "rebuttal",\n'
    '      };',
    "Rhea route map",
)

old_primary_disabled = """                disabled={
                  selected.id === "documents" ||
                  (isBuiltSpecialist(selected.id) && !caseBrainMatter)
                }"""
new_primary_disabled = """                disabled={
                  selected.id === "documents" ||
                  (selected.id === "rebuttal" && !caseBrainMatter) ||
                  (isBuiltSpecialist(selected.id) && !caseBrainMatter)
                }"""
page = replace_once(page, old_primary_disabled, new_primary_disabled, "Rhea button guard")

old_primary_route = """                  } else if (selected.id === "drafting") {
                    setSelectedId(null);
                    setDraftManagerOpen(true);
                  } else if (isBuiltSpecialist(selected.id)) {
                    openSpecialist(selected.id);
                  }"""
new_primary_route = """                  } else if (selected.id === "drafting") {
                    setSelectedId(null);
                    setDraftManagerOpen(true);
                  } else if (selected.id === "rebuttal") {
                    setSelectedId(null);
                    setGovernmentResponseOpen(true);
                  } else if (isBuiltSpecialist(selected.id)) {
                    openSpecialist(selected.id);
                  }"""
page = replace_once(page, old_primary_route, new_primary_route, "Rhea primary route")

old_secondary = """              ) : selected.id === "documents" ? (
                <button className="secondary-btn" disabled>
                  Documents V2
                </button>
              ) : isBuiltSpecialist(selected.id) ? ("""
new_secondary = """              ) : selected.id === "documents" ? (
                <button className="secondary-btn" disabled>
                  Documents V2
                </button>
              ) : selected.id === "rebuttal" ? (
                <button
                  className="secondary-btn"
                  disabled={!caseBrainMatter}
                  onClick={() => {
                    setSelectedId(null);
                    setGovernmentResponseOpen(true);
                  }}
                >
                  Paste Government Response
                </button>
              ) : isBuiltSpecialist(selected.id) ? ("""
page = replace_once(page, old_secondary, new_secondary, "Rhea secondary action")

old_note = """                : selected.id === "documents"
                ? "Docket/Documents is intentionally not connected in this build."
                : isBuiltSpecialist(selected.id)"""
new_note = """                : selected.id === "documents"
                ? "Docket/Documents is intentionally not connected in this build."
                : selected.id === "rebuttal"
                ? caseBrainMatter
                  ? "Paste the government's filing. Rhea compares it to Case Brain, prior specialist work, and the existing draft before preparing an attorney-review reply."
                  : "Complete Case Brain first."
                : isBuiltSpecialist(selected.id)"""
page = replace_once(page, old_note, new_note, "Rhea note")

old_render = """      {specialistOpenId && (
        <SpecialistWorkstation"""
new_render = """      {governmentResponseOpen && (
        <GovernmentResponseWorkstation
          matter={caseBrainMatter}
          onClose={() => setGovernmentResponseOpen(false)}
        />
      )}

      {specialistOpenId && (
        <SpecialistWorkstation"""
page = replace_once(page, old_render, new_render, "Rhea workstation render")

agents = replace_once(
    agents,
    '  | "synthesis"\n'
    '  | "drafting";',
    '  | "synthesis"\n'
    '  | "drafting"\n'
    '  | "rebuttal";',
    "rebuttal agent type",
)

old_registry = """  drafting: {
    name: "Scribe",
    routeLabel: "Scribe · Legal Drafting",
  },
};"""
new_registry = """  drafting: {
    name: "Scribe",
    routeLabel: "Scribe · Legal Drafting",
  },
  rebuttal: {
    name: "Rhea",
    routeLabel: "Rhea · Government Response",
  },
};"""
agents = replace_once(agents, old_registry, new_registry, "Rhea agent registry")

PAGE.write_text(page, encoding="utf-8")
AGENTS.write_text(agents, encoding="utf-8")

print("SUCCESS")
print("Rhea added to app/page.tsx")
print("rebuttal added to lib/supabase/agents.ts")

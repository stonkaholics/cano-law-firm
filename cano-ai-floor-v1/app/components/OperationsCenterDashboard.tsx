"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FilePenLine,
  Gavel,
  Landmark,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";
import type {
  SpecialistAgentId,
  SpecialistState,
  SpecialistOutput,
} from "./SpecialistWorkstation";

type Authority = NonNullable<SpecialistOutput["authorities"]>[number] & {
  agentId: SpecialistAgentId;
  agentName: string;
};

type Props = {
  matter: StoredCaseMatter | null;
  states: Record<string, SpecialistState>;
  onOpenSpecialist: (id: SpecialistAgentId) => void;
  onOpenCaseBrain: () => void;
  onOpenAtlas: () => void;
  onOpenDraft: () => void;
};

const AGENT_NAMES: Record<SpecialistAgentId, string> = {
  research: "Lex",
  habeas: "Elena",
  bond: "Mateo",
  timeline: "Chronos",
  qa: "Veritas",
  hearing: "Avery",
  synthesis: "Atlas",
  drafting: "Scribe",
};

function clean(value?: string | null) {
  return String(value || "").trim();
}

function authorityKey(authority: Authority) {
  return [
    clean(authority.citation),
    clean(authority.title),
    clean(authority.url),
  ]
    .join("|")
    .toLowerCase();
}

function statusLabel(state?: SpecialistState) {
  if (state?.run?.status === "working") return "Working";
  if (state?.output) {
    const readiness = state.output?.readiness?.status;
    if (readiness === "needs_information") return "Needs Info";
    if (readiness === "not_ready") return "Blocked";
    return "Ready";
  }
  return "Not Run";
}

function stateClass(state?: SpecialistState) {
  if (state?.run?.status === "working") return "working";
  if (state?.output?.readiness?.status === "needs_information") return "review";
  if (state?.output?.readiness?.status === "not_ready") return "blocked";
  if (state?.output) return "ready";
  return "idle";
}

function authorityTone(authority: Authority) {
  const binding = clean(authority.binding_status).toLowerCase();
  const kind = clean(authority.kind).toLowerCase();

  if (binding === "binding") return "binding";
  if (kind.includes("statute") || kind.includes("regulation") || kind.includes("constitution")) {
    return "source";
  }
  if (binding === "persuasive") return "persuasive";
  return "unknown";
}

function authorityTypeLabel(authority: Authority) {
  const kind = clean(authority.kind);
  if (kind) return kind.replaceAll("_", " ");
  if (authority.court) return "case law";
  return "authority";
}

export default function OperationsCenterDashboard({
  matter,
  states,
  onOpenSpecialist,
  onOpenCaseBrain,
  onOpenAtlas,
  onOpenDraft,
}: Props) {
  const matterName = String(
    matter?.caseBrain?.people?.detainee?.name ||
      matter?.caseBrain?.people?.detainee?.full_name ||
      matter?.monday?.preview?.detaineeName ||
      matter?.monday?.preview?.name ||
      (matter ? `Matter ${matter.mondayItemId || matter.matterId}` : "No matter selected")
  );

  const collected: Authority[] = [];
  (["research", "habeas", "bond"] as SpecialistAgentId[]).forEach((agentId) => {
    const output = states[agentId]?.output;
    for (const authority of output?.authorities || []) {
      collected.push({
        ...authority,
        agentId,
        agentName: AGENT_NAMES[agentId],
      });
    }
  });

  const uniqueAuthorities = Array.from(
    new Map(collected.map((authority) => [authorityKey(authority), authority])).values()
  );

  uniqueAuthorities.sort((a, b) => {
    const score = (authority: Authority) => {
      const binding = clean(authority.binding_status).toLowerCase();
      const kind = clean(authority.kind).toLowerCase();
      if (binding === "binding") return 4;
      if (kind.includes("statute") || kind.includes("regulation") || kind.includes("constitution")) return 3;
      if (binding === "persuasive") return 2;
      return 1;
    };
    return score(b) - score(a);
  });

  const primaryAuthorities = uniqueAuthorities.slice(0, 12);

  const atlas = states.synthesis?.output;
  const blockers = Array.from(
    new Set(
      Object.values(states).flatMap(
        (state) => state?.output?.readiness?.blocking_items || []
      )
    )
  ).slice(0, 6);

  const nextActions = Array.from(
    new Set(
      Object.values(states).flatMap(
        (state) => state?.output?.next_actions || []
      )
    )
  ).slice(0, 6);

  const openQuestions = Array.from(
    new Set(
      Object.values(states).flatMap(
        (state) => state?.output?.open_questions || []
      )
    )
  ).slice(0, 5);

  const legalAgents: SpecialistAgentId[] = [
    "research",
    "habeas",
    "bond",
    "timeline",
    "hearing",
    "qa",
  ];

  if (!matter) {
    return (
      <section className="ops-command-empty">
        <BrainCircuit size={26} />
        <h3>Select a matter to load the Operations Center</h3>
        <p>
          The authority workbench, case theory, specialist outputs, blockers,
          and attorney decision support all follow the active matter.
        </p>
      </section>
    );
  }

  return (
    <section className="ops-command">
      <div className="ops-command-head">
        <div>
          <span className="ops-command-kicker">ACTIVE MATTER OPERATIONS</span>
          <h2>{matterName}</h2>
          <p>
            Attorney-facing command view for the active matter. Verified authority
            research is connected directly to the legal propositions and factual
            theories the AI team is trying to apply.
          </p>
        </div>

        <div className="ops-command-actions">
          <button onClick={onOpenCaseBrain}>
            <BrainCircuit size={15} />
            Case Brain
          </button>
          <button onClick={onOpenAtlas}>
            <Sparkles size={15} />
            Atlas
          </button>
          <button className="primary" onClick={onOpenDraft}>
            <FilePenLine size={15} />
            Draft Manager
          </button>
        </div>
      </div>

      <div className="ops-top-grid">
        <div className="ops-strategy-card">
          <div className="ops-section-title">
            <Gavel size={16} />
            <span>Case Theory & Authority Workbench</span>
            <strong>{primaryAuthorities.length}</strong>
          </div>

          <p className="ops-section-copy">
            This is the fastest place to audit what legal authority the team found,
            why it may matter to this client, and the exact source an attorney can
            open to verify before relying on it.
          </p>

          {primaryAuthorities.length ? (
            <div className="authority-workbench">
              {primaryAuthorities.map((authority, index) => {
                const tone = authorityTone(authority);
                const title =
                  clean(authority.citation) ||
                  clean(authority.title) ||
                  "Authority";

                return (
                  <article className="authority-card" key={authorityKey(authority) || index}>
                    <div className="authority-card-top">
                      <div className="authority-card-title">
                        <div className={`authority-kind-icon ${tone}`}>
                          {authority.agentId === "research" ? (
                            <Search size={15} />
                          ) : authority.agentId === "habeas" ? (
                            <Scale size={15} />
                          ) : (
                            <Landmark size={15} />
                          )}
                        </div>
                        <div>
                          <span>
                            {authorityTypeLabel(authority)} · {authority.agentName}
                          </span>
                          <h3>{title}</h3>
                          {authority.title && clean(authority.title) !== title ? (
                            <p className="authority-case-name">{authority.title}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="authority-badges">
                        <span className={tone}>
                          {clean(authority.binding_status) || "unknown"}
                        </span>
                        {authority.court ? <span>{authority.court}</span> : null}
                        {authority.date ? <span>{authority.date}</span> : null}
                      </div>
                    </div>

                    <div className="authority-apply-grid">
                      <div>
                        <span className="authority-label">LEGAL PROPOSITION</span>
                        <p>
                          {clean(authority.proposition) ||
                            "No proposition summary was returned."}
                        </p>
                      </div>
                      <div>
                        <span className="authority-label">WHY IT MAY APPLY HERE</span>
                        <p>
                          {clean(authority.relevance) ||
                            "The specialist did not return a matter-specific relevance explanation."}
                        </p>
                      </div>
                    </div>

                    {authority.quote ? (
                      <blockquote>
                        <BookOpenCheck size={14} />
                        <div>
                          <span>SUPPLIED SOURCE TEXT</span>
                          <p>“{authority.quote}”</p>
                        </div>
                      </blockquote>
                    ) : null}

                    <div className="authority-card-footer">
                      <div className="authority-source-meta">
                        <span>
                          Source: {clean(authority.source_provider) || "research provider"}
                        </span>
                        <span>
                          Citator: {clean(authority.citator_status).replaceAll("_", " ") || "review required"}
                        </span>
                        {authority.precedential_status ? (
                          <span>{authority.precedential_status}</span>
                        ) : null}
                      </div>

                      {authority.url ? (
                        <a
                          href={authority.url}
                          target="_blank"
                          rel="noreferrer"
                          className="authority-open-source"
                        >
                          Open Source
                          <ArrowUpRight size={14} />
                        </a>
                      ) : (
                        <span className="authority-no-link">No direct source URL</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ops-placeholder">
              <BookOpenCheck size={22} />
              <div>
                <strong>No verified authority records saved yet.</strong>
                <span>
                  Run Lex or the primary specialist to populate case law, statutes,
                  regulations, source links, and matter-specific relevance.
                </span>
              </div>
            </div>
          )}
        </div>

        <aside className="ops-intelligence-rail">
          <div className="ops-side-card">
            <div className="ops-section-title compact">
              <Sparkles size={15} />
              <span>Atlas Intelligence Brief</span>
            </div>
            <p className="ops-side-copy">
              {atlas?.executive_summary ||
                matter.caseBrain?.summary?.brief ||
                "Atlas has not compiled the cross-agent dossier yet."}
            </p>
            <button className="ops-text-button" onClick={onOpenAtlas}>
              Open full intelligence dossier
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="ops-side-card">
            <div className="ops-section-title compact">
              <AlertTriangle size={15} />
              <span>Current Blockers</span>
              <strong>{blockers.length}</strong>
            </div>
            {blockers.length ? (
              <ul className="ops-compact-list">
                {blockers.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="ops-none">No current specialist blockers listed.</p>
            )}
          </div>

          <div className="ops-side-card">
            <div className="ops-section-title compact">
              <CircleDot size={15} />
              <span>Open Attorney Questions</span>
              <strong>{openQuestions.length}</strong>
            </div>
            {openQuestions.length ? (
              <ul className="ops-compact-list">
                {openQuestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="ops-none">No open questions currently listed.</p>
            )}
          </div>
        </aside>
      </div>

      <div className="ops-lower-grid">
        <div className="ops-progress-panel">
          <div className="ops-section-title">
            <CheckCircle2 size={15} />
            <span>Specialist Output Status</span>
          </div>

          <div className="ops-agent-status-grid">
            {legalAgents.map((agentId) => {
              const state = states[agentId];
              const label = statusLabel(state);
              return (
                <button
                  key={agentId}
                  className="ops-agent-status"
                  onClick={() => onOpenSpecialist(agentId)}
                >
                  <span className={`ops-status-dot ${stateClass(state)}`} />
                  <div>
                    <strong>{AGENT_NAMES[agentId]}</strong>
                    <span>{label}</span>
                  </div>
                  <ArrowUpRight size={13} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="ops-actions-panel">
          <div className="ops-section-title">
            <ShieldCheck size={15} />
            <span>Team Next Actions</span>
            <strong>{nextActions.length}</strong>
          </div>

          {nextActions.length ? (
            <ol className="ops-next-actions">
              {nextActions.map((action, index) => (
                <li key={index}>
                  <span>{index + 1}</span>
                  <p>{action}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="ops-placeholder small">
              <CheckCircle2 size={18} />
              <div>
                <strong>No operational next actions listed.</strong>
                <span>Completed specialist outputs will populate this panel.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

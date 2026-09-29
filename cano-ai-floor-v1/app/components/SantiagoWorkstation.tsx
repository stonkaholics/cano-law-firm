"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Search,
  AlertTriangle,
  Loader2,
  Database,
  FileText,
  Play,
  RefreshCw,
  MessageSquareMore,
  Send,
  Brain,
  Route,
  History,
  Scale,
  Landmark,
  Search as SearchIcon,
  Files as FilesIcon,
  Clock3,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  Presentation,
  Upload,
  X,
} from "lucide-react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";

export type SantiagoMatter = {
  id: string;
  name: string;
  practiceArea?: string;
  matterType?: string;
  attorney?: string;
  status?: string;
  pncName?: string;
  detaineeName?: string;
  aNumber?: string;
  detentionFacility?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  contactMethod?: string;
  dateAdded?: string;
  notesPreview?: string;
  mondayItemId?: string;
  referredBy?: string;
  referredSource?: string;
};

type StartResult = {
  ok: boolean;
  matterId?: string;
  mondayItemId?: string;
  caseBrainStatus?: string;
  monday?: {
    found: boolean;
    fieldsImported?: number;
  };
  caseBrain?: StoredCaseMatter["caseBrain"];
  warning?: string | null;
  error?: string | null;
  message?: string;
};


type CaseBrainProgress =
  | "idle"
  | "accepted"
  | "analyzing"
  | "saving"
  | "ready"
  | "error"
  | "still_working";

type SantiagoActivity = {
  id: string;
  type:
    | "matter_selected"
    | "case_brain_started"
    | "case_brain_completed"
    | "case_brain_refreshed"
    | "routing_selected";
  title: string;
  detail?: string;
  timestamp: string;
  matterId?: string;
};


export default function SantiagoWorkstation({
  initialTab = "intake",
  onClose,
  onCaseBrainReady,
  activeMatter,
  onOpenCaseBrain,
  onMatterUpdated,
}: {
  initialTab?: "intake" | "dispatch" | "activity";
  onClose: () => void;
  onCaseBrainReady?: (matter: StoredCaseMatter) => void;
  activeMatter?: StoredCaseMatter | null;
  onOpenCaseBrain?: () => void;
  onMatterUpdated?: (matter: StoredCaseMatter) => void;
}) {
  const [tab, setTab] = useState<"intake" | "dispatch" | "activity">(initialTab);
  const [query, setQuery] = useState("");
  const [matters, setMatters] = useState<SantiagoMatter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState<CaseBrainProgress>("idle");
  const [result, setResult] = useState<StartResult | null>(null);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<SantiagoActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [attorneyCaseNotes, setAttorneyCaseNotes] = useState("");
  const [notesFileName, setNotesFileName] = useState("");

  const selected = useMemo(
    () => matters.find((m) => m.id === selectedId) ?? null,
    [matters, selectedId]
  );

  async function loadActivity() {
    const mondayItemId =
      activeMatter?.mondayItemId ||
      activeMatter?.matterId;

    if (!mondayItemId) {
      setActivity([]);
      return;
    }

    setActivityLoading(true);

    try {
      const res = await fetch(
        `/api/activity?mondayItemId=${encodeURIComponent(
          mondayItemId
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to load shared matter activity."
        );
      }

      setActivity(
        Array.isArray(data.activity)
          ? data.activity
          : []
      );
    } catch {
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }

  function routeLabel(value?: string) {
    const map: Record<string, string> = {
      habeas: "Elena · Habeas",
      bond: "Mateo · Bond",
      research: "Lex · Research",
      documents: "Docket · Documents",
      timeline: "Chronos · Timeline",
      qa: "Veritas · Filing QA",
      hearing: "Avery · Hearing Prep",
      attorney_review: "Attorney Review",
      unknown: "Unassigned",
    };

    return map[value || "unknown"] || value || "Unassigned";
  }

  async function logRoute(target: string) {
    if (!activeMatter) return;

    try {
      const res = await fetch("/api/routing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mondayItemId:
            activeMatter.mondayItemId ||
            activeMatter.matterId,
          target,
          routedBy: "Santiago",
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false || !data?.matter) {
        throw new Error(
          data?.error || "Unable to route the matter."
        );
      }

      onMatterUpdated?.(data.matter);

      const targetMap: Record<string, string> = {
        "Elena · Habeas": "habeas",
        "Mateo · Bond": "bond",
        "Lex · Research": "research",
        "Chronos · Timeline": "timeline",
        "Veritas · Filing QA": "qa",
        "Avery · Hearing Prep": "hearing",
      };

      const specialistId = targetMap[target];

      if (specialistId) {
        const runRes = await fetch("/api/agents/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mondayItemId:
              activeMatter.mondayItemId ||
              activeMatter.matterId,
            agentId: specialistId,
            triggerType: "dispatch",
          }),
        });

        const runData = await runRes.json();

        if (!runRes.ok || runData?.ok === false) {
          throw new Error(
            runData?.error ||
            `Matter routed, but ${target} could not start.`
          );
        }
      }

      await loadActivity();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to route the matter."
      );
    }
  }

  async function searchMatters(nextQuery = query) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/santiago/matters?q=${encodeURIComponent(nextQuery.trim())}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Unable to load Monday matters.");
      }

      setMatters(Array.isArray(data.matters) ? data.matters : []);
    } catch (err) {
      setMatters([]);
      setError(
        err instanceof Error ? err.message : "Unable to load Monday matters."
      );
    } finally {
      setLoading(false);
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function pollCaseBrainMatter(
    mondayItemId: string,
    timeoutMs = 120000
  ) {
    const startedAt = Date.now();
    let pollCount = 0;

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(pollCount === 0 ? 1200 : 2500);
      pollCount += 1;

      const res = await fetch(
        `/api/matters/status?mondayItemId=${encodeURIComponent(
          mondayItemId
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        if (res.status === 404) continue;
        throw new Error(
          data?.error || "Unable to check Case Brain status."
        );
      }

      const status = String(data?.status || "");

      if (status === "case_brain_error") {
        setProgress("error");
        throw new Error(
          "Case Brain reported an error. Check Santiago Activity for details."
        );
      }

      if (
        status === "review_ready" ||
        status === "ready_for_review" ||
        status === "complete"
      ) {
        setProgress("ready");

        const stored = data?.matter as StoredCaseMatter;

        if (stored) {
          onCaseBrainReady?.(stored);
        }

        return stored;
      }

      if (pollCount >= 2) {
        setProgress("analyzing");
      }
    }

    setProgress("still_working");

    setResult({
      ok: true,
      matterId: mondayItemId,
      mondayItemId,
      caseBrainStatus: "case_brain_processing",
      message:
        "Case Brain is still working in the background. You can leave this screen and return later.",
    });

    return null;
  }

  async function startMatter() {
    if (!selected) return;

    setStarting(true);
    setProgress("accepted");
    setResult(null);
    setError("");

    try {
      const mondayItemId =
        selected.mondayItemId || selected.id;

      const res = await fetch("/api/santiago/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId: selected.id,
          mondayItemId,
          preview: {
            ...selected,
            originalMondaySummary: selected.notesPreview || "",
            notesPreview:
              attorneyCaseNotes.trim() ||
              selected.notesPreview ||
              "",
          },
          attorneyCaseNotes: attorneyCaseNotes.trim() || null,
          intakeSource: attorneyCaseNotes.trim()
            ? "attorney_case_notes"
            : "monday_short_case_summary",
        }),
      });

      const data: StartResult & {
        accepted?: boolean;
        storedMatter?: StoredCaseMatter;
      } = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(
          data?.warning ||
          data?.error ||
          data?.message ||
          "Matter could not be assigned."
        );
      }

      setResult({
        ...data,
        ok: true,
        caseBrainStatus:
          data.caseBrainStatus || "case_brain_processing",
      });

      setProgress("analyzing");

      // n8n is now working in the background.
      // Poll Supabase for the shared matter to become review_ready.
      await pollCaseBrainMatter(mondayItemId);
    } catch (err) {
      setProgress("error");

      setResult({
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Unable to start Case Brain.",
        warning:
          err instanceof Error
            ? err.message
            : "Unable to start Case Brain.",
      });
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    searchMatters("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatter?.matterId, activeMatter?.savedAt, activeMatter?.routing?.routedAt]);

  return (
    <div className="santiago-workstation">
      <div className="ws-topbar">
        <div className="ws-title-group">
          <button className="ws-back" onClick={onClose}>
            <ArrowLeft size={18} />
          </button>

          <div className="ws-agent-badge">
            <MessageSquareMore size={22} />
          </div>

          <div>
            <div className="ws-kicker">SANTIAGO · AI OFFICE COORDINATOR</div>
            <h2>Coordinator Workstation</h2>
          </div>
        </div>

        <div className="ws-status">
          <span />
          Ready
        </div>
      </div>

      <div className="ws-tabs">
        <button className={tab === "intake" ? "active" : ""} onClick={() => setTab("intake")}>
          Matter Intake
        </button>
        <button className={tab === "dispatch" ? "active" : ""} onClick={() => setTab("dispatch")}>
          Dispatch
        </button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>
          Activity
        </button>
      </div>

      {tab === "intake" && (
        <div className="ws-content">
          <section className="ws-left">
            <div className="ws-section-head">
              <div>
                <span className="ws-eyebrow">LIVE MONDAY CLIENT LIST</span>
                <h3>Assign a matter</h3>
              </div>
              <button className="icon-button" onClick={() => searchMatters()} aria-label="Refresh Monday matters">
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="matter-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchMatters();
                }}
                placeholder="Search name, PNC, A-number, phone..."
              />
              <button onClick={() => searchMatters()}>Search</button>
            </div>

            {error && (
              <div className="ws-error">
                <AlertTriangle size={17} />
                <span>{error}</span>
              </div>
            )}

            <div className="matter-list">
              {loading && (
                <div className="matter-empty">
                  <Loader2 className="spin" size={18} />
                  Pulling current clients from Monday...
                </div>
              )}

              {!loading &&
                matters.map((matter) => (
                  <button
                    key={matter.id}
                    className={`matter-row ${selectedId === matter.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedId(matter.id);
                      setResult(null);
                      setAttorneyCaseNotes("");
                      setNotesFileName("");
                    }}
                  >
                    <div>
                      <strong>{matter.name}</strong>
                      <span>
                        {[matter.practiceArea, matter.detentionFacility]
                          .filter(Boolean)
                          .join(" · ") || "Monday Matter"}
                      </span>
                    </div>
                    <small>{matter.pncName || matter.status || "Current"}</small>
                  </button>
                ))}

              {!loading && !error && matters.length === 0 && (
                <div className="matter-empty">
                  No Monday matters matched this search.
                </div>
              )}
            </div>
          </section>

          <section className="ws-right">
            {!selected ? (
              <div className="select-placeholder">
                <Database size={30} />
                <h3>Select a Monday matter</h3>
                <p>
                  Choose a current client to review the available Monday data
                  before pushing it into the Cano AI matter pipeline.
                </p>
              </div>
            ) : (
              <>
                <div className="selected-matter-head">
                  <div>
                    <span className="ws-eyebrow">SELECTED MATTER</span>
                    <h3>{selected.name}</h3>
                    <p>
                      {[selected.practiceArea, selected.matterType]
                        .filter(Boolean)
                        .join(" · ") || "Monday Client"}
                    </p>
                  </div>
                  <div className="matter-status-pill">
                    {selected.status || "Monday"}
                  </div>
                </div>

                <div className="matter-facts">
                  <Fact label="PNC" value={selected.pncName || "—"} />
                  <Fact label="Detainee" value={selected.detaineeName || selected.name} />
                  <Fact label="A-Number" value={selected.aNumber || "—"} />
                  <Fact label="Facility" value={selected.detentionFacility || "—"} />
                  <Fact label="Phone" value={selected.phone || "—"} />
                  <Fact label="Email" value={selected.email || "—"} />
                  <Fact label="Language" value={selected.preferredLanguage || "—"} />
                  <Fact label="Contact Method" value={selected.contactMethod || "—"} />
                  <Fact label="Monday Item" value={selected.mondayItemId || selected.id} />
                </div>

                {selected.notesPreview && (
                  <div className="notes-preview">
                    <span>MONDAY SHORT CASE SUMMARY</span>
                    <p>{selected.notesPreview}</p>
                  </div>
                )}

                <div className="attorney-intake-notes">
                  <div className="attorney-intake-notes-head">
                    <div>
                      <span>OPTIONAL · ATTORNEY CASE NOTES</span>
                      <strong>Use your initial call notes instead</strong>
                      <p>
                        Paste the attorney's consultation/call notes here. If anything
                        is entered, Case Brain will use these notes as the primary intake
                        narrative instead of Monday's Short Case Summary. Leave this blank
                        to keep using the Monday summary automatically.
                      </p>
                    </div>

                    {attorneyCaseNotes.trim() ? (
                      <div className="attorney-notes-source-pill active">
                        Attorney notes will be used
                      </div>
                    ) : (
                      <div className="attorney-notes-source-pill">
                        Monday summary will be used
                      </div>
                    )}
                  </div>

                  <textarea
                    value={attorneyCaseNotes}
                    onChange={(event) => {
                      setAttorneyCaseNotes(event.target.value);
                      setNotesFileName("");
                    }}
                    placeholder="Paste initial consultation notes, detention history, prior filings, criminal history, family facts, procedural details, attorney observations, etc..."
                    rows={8}
                  />

                  <div className="attorney-intake-notes-actions">
                    <label className="attorney-notes-upload">
                      <Upload size={14} />
                      Upload .txt / .md notes
                      <input
                        type="file"
                        accept=".txt,.md,text/plain,text/markdown"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const text = await file.text();
                          setAttorneyCaseNotes(text);
                          setNotesFileName(file.name);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {notesFileName ? (
                      <span className="attorney-notes-file">
                        {notesFileName}
                      </span>
                    ) : null}

                    {attorneyCaseNotes.trim() ? (
                      <button
                        type="button"
                        className="attorney-notes-clear"
                        onClick={() => {
                          setAttorneyCaseNotes("");
                          setNotesFileName("");
                        }}
                      >
                        <X size={13} />
                        Clear notes
                      </button>
                    ) : null}
                  </div>

                  <div className="attorney-intake-source-preview">
                    <span>CASE BRAIN INTAKE SOURCE</span>
                    <strong>
                      {attorneyCaseNotes.trim()
                        ? "Attorney Case Notes"
                        : "Monday Short Case Summary"}
                    </strong>
                  </div>
                </div>

                {result && (
                  <div className={`start-result ${result.ok ? "success" : "error"}`}>
                    <div className="start-result-head">
                      {result.ok ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
                      <strong>
                        {result.message ||
                          (result.ok ? "Matter assigned" : "Matter could not be assigned")}
                      </strong>
                    </div>
                    {result.monday && (
                      <p>
                        Monday: {result.monday.found
                          ? `${result.monday.fieldsImported ?? "Available"} fields imported`
                          : "matter not found"}
                      </p>
                    )}
                    {result.caseBrainStatus && (
                      <p>
                        Case Brain status:{" "}
                        {result.caseBrainStatus.replaceAll("_", " ")}
                      </p>
                    )}
                    {result.caseBrain && (
                      <button
                        className="open-casebrain-result"
                        onClick={() => {
                          if (activeMatter) {
                            onCaseBrainReady?.(activeMatter);
                          }
                        }}
                      >
                        <Brain size={17} />
                        Open Case Brain Matter
                      </button>
                    )}
                    {(result.error || result.warning) && (
                      <p>{result.error || result.warning}</p>
                    )}
                  </div>
                )}

                {progress !== "idle" && progress !== "error" && (
                  <div className="casebrain-progress-card">
                    <ProgressRow
                      label="Matter received"
                      state={
                        progress === "accepted" ||
                        progress === "analyzing" ||
                        progress === "saving" ||
                        progress === "ready" ||
                        progress === "still_working"
                          ? "done"
                          : "waiting"
                      }
                    />
                    <ProgressRow
                      label="Case Brain analyzing"
                      state={
                        progress === "analyzing"
                          ? "active"
                          : progress === "ready"
                          ? "done"
                          : progress === "still_working"
                          ? "active"
                          : "waiting"
                      }
                    />
                    <ProgressRow
                      label="Saved to Supabase"
                      state={progress === "ready" ? "done" : "waiting"}
                    />
                    <ProgressRow
                      label="Review ready"
                      state={progress === "ready" ? "done" : "waiting"}
                    />

                    {progress === "still_working" && (
                      <p>
                        This is taking longer than usual, but the job is still
                        running in the background. You can leave Santiago and
                        return later.
                      </p>
                    )}
                  </div>
                )}

                <button className="start-casebrain" disabled={starting} onClick={startMatter}>
                  {starting ? (
                    <>
                      <Loader2 className="spin" size={18} />
                      {progress === "accepted"
                        ? "Sending Matter..."
                        : progress === "analyzing"
                        ? "Case Brain Analyzing..."
                        : progress === "saving"
                        ? "Saving Analysis..."
                        : "Case Brain Working..."}
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Assign Matter to Case Brain
                    </>
                  )}
                </button>

                <p className="ws-help">
                  Case Brain results are saved to Supabase and shared across the Cano AI floor. Refresh Analysis creates a new saved snapshot from the latest Monday data.
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "dispatch" && (
        <div className="santiago-secondary-shell">
          <section className="dispatch-hero">
            <div>
              <span className="ws-eyebrow">DISPATCH CENTER</span>
              <h3>Route the active matter</h3>
              <p>
                Case Brain recommends the next step. Santiago keeps the human in
                control of which specialist receives the matter.
              </p>
            </div>

            <div className="dispatch-route-chip">
              <Route size={17} />
              {routeLabel(activeMatter?.caseBrain?.routing?.recommended_specialist)}
            </div>
          </section>

          {!activeMatter ? (
            <div className="secondary-empty">
              <Send size={30} />
              <h3>No active Case Brain matter</h3>
              <p>
                Use Matter Intake to assign a Monday matter first. Once Case Brain
                finishes, routing options will appear here.
              </p>
            </div>
          ) : (
            <div className="dispatch-grid">
              <section className="dispatch-matter-card">
                <div className="dispatch-matter-head">
                  <div>
                    <span>ACTIVE MATTER</span>
                    <h3>
                      {String(
                        activeMatter.caseBrain?.people?.detainee?.name ||
                        activeMatter.caseBrain?.people?.detainee?.full_name ||
                        `Matter ${activeMatter.matterId}`
                      )}
                    </h3>
                  </div>

                  <button className="mini-gold-btn" onClick={onOpenCaseBrain}>
                    Open Case Brain
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="dispatch-matter-stats">
                  <DispatchStat
                    label="Status"
                    value={activeMatter.caseBrainStatus?.replaceAll("_", " ") || "review ready"}
                  />
                  <DispatchStat
                    label="Practice Area"
                    value={activeMatter.caseBrain?.matter?.practice_area || "—"}
                  />
                  <DispatchStat
                    label="Missing Items"
                    value={String(activeMatter.caseBrain?.missing_information?.length || 0)}
                  />
                  <DispatchStat
                    label="Contradictions"
                    value={String(activeMatter.caseBrain?.contradictions?.length || 0)}
                  />
                </div>

                <div className="dispatch-summary">
                  <span>CASE BRAIN SUMMARY</span>
                  <p>
                    {activeMatter.caseBrain?.summary?.brief ||
                      "Case Brain summary unavailable."}
                  </p>
                </div>

                <div className="dispatch-recommendation">
                  <div>
                    <span>RECOMMENDED NEXT STEP</span>
                    <strong>
                      {routeLabel(activeMatter.caseBrain?.routing?.recommended_specialist)}
                    </strong>
                  </div>
                  <p>
                    {activeMatter.caseBrain?.routing?.reason ||
                      "Case Brain has not returned a routing reason."}
                  </p>
                </div>


                <div className="dispatch-current-route">
                  <div>
                    <span>CURRENT ROUTE</span>
                    <strong>{activeMatter?.routing?.target || "Not routed yet"}</strong>
                  </div>

                  {activeMatter?.routing ? (
                    <div className="dispatch-route-meta">
                      <span>Routed by {activeMatter.routing?.routedBy || "Santiago"}</span>
                      <small>{formatActivityTime(activeMatter.routing?.routedAt || '')}</small>
                    </div>
                  ) : (
                    <small>
                      Choose a route on the right when the team is ready to hand
                      the matter off.
                    </small>
                  )}
                </div>
              </section>

              <section className="route-panel">
                <div className="route-panel-head">
                  <span className="ws-eyebrow">AVAILABLE ROUTES</span>
                  <small>
                    Routing is saved to Supabase; specialist workflows are next.
                  </small>
                </div>

                <div className="route-grid">
                  <RouteButton
                    icon={<Scale size={18} />}
                    title="Elena"
                    subtitle="Habeas"
                    recommended={activeMatter.caseBrain?.routing?.recommended_specialist === "habeas"}
                    routingStateTarget={activeMatter?.routing?.target}
                    onClick={() => logRoute("Elena · Habeas")}
                  />
                  <RouteButton
                    icon={<Landmark size={18} />}
                    title="Mateo"
                    subtitle="Bond"
                    recommended={activeMatter.caseBrain?.routing?.recommended_specialist === "bond"}
                    routingStateTarget={activeMatter?.routing?.target}
                    onClick={() => logRoute("Mateo · Bond")}
                  />
                  <RouteButton
                    icon={<SearchIcon size={18} />}
                    title="Lex"
                    subtitle="Research"
                    recommended={activeMatter.caseBrain?.routing?.recommended_specialist === "research"}
                    routingStateTarget={activeMatter?.routing?.target}
                    onClick={() => logRoute("Lex · Research")}
                  />
                  <RouteButton
                    icon={<FilesIcon size={18} />}
                    title="Docket"
                    subtitle="Documents · Not Connected"
                    recommended={false}
                    routingStateTarget={activeMatter?.routing?.target}
                    disabled
                    onClick={() => {}}
                  />
                  <RouteButton
                    icon={<Clock3 size={18} />}
                    title="Chronos"
                    subtitle="Timeline"
                    recommended={activeMatter.caseBrain?.routing?.recommended_specialist === "timeline"}
                    routingStateTarget={activeMatter?.routing?.target}
                    onClick={() => logRoute("Chronos · Timeline")}
                  />
                  <RouteButton
                    icon={<ShieldCheck size={18} />}
                    title="Veritas"
                    subtitle="Filing QA"
                    recommended={activeMatter.caseBrain?.routing?.recommended_specialist === "qa"}
                    routingStateTarget={activeMatter?.routing?.target}
                    onClick={() => logRoute("Veritas · Filing QA")}
                  />
                  <RouteButton
                    icon={<Presentation size={18} />}
                    title="Avery"
                    subtitle="Hearing Prep"
                    recommended={activeMatter.caseBrain?.routing?.recommended_specialist === "hearing"}
                    routingStateTarget={activeMatter?.routing?.target}
                    onClick={() => logRoute("Avery · Hearing Prep")}
                  />
                  <RouteButton
                    icon={<UserCheck size={18} />}
                    title="Attorney"
                    subtitle="Review"
                    recommended={activeMatter.caseBrain?.routing?.recommended_specialist === "attorney_review"}
                    routingStateTarget={activeMatter?.routing?.target}
                    onClick={() => logRoute("Attorney Review")}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="santiago-secondary-shell">
          <section className="activity-toolbar">
            <div>
              <span className="ws-eyebrow">COORDINATOR ACTIVITY</span>
              <h3>Santiago event log</h3>
              <p>
                Shared matter history from Supabase: Case Brain runs, refreshes,
                routing decisions, and workflow errors.
              </p>
            </div>

            <button
              className="icon-text-btn"
              onClick={() => loadActivity()}
            >
              <RefreshCw size={14} />
              Refresh Activity
            </button>
          </section>

          <section className="activity-log-panel">
            {activityLoading ? (
              <div className="secondary-empty inline-empty">
                <Loader2 className="spin" size={28} />
                <h3>Loading shared activity...</h3>
              </div>
            ) : activity.length === 0 ? (
              <div className="secondary-empty inline-empty">
                <History size={30} />
                <h3>No coordinator activity yet</h3>
                <p>
                  Assign a matter through Santiago and the shared event history will
                  appear here for every computer.
                </p>
              </div>
            ) : (
              <div className="activity-log-list">
                {activity.map((entry) => (
                  <div className="activity-log-row" key={entry.id}>
                    <div className={`activity-type-dot ${entry.type}`} />
                    <div className="activity-log-copy">
                      <strong>{entry.title}</strong>
                      {entry.detail && <span>{entry.detail}</span>}
                      <small>{formatActivityTime(entry.timestamp)}</small>
                    </div>
                    {entry.matterId && (
                      <div className="activity-matter-id">
                        {entry.matterId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}



function ProgressRow({
  label,
  state,
}: {
  label: string;
  state: "waiting" | "active" | "done";
}) {
  return (
    <div className={`casebrain-progress-row ${state}`}>
      <div className="progress-indicator">
        {state === "active" ? (
          <Loader2 className="spin" size={13} />
        ) : state === "done" ? (
          <CheckCircle2 size={13} />
        ) : (
          <span />
        )}
      </div>
      <strong>{label}</strong>
    </div>
  );
}

function DispatchStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="dispatch-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RouteButton({
  icon,
  title,
  subtitle,
  recommended,
  routingStateTarget,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  recommended?: boolean;
  routingStateTarget?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      className={`route-button ${recommended ? "recommended" : ""} ${
        routingStateTarget === `${title} · ${subtitle}` ||
        routingStateTarget === "Attorney Review" && title === "Attorney"
          ? "selected-route"
          : ""
      } ${disabled ? "disabled-route" : ""}`}
      onClick={onClick}
    >
      <div className="route-button-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {recommended && <small>RECOMMENDED</small>}
    </button>
  );
}

function formatActivityTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

"use client";

import {
  CheckCircle2,
  ChevronDown,
  Filter,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./ScoutDiscoveryEnhancer.module.css";

type PracticePreset =
  | "catastrophic_pi"
  | "plaintiff_pi"
  | "adjacent_practice"
  | "criminal_defense"
  | "family_law"
  | "probate_estate"
  | "medical_defense"
  | "employment"
  | "real_estate"
  | "business_corporate"
  | "any";

type ScoutForm = {
  state: string;
  practicePreset: PracticePreset;
  catastrophicOnly: boolean;
  maxResults: number;
  minFitScore: number;
  oneContactPerFirm: boolean;
  excludeExisting: boolean;
  excludeSuppressed: boolean;
};

type RunAck = {
  ok?: boolean;
  accepted?: boolean;
  message?: string;
  error?: string;
  request?: Record<string, any>;
};

const STATES = [
  ["United States", "ALL"],
  ["Alabama", "AL"],
  ["Alaska", "AK"],
  ["Arizona", "AZ"],
  ["Arkansas", "AR"],
  ["California", "CA"],
  ["Colorado", "CO"],
  ["Connecticut", "CT"],
  ["Delaware", "DE"],
  ["Florida", "FL"],
  ["Georgia", "GA"],
  ["Hawaii", "HI"],
  ["Idaho", "ID"],
  ["Illinois", "IL"],
  ["Indiana", "IN"],
  ["Iowa", "IA"],
  ["Kansas", "KS"],
  ["Kentucky", "KY"],
  ["Louisiana", "LA"],
  ["Maine", "ME"],
  ["Maryland", "MD"],
  ["Massachusetts", "MA"],
  ["Michigan", "MI"],
  ["Minnesota", "MN"],
  ["Mississippi", "MS"],
  ["Missouri", "MO"],
  ["Montana", "MT"],
  ["Nebraska", "NE"],
  ["Nevada", "NV"],
  ["New Hampshire", "NH"],
  ["New Jersey", "NJ"],
  ["New Mexico", "NM"],
  ["New York", "NY"],
  ["North Carolina", "NC"],
  ["North Dakota", "ND"],
  ["Ohio", "OH"],
  ["Oklahoma", "OK"],
  ["Oregon", "OR"],
  ["Pennsylvania", "PA"],
  ["Rhode Island", "RI"],
  ["South Carolina", "SC"],
  ["South Dakota", "SD"],
  ["Tennessee", "TN"],
  ["Texas", "TX"],
  ["Utah", "UT"],
  ["Vermont", "VT"],
  ["Virginia", "VA"],
  ["Washington", "WA"],
  ["West Virginia", "WV"],
  ["Wisconsin", "WI"],
  ["Wyoming", "WY"],
] as const;

const PRACTICE_OPTIONS: Array<{
  value: PracticePreset;
  label: string;
  description: string;
}> = [
  {
    value: "catastrophic_pi",
    label: "Catastrophic / Serious Injury PI",
    description:
      "Plaintiff firms emphasizing catastrophic injury, TBI, spinal cord, wrongful death, trucking, or other serious-injury work.",
  },
  {
    value: "plaintiff_pi",
    label: "Plaintiff Personal Injury",
    description:
      "Plaintiff PI firms for reciprocal geography, conflict, capacity, and co-counsel relationships.",
  },
  {
    value: "adjacent_practice",
    label: "Adjacent Practices",
    description:
      "Non-competing practices likely to encounter PI or immigration matters.",
  },
  {
    value: "criminal_defense",
    label: "Criminal Defense",
    description:
      "Criminal defense firms that may encounter injury and immigration overlap.",
  },
  {
    value: "family_law",
    label: "Family Law",
    description:
      "Family and matrimonial firms with reciprocal referral potential.",
  },
  {
    value: "probate_estate",
    label: "Probate / Estate",
    description:
      "Probate, estate, elder-law, and wrongful-death-adjacent firms.",
  },
  {
    value: "medical_defense",
    label: "Medical Malpractice Defense / Health Care",
    description:
      "Defense and healthcare practices that can create conflict or cross-referral opportunities.",
  },
  {
    value: "employment",
    label: "Employment",
    description:
      "Employment firms with adjacent professional referral potential.",
  },
  {
    value: "real_estate",
    label: "Real Estate",
    description:
      "Real-estate firms for reciprocal non-PI relationships.",
  },
  {
    value: "business_corporate",
    label: "Business / Corporate",
    description:
      "Business, corporate, and commercial firms for cross-practice referrals.",
  },
  {
    value: "any",
    label: "Any Strong Referral Fit",
    description:
      "Let Scout search broadly and rank the best professional referral relationships.",
  },
];

const DEFAULT_FORM: ScoutForm = {
  state: "FL",
  practicePreset: "catastrophic_pi",
  catastrophicOnly: true,
  maxResults: 10,
  minFitScore: 75,
  oneContactPerFirm: true,
  excludeExisting: true,
  excludeSuppressed: true,
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function buttonLabel(button: HTMLButtonElement) {
  return cleanText(button.textContent)
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isScoutDiscoveryButton(button: HTMLButtonElement) {
  const label = buttonLabel(button);

  return (
    label === "run scout discovery" ||
    label === "scout running…"
  );
}

function findButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest("button") as HTMLButtonElement | null;
}

function findCardOrganization(card: HTMLElement) {
  return cleanText(card.querySelector("h3")?.textContent).toLowerCase();
}

function findDraftButton(card: HTMLElement) {
  return Array.from(
    card.querySelectorAll<HTMLButtonElement>("button")
  ).find((button) =>
    buttonLabel(button).includes("draft outreach")
  );
}

function findRelationshipSelect(card: HTMLElement) {
  return Array.from(
    card.querySelectorAll<HTMLSelectElement>("select")
  ).find((select) =>
    [
      "new",
      "researching",
      "approved",
      "contacted",
      "replied",
      "meeting",
      "partner",
      "not_fit",
    ].includes(String(select.value || "").toLowerCase())
  );
}

function draftAllowed(status: string) {
  return [
    "approved",
    "contacted",
    "replied",
    "meeting",
  ].includes(status.toLowerCase());
}

function stateName(code: string) {
  if (code === "ALL") return "United States";
  return STATES.find((item) => item[1] === code)?.[0] || code;
}

function buildTargetCategories(form: ScoutForm) {
  switch (form.practicePreset) {
    case "catastrophic_pi":
      return [
        "catastrophic injury law firm",
        "serious injury law firm",
        "traumatic brain injury lawyer",
        "spinal cord injury lawyer",
        "wrongful death lawyer",
        "truck accident lawyer",
        "nursing home abuse lawyer",
      ];

    case "plaintiff_pi":
      return [
        "personal injury attorney",
        "car accident lawyer",
        "truck accident lawyer",
        "wrongful death attorney",
        "premises liability lawyer",
        "motorcycle accident lawyer",
      ];

    case "criminal_defense":
      return ["criminal defense attorney"];

    case "family_law":
      return ["family law attorney", "divorce attorney"];

    case "probate_estate":
      return [
        "probate attorney",
        "estate planning attorney",
        "elder law attorney",
      ];

    case "medical_defense":
      return [
        "medical malpractice defense attorney",
        "health care attorney",
        "hospital defense law firm",
      ];

    case "employment":
      return ["employment attorney", "labor law attorney"];

    case "real_estate":
      return ["real estate attorney"];

    case "business_corporate":
      return [
        "business attorney",
        "corporate attorney",
        "commercial litigation attorney",
      ];

    case "adjacent_practice":
      return [
        "criminal defense attorney",
        "family law attorney",
        "probate attorney",
        "estate planning attorney",
        "employment attorney",
        "real estate attorney",
        "business attorney",
        "medical malpractice defense attorney",
      ];

    default:
      return [
        "personal injury attorney",
        "criminal defense attorney",
        "family law attorney",
        "probate attorney",
        "employment attorney",
        "real estate attorney",
        "business attorney",
        "medical malpractice defense attorney",
      ];
  }
}

function practiceLabel(value: PracticePreset) {
  return (
    PRACTICE_OPTIONS.find((item) => item.value === value)?.label ||
    "Any Strong Referral Fit"
  );
}

export default function ScoutDiscoveryEnhancer() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ScoutForm>(DEFAULT_FORM);
  const [phase, setPhase] = useState<
    "idle" | "submitting" | "accepted" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const optimisticStatuses = useRef<Map<string, string>>(new Map());
  const cleanupTimers = useRef<Map<string, number>>(new Map());

  const selectedPractice = useMemo(
    () =>
      PRACTICE_OPTIONS.find(
        (item) => item.value === form.practicePreset
      ) || PRACTICE_OPTIONS[PRACTICE_OPTIONS.length - 1],
    [form.practicePreset]
  );

  const applyOptimisticDraftState = useCallback(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("article")
    );

    for (const card of cards) {
      const organization = findCardOrganization(card);
      if (!organization) continue;

      const stored = optimisticStatuses.current.get(organization);
      const select = findRelationshipSelect(card);

      const effectiveStatus =
        stored || cleanText(select?.value).toLowerCase();

      const draftButton = findDraftButton(card);

      if (!draftButton) continue;

      if (draftAllowed(effectiveStatus)) {
        draftButton.disabled = false;
        draftButton.removeAttribute("disabled");
        draftButton.dataset.optimisticReady = "true";
        draftButton.title = "Create a Reach outreach draft";
      } else if (draftButton.dataset.optimisticReady === "true") {
        draftButton.dataset.optimisticReady = "false";
      }
    }
  }, []);

  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      const button = findButton(event.target);
      if (!button || !isScoutDiscoveryButton(button)) return;

      /*
      |--------------------------------------------------------------------------
      | Replace the page's immediate Scout run with a targeted-search setup modal.
      |--------------------------------------------------------------------------
      */

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (button.disabled) return;

      setPhase("idle");
      setMessage("");
      setOpen(true);
    };

    const changeHandler = (event: Event) => {
      if (!(event.target instanceof HTMLSelectElement)) return;

      const select = event.target;
      const status = cleanText(select.value).toLowerCase();

      if (
        ![
          "new",
          "researching",
          "approved",
          "contacted",
          "replied",
          "meeting",
          "partner",
          "not_fit",
        ].includes(status)
      ) {
        return;
      }

      const card = select.closest("article") as HTMLElement | null;
      if (!card) return;

      const organization = findCardOrganization(card);
      if (!organization) return;

      /*
      |--------------------------------------------------------------------------
      | The original page waits for POST + full workspace reload before its
      | React copy of relationship_status changes. That is why Draft Outreach
      | appears stuck after choosing Approved.
      |
      | Preserve the user's selected status locally while the existing page
      | saves normally in the background.
      |--------------------------------------------------------------------------
      */

      optimisticStatuses.current.set(organization, status);

      const oldTimer = cleanupTimers.current.get(organization);
      if (oldTimer) window.clearTimeout(oldTimer);

      cleanupTimers.current.set(
        organization,
        window.setTimeout(() => {
          optimisticStatuses.current.delete(organization);
          cleanupTimers.current.delete(organization);
          applyOptimisticDraftState();
        }, 30000)
      );

      window.setTimeout(applyOptimisticDraftState, 0);
      window.setTimeout(applyOptimisticDraftState, 50);
      window.setTimeout(applyOptimisticDraftState, 250);
      window.setTimeout(applyOptimisticDraftState, 1000);
    };

    document.addEventListener("click", clickHandler, true);
    document.addEventListener("change", changeHandler, true);

    const observer = new MutationObserver(() => {
      applyOptimisticDraftState();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "value"],
    });

    applyOptimisticDraftState();

    return () => {
      document.removeEventListener("click", clickHandler, true);
      document.removeEventListener("change", changeHandler, true);
      observer.disconnect();

      for (const timer of cleanupTimers.current.values()) {
        window.clearTimeout(timer);
      }

      cleanupTimers.current.clear();
    };
  }, [applyOptimisticDraftState]);

  async function runScout() {
    if (phase === "submitting") return;

    setPhase("submitting");
    setMessage("");

    const geography =
      form.state === "ALL"
        ? "United States"
        : `${stateName(form.state)}, United States`;

    const requestPayload = {
      mode: "standard_test",
      requestedFrom: "scout_targeted_discovery",
      searchStrategy: "targeted_referral_discovery",

      geography,
      states: form.state === "ALL" ? [] : [form.state],
      stateNames:
        form.state === "ALL" ? [] : [stateName(form.state)],

      practicePreset: form.practicePreset,
      practiceFocus: practiceLabel(form.practicePreset),
      targetCategories: buildTargetCategories(form),

      catastrophicOnly:
        form.practicePreset === "catastrophic_pi"
          ? true
          : Boolean(form.catastrophicOnly),

      plaintiffPiOnly:
        ["catastrophic_pi", "plaintiff_pi"].includes(
          form.practicePreset
        ),

      adjacentPracticeOnly:
        form.practicePreset === "adjacent_practice",

      minFitScore: form.minFitScore,
      maxResults: form.maxResults,

      uniqueFirms: true,
      oneContactPerFirm: form.oneContactPerFirm,

      excludeExisting: form.excludeExisting,
      excludeSuppressed: form.excludeSuppressed,

      /*
      |--------------------------------------------------------------------------
      | Current app remains in Apollo test mode. The server route enforces the
      | hard hourly cap, so this UI cannot accidentally bypass it.
      |--------------------------------------------------------------------------
      */

      apollo: {
        mode: "test",
        maxCallsPerHour: 10,
        maxSearchCallsThisRun: 2,
        maxEnrichmentCallsThisRun: 1,
        peoplePerSearch: 25,
        maxContactsPerFirm: form.oneContactPerFirm ? 1 : 3,
      },
    };

    try {
      const response = await fetch("/api/pi/agents/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: "scout",
          request: requestPayload,
        }),
      });

      const data = (await response.json()) as RunAck;

      if (!response.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Scout discovery could not be started."
        );
      }

      setPhase("accepted");
      setMessage(
        data?.message ||
          "Scout accepted the targeted discovery request."
      );

      /*
      | The normal PI page already refreshes on navigation/manual refresh.
      | Give n8n time to begin, then close the setup window.
      */
      window.setTimeout(() => {
        setOpen(false);
        setPhase("idle");
        setMessage("");
      }, 1800);
    } catch (error) {
      setPhase("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Scout discovery could not be started."
      );
    }
  }

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <section className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.headerIcon}>
            <Search size={21} />
          </div>

          <div className={styles.headerCopy}>
            <span>SCOUT · TARGETED DISCOVERY</span>
            <h2>Build This Scout Search</h2>
            <p>
              Choose the geography and referral profile before Scout spends
              research or Apollo calls.
            </p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close Scout search setup"
          >
            <X size={17} />
          </button>
        </div>

        <div className={styles.summaryBar}>
          <div>
            <MapPin size={14} />
            <span>GEOGRAPHY</span>
            <strong>{stateName(form.state)}</strong>
          </div>

          <div>
            <Sparkles size={14} />
            <span>TARGET</span>
            <strong>{practiceLabel(form.practicePreset)}</strong>
          </div>

          <div>
            <ShieldCheck size={14} />
            <span>DEDUPING</span>
            <strong>
              {form.excludeExisting ? "Existing firms excluded" : "Disabled"}
            </strong>
          </div>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>STATE / GEOGRAPHY</span>
            <div className={styles.selectWrap}>
              <select
                value={form.state}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    state: event.target.value,
                  }))
                }
              >
                {STATES.map(([name, code]) => (
                  <option value={code} key={code}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
            <small>
              Florida + catastrophic PI is a strong overflow/referral search.
              You can switch to any state for reciprocal geography.
            </small>
          </label>

          <label className={styles.field}>
            <span>PRACTICE / RELATIONSHIP TARGET</span>
            <div className={styles.selectWrap}>
              <select
                value={form.practicePreset}
                onChange={(event) => {
                  const next = event.target.value as PracticePreset;

                  setForm((current) => ({
                    ...current,
                    practicePreset: next,
                    catastrophicOnly:
                      next === "catastrophic_pi"
                        ? true
                        : next === "plaintiff_pi"
                        ? current.catastrophicOnly
                        : false,
                  }));
                }}
              >
                {PRACTICE_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
            <small>{selectedPractice.description}</small>
          </label>

          <label className={styles.field}>
            <span>MAX FIRMS THIS RUN</span>
            <input
              type="number"
              min={1}
              max={10}
              value={form.maxResults}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  maxResults: Math.max(
                    1,
                    Math.min(10, Number(event.target.value || 1))
                  ),
                }))
              }
            />
            <small>
              The current server is still in Apollo test mode, so one run is
              capped at 10 firms.
            </small>
          </label>

          <label className={styles.field}>
            <span>MINIMUM SCOUT FIT SCORE</span>
            <input
              type="number"
              min={50}
              max={100}
              step={5}
              value={form.minFitScore}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  minFitScore: Math.max(
                    50,
                    Math.min(100, Number(event.target.value || 75))
                  ),
                }))
              }
            />
            <small>
              Candidates below this score should be dropped before saving.
            </small>
          </label>
        </div>

        <div className={styles.toggleGrid}>
          <label
            className={`${styles.toggleCard} ${
              form.catastrophicOnly ? styles.toggleCardActive : ""
            }`}
          >
            <input
              type="checkbox"
              checked={form.catastrophicOnly}
              disabled={form.practicePreset === "catastrophic_pi"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  catastrophicOnly: event.target.checked,
                }))
              }
            />
            <div>
              <strong>Require catastrophic focus</strong>
              <span>
                Keep only firms with verified serious/catastrophic plaintiff PI
                positioning.
              </span>
            </div>
            {form.catastrophicOnly ? <CheckCircle2 size={17} /> : null}
          </label>

          <label
            className={`${styles.toggleCard} ${
              form.excludeExisting ? styles.toggleCardActive : ""
            }`}
          >
            <input
              type="checkbox"
              checked={form.excludeExisting}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  excludeExisting: event.target.checked,
                }))
              }
            />
            <div>
              <strong>Skip firms already in Scout</strong>
              <span>
                Prevent Tavily/OpenAI/Apollo work from being spent on firms
                already stored.
              </span>
            </div>
            {form.excludeExisting ? <CheckCircle2 size={17} /> : null}
          </label>

          <label
            className={`${styles.toggleCard} ${
              form.excludeSuppressed ? styles.toggleCardActive : ""
            }`}
          >
            <input
              type="checkbox"
              checked={form.excludeSuppressed}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  excludeSuppressed: event.target.checked,
                }))
              }
            />
            <div>
              <strong>Respect suppression / cooling</strong>
              <span>
                Do not recycle do-not-contact, suppressed, active, or cooling
                firms.
              </span>
            </div>
            {form.excludeSuppressed ? <CheckCircle2 size={17} /> : null}
          </label>

          <label
            className={`${styles.toggleCard} ${
              form.oneContactPerFirm ? styles.toggleCardActive : ""
            }`}
          >
            <input
              type="checkbox"
              checked={form.oneContactPerFirm}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  oneContactPerFirm: event.target.checked,
                }))
              }
            />
            <div>
              <strong>One primary contact per firm</strong>
              <span>
                Save Apollo spend now; Orbit can rotate to contact #2 after the
                20-day cycle.
              </span>
            </div>
            {form.oneContactPerFirm ? <CheckCircle2 size={17} /> : null}
          </label>
        </div>

        {message ? (
          <div
            className={
              phase === "error"
                ? styles.errorMessage
                : styles.successMessage
            }
          >
            {phase === "accepted" ? <CheckCircle2 size={15} /> : null}
            {message}
          </div>
        ) : null}

        <div className={styles.footer}>
          <div className={styles.footerNote}>
            <Filter size={14} />
            These filters are passed to the existing Scout n8n branch. Use the
            n8n node patches in the included README so Apollo + Tavily actually
            honor them.
          </div>

          <button
            type="button"
            className={styles.runButton}
            onClick={() => void runScout()}
            disabled={phase === "submitting"}
          >
            {phase === "submitting" ? (
              <Loader2 size={15} className={styles.spin} />
            ) : (
              <Search size={15} />
            )}
            {phase === "submitting"
              ? "Starting Scout…"
              : "Run Targeted Scout"}
          </button>
        </div>
      </section>
    </div>
  );
}

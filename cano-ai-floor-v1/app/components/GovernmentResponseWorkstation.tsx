"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  FileDown,
  FilePenLine,
  ExternalLink,
  Landmark,
  Loader2,
  RefreshCw,
  Save,
  Scale,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { StoredCaseMatter } from "./CaseBrainWorkstation";
import styles from "./GovernmentResponseWorkstation.module.css";

type ResponseType =
  | "habeas_return"
  | "habeas_opposition"
  | "motion_to_dismiss"
  | "bond_opposition"
  | "other";

type LegalAuthority = {
  kind?: string;
  title?: string;
  citation?: string | null;
  court?: string | null;
  date?: string | null;
  binding_status?: "binding" | "persuasive" | "unknown" | string;
  precedential_status?: string | null;
  url?: string;
  proposition?: string;
  quote?: string | null;
  quote_status?: string;
  relevance?: string;
  source_provider?: string;
  citator_status?: string;
  _sourceAgent?: string;
};

type RebuttalState = {
  run?: {
    id?: string;
    status?: string;
    started_at?: string;
    completed_at?: string | null;
    error_message?: string | null;
    input_payload?: Record<string, any>;
  } | null;
  output?: {
    title?: string;
    executive_summary?: string;
    readiness?: {
      status?: string;
      attorney_review_required?: boolean;
      blocking_items?: string[];
    };
    warnings?: string[];
    next_actions?: string[];
    open_questions?: string[];
    jurisdiction?: {
      circuit?: string | null;
      district?: string | null;
      basis?: string;
      confidence?: string;
    } | null;
    authorities?: LegalAuthority[];
    draft?: {
      document_type?: string;
      title?: string;
      markdown?: string;
      approval_status?: string;
      template_status?: string;
      placeholders?: string[];
      authority_checklist?: Array<{
        authority?: string;
        status?: string;
        note?: string;
      }>;
    } | null;
  } | null;
};

const RESPONSE_TYPES: Array<{
  value: ResponseType;
  label: string;
}> = [
  {
    value: "habeas_return",
    label: "Government Return / Response to Habeas",
  },
  {
    value: "habeas_opposition",
    label: "Opposition to Habeas / Petition",
  },
  {
    value: "motion_to_dismiss",
    label: "Government Motion to Dismiss",
  },
  {
    value: "bond_opposition",
    label: "Government Bond Opposition",
  },
  {
    value: "other",
    label: "Other Government Filing",
  },
];

const INLINE_PLACEHOLDER_MAP: Record<
  string,
  { short: string; detail: string }
> = {
  "PETITIONER NAME TBD": {
    short: "PETITIONER NAME TBD",
    detail: "Confirm the petitioner's full legal name exactly as it should appear in the caption.",
  },
  "RESPONDENT(S) TBD": {
    short: "RESPONDENT(S) TBD",
    detail: "Confirm the correct respondent name(s) and titles for this filing.",
  },
  "RESPONDENT TBD": {
    short: "RESPONDENT TBD",
    detail: "Confirm the correct respondent / immediate custodian.",
  },
  "DISTRICT DIVISION TBD": {
    short: "DISTRICT DIVISION TBD",
    detail: "Confirm the correct federal district and division before filing.",
  },
  "DISTRICT TBD": {
    short: "DISTRICT TBD",
    detail: "Confirm the correct federal district before filing.",
  },
  "DIVISION TBD": {
    short: "DIVISION TBD",
    detail: "Confirm the correct federal court division before filing.",
  },
  "CASE NO. TBD": {
    short: "CASE NO. TBD",
    detail: "Insert the civil action number / case number.",
  },
  "A-NUMBER TBD": {
    short: "A-NUMBER TBD",
    detail: "Confirm the detainee's A-number.",
  },
  "DATE TBD": {
    short: "DATE TBD",
    detail: "Insert the applicable filing, signature, or certificate date.",
  },
  "LAW FIRM NAME TBD": {
    short: "LAW FIRM NAME TBD",
    detail: "Confirm the law firm name for the signature block.",
  },
  "ATTORNEY NAME TBD": {
    short: "ATTORNEY NAME TBD",
    detail: "Confirm the attorney name for the signature block.",
  },
  "ATTORNEY TITLE TBD": {
    short: "ATTORNEY TITLE TBD",
    detail: "Confirm the attorney title for the signature block.",
  },
  "BAR NO. TBD": {
    short: "BAR NO. TBD",
    detail: "Insert the attorney bar number.",
  },
  "ADDRESS TBD": {
    short: "ADDRESS TBD",
    detail: "Insert the filing attorney / firm address.",
  },
  "PHONE TBD": {
    short: "PHONE TBD",
    detail: "Insert the filing attorney / firm phone number.",
  },
  "EMAIL TBD": {
    short: "EMAIL TBD",
    detail: "Insert the filing attorney / firm email address.",
  },
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizePlaceholder(value: string) {
  return String(value || "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizePlaceholderKey(raw: string) {
  return String(raw || "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function shortPlaceholderLabel(raw: string) {
  const normalized = normalizePlaceholderKey(raw);
  const mapped = INLINE_PLACEHOLDER_MAP[normalized];
  if (mapped) return mapped.short;

  const cleaned = normalized
    .replace(/^ATTORNEY INPUT NEEDED:\s*/i, "")
    .replace(/^ATTORNEY \/ RESEARCH INPUT NEEDED:\s*/i, "")
    .replace(/^(CONFIRM|INSERT|PROVIDE|VERIFY|OBTAIN|REVIEW)\s+/i, "")
    .trim();

  if (!cleaned) return "INPUT TBD";
  if (/\bTBD\b$/i.test(cleaned)) return cleaned;
  if (cleaned.length <= 30) return `${cleaned} TBD`;

  const firstMeaningful = cleaned
    .split(/[,;:–—-]/)[0]
    .trim()
    .slice(0, 28)
    .trim();

  return `${firstMeaningful || "INPUT"} TBD`;
}

function placeholderDetail(raw: string) {
  const normalized = normalizePlaceholderKey(raw);

  if (INLINE_PLACEHOLDER_MAP[normalized]) {
    return INLINE_PLACEHOLDER_MAP[normalized].detail;
  }

  return String(raw || "")
    .replace(/^\[?ATTORNEY INPUT NEEDED:\s*/i, "")
    .replace(/^\[?ATTORNEY \/ RESEARCH INPUT NEEDED:\s*/i, "")
    .replace(/\]$/, "")
    .trim();
}

function looksEditablePlaceholder(token: string) {
  const normalized = normalizePlaceholderKey(token);

  return (
    /^ATTORNEY INPUT NEEDED:/i.test(normalized) ||
    /^ATTORNEY \/ RESEARCH INPUT NEEDED:/i.test(normalized) ||
    /\bTBD\b/i.test(normalized) ||
    /\bTO BE DETERMINED\b/i.test(normalized) ||
    /^INSERT\b/i.test(normalized) ||
    /^CONFIRM\b/i.test(normalized) ||
    /^VERIFY\b/i.test(normalized) ||
    /^OBTAIN\b/i.test(normalized) ||
    /^REVIEW\b/i.test(normalized)
  );
}

export default function GovernmentResponseWorkstation({
  matter,
  onClose,
}: {
  matter: StoredCaseMatter | null;
  onClose: () => void;
}) {
  const mondayItemId = clean(matter?.mondayItemId || matter?.matterId);
  const storageKey = mondayItemId
    ? `cano_government_response_${mondayItemId}`
    : "";

  const attorneyInputStorageKey = mondayItemId
    ? `cano_rhea_attorney_inputs_${mondayItemId}`
    : "";

  const [responseType, setResponseType] =
    useState<ResponseType>("habeas_return");
  const [governmentResponseText, setGovernmentResponseText] = useState("");
  const [attorneyInstructions, setAttorneyInstructions] = useState("");
  const [attorneyInputs, setAttorneyInputs] = useState<Record<string, string>>({});
  const [activePlaceholder, setActivePlaceholder] = useState<string | null>(null);
  const [inputsSaved, setInputsSaved] = useState(false);
  const [state, setState] = useState<RebuttalState>({});
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [error, setError] = useState("");

  const output = state.output || null;
  const draft = output?.draft || null;
  const status =
    clean(state.run?.status) ||
    (draft?.markdown ? "review_ready" : "ready");

  const draftingRunInput = state.run?.input_payload || null;

  const authorityPool = useMemo<LegalAuthority[]>(() => {
    const candidates: LegalAuthority[] = [];
    const seen = new Set<string>();

    function addMany(
      values: unknown,
      sourceAgent: string
    ) {
      if (!Array.isArray(values)) return;

      for (const raw of values) {
        if (!raw || typeof raw !== "object") continue;

        const authority = raw as LegalAuthority;

        const key =
          clean(authority.citation).toLowerCase() ||
          clean(authority.url).toLowerCase() ||
          clean(authority.title).toLowerCase();

        if (!key || seen.has(key)) continue;

        seen.add(key);

        candidates.push({
          ...authority,
          _sourceAgent: sourceAgent,
        });
      }
    }

    /*
    | Current Rhea output comes first because these are the authorities the
    | response agent expressly selected for this reply.
    */
    addMany(output?.authorities, "Rhea");

    const prior =
      draftingRunInput?.prior_specialists &&
      typeof draftingRunInput.prior_specialists === "object"
        ? draftingRunInput.prior_specialists
        : {};

    /*
    | Elena is the primary habeas authority source. Lex remains useful for
    | additional verified research. Atlas/Scribe may also preserve authority
    | records from the matter pipeline, so include them as lower-priority
    | deduplicated fallbacks.
    */
    addMany(prior?.habeas?.authorities, "Elena");
    addMany(prior?.research?.authorities, "Lex");
    addMany(prior?.synthesis?.authorities, "Atlas");
    addMany(prior?.drafting?.authorities, "Scribe");

    return candidates;
  }, [draftingRunInput, output?.authorities]);

  const citedAuthorities = useMemo(() => {
    const markdown =
      String(draft?.markdown || "").toLowerCase();

    const checklist =
      Array.isArray(draft?.authority_checklist)
        ? draft.authority_checklist
            .map((item) =>
              `${clean(item?.authority)} ${clean(item?.note)}`
                .toLowerCase()
            )
            .join(" ")
        : "";

    function normalizedTitle(value: unknown) {
      return clean(value)
        .toLowerCase()
        .replace(/\bet al\.?/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function titleSignals(value: unknown) {
      const normalized = normalizedTitle(value);

      if (!normalized) return [];

      const pieces = normalized
        .split(/\s+v\s+|\s+vs\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

      return [
        normalized,
        ...pieces.filter((item) => item.length >= 5),
      ];
    }

    return authorityPool.filter((authority) => {
      const citation =
        clean(authority.citation).toLowerCase();

      if (
        citation &&
        (
          markdown.includes(citation) ||
          checklist.includes(citation)
        )
      ) {
        return true;
      }

      const signals =
        titleSignals(authority.title);

      return signals.some(
        (signal) =>
          signal.length >= 5 &&
          (
            markdown.includes(signal) ||
            checklist.includes(signal)
          )
      );
    });
  }, [
    authorityPool,
    draft?.markdown,
    draft?.authority_checklist,
  ]);

  const detaineeName = useMemo(
    () =>
      clean(
        matter?.caseBrain?.people?.detainee?.name ||
          matter?.caseBrain?.people?.detainee?.full_name ||
          matter?.monday?.preview?.detaineeName ||
          matter?.monday?.preview?.name ||
          mondayItemId ||
          "No Active Matter"
      ),
    [matter, mondayItemId]
  );

  const placeholders = useMemo(() => {
    const explicit = Array.isArray(draft?.placeholders)
      ? draft.placeholders
          .map((item) => clean(item))
          .filter(Boolean)
      : [];

    const markdown = String(draft?.markdown || "");

    const inferred =
      (markdown.match(/\[[^\]\n]{2,220}\]/g) || [])
        .filter(looksEditablePlaceholder)
        .map((item) => item.trim());

    const seen = new Set<string>();
    const combined: string[] = [];

    for (const item of [...explicit, ...inferred]) {
      const key = normalizePlaceholder(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      combined.push(item);
    }

    return combined;
  }, [draft]);

  const completedInputs = placeholders.filter(
    (item) => clean(attorneyInputs[item]).length > 0
  ).length;

  function placeholderAliases(item: string) {
    const normalized = normalizePlaceholder(item);
    const short = normalizePlaceholder(shortPlaceholderLabel(item));
    const cleaned = normalizePlaceholder(
      String(item || "")
        .replace(/^\[?ATTORNEY INPUT NEEDED:\s*/i, "")
        .replace(/^\[?ATTORNEY \/ RESEARCH INPUT NEEDED:\s*/i, "")
        .replace(/\]$/, "")
        .replace(
          /^(confirm|insert|provide|verify|obtain|review)\s+/i,
          ""
        )
        .trim()
    );

    return Array.from(new Set([normalized, short, cleaned].filter(Boolean)));
  }

  function resolvePlaceholderFromDraft(part: string) {
    const normalized = normalizePlaceholder(part);

    const exact = placeholders.find((item) =>
      placeholderAliases(item).includes(normalized)
    );

    if (exact) return exact;

    const compactNeedle = normalized
      .replace(/^attorney input needed:\s*/i, "")
      .replace(/^attorney \/ research input needed:\s*/i, "")
      .replace(
        /^(confirm|insert|provide|verify|obtain|review)\s+/i,
        ""
      )
      .trim();

    const fuzzy = placeholders.find((item) =>
      placeholderAliases(item).some((alias) => {
        const compactAlias = alias
          .replace(/^attorney input needed:\s*/i, "")
          .replace(/^attorney \/ research input needed:\s*/i, "")
          .replace(
            /^(confirm|insert|provide|verify|obtain|review)\s+/i,
            ""
          )
          .trim();

        return (
          compactAlias === compactNeedle ||
          compactAlias.replace(/\btbd\b$/i, "").trim() ===
            compactNeedle.replace(/\btbd\b$/i, "").trim()
        );
      })
    );

    return fuzzy || part;
  }

  function isEditablePlaceholderToken(part: string) {
    if (!/^\[[^\]\n]+\]$/.test(part)) return false;

    const resolved = resolvePlaceholderFromDraft(part);
    return placeholders.includes(resolved) || looksEditablePlaceholder(part);
  }

  function renderHighlightedDraft(markdown: string) {
    const parts = String(markdown || "").split(/(\[[^\]\n]{2,220}\])/g);

    return parts.map((part, index) => {
      if (!isEditablePlaceholderToken(part)) {
        return <span key={index}>{part}</span>;
      }

      const key = resolvePlaceholderFromDraft(part);
      const completed = Boolean(clean(attorneyInputs[key]));

      return (
        <button
          key={index}
          type="button"
          className={`${styles.placeholderHighlight} ${
            completed ? styles.placeholderComplete : ""
          }`}
          title={placeholderDetail(key)}
          onClick={() => setActivePlaceholder(key)}
        >
          [{shortPlaceholderLabel(key)}]
        </button>
      );
    });
  }

  function saveAttorneyInputs(next = attorneyInputs) {
    if (!attorneyInputStorageKey || typeof window === "undefined") return;

    window.localStorage.setItem(
      attorneyInputStorageKey,
      JSON.stringify(next)
    );

    setInputsSaved(true);
    window.setTimeout(() => setInputsSaved(false), 1400);
  }

  function updateAttorneyInput(key: string, value: string) {
    const next = {
      ...attorneyInputs,
      [key]: value,
    };

    setAttorneyInputs(next);

    if (attorneyInputStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(
        attorneyInputStorageKey,
        JSON.stringify(next)
      );
    }
  }

  function scrollToInputEditor(focusPlaceholder?: string) {
    const editor = document.getElementById("rhea-attorney-input-editor");
    editor?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    if (!focusPlaceholder) return;

    const index = placeholders.findIndex(
      (item) =>
        normalizePlaceholder(item) ===
        normalizePlaceholder(focusPlaceholder)
    );

    if (index >= 0) {
      window.setTimeout(() => {
        const field = document.getElementById(
          `rhea-attorney-input-${index}`
        ) as HTMLTextAreaElement | null;

        field?.focus();
      }, 450);
    }
  }

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (
        RESPONSE_TYPES.some(
          (item) => item.value === parsed?.responseType
        )
      ) {
        setResponseType(parsed.responseType);
      }

      setGovernmentResponseText(
        clean(parsed?.governmentResponseText)
      );

      setAttorneyInstructions(
        clean(parsed?.attorneyInstructions)
      );
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        responseType,
        governmentResponseText,
        attorneyInstructions,
      })
    );
  }, [
    storageKey,
    responseType,
    governmentResponseText,
    attorneyInstructions,
  ]);

  useEffect(() => {
    if (!attorneyInputStorageKey || typeof window === "undefined") {
      setAttorneyInputs({});
      return;
    }

    try {
      const saved = window.localStorage.getItem(
        attorneyInputStorageKey
      );

      setAttorneyInputs(
        saved ? JSON.parse(saved) : {}
      );
    } catch {
      setAttorneyInputs({});
    }
  }, [attorneyInputStorageKey]);

  async function loadState() {
    if (!mondayItemId) return;

    setLoading(true);

    try {
      const res = await fetch(
        `/api/agents/state?mondayItemId=${encodeURIComponent(
          mondayItemId
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
            "Unable to load Rhea."
        );
      }

      setState(
        data?.agents?.rebuttal || {}
      );

      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Rhea."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mondayItemId]);

  async function runRebuttal(useAttorneyInputs = false) {
    if (!matter || !mondayItemId || running) return;

    const pasted = clean(governmentResponseText);

    if (pasted.length < 100) {
      setError(
        "Paste the government's substantive filing before running Rhea."
      );
      return;
    }

    if (useAttorneyInputs) {
      saveAttorneyInputs();
    }

    const resolvedAttorneyInputs = useAttorneyInputs
      ? Object.fromEntries(
          Object.entries(attorneyInputs).filter(
            ([, value]) => clean(value).length > 0
          )
        )
      : {};

    setRunning(true);
    setError("");

    try {
      const res = await fetch(
        "/api/rebuttal/run",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            mondayItemId,
            agentId:
              "rebuttal",
            triggerType:
              state.run
                ? "refresh"
                : "manual",
            options: {
              responseType,
              governmentResponseText:
                pasted,
              attorneyInstructions:
                clean(
                  attorneyInstructions
                ),
              attorneyInputs:
                resolvedAttorneyInputs,
              attorneyInputInstructions:
                useAttorneyInputs
                  ? [
                      "Treat each attorneyInputs value as attorney-supplied matter information.",
                      "Use the supplied value to resolve the matching placeholder in the regenerated reply.",
                      "Remove resolved TBD / ATTORNEY INPUT NEEDED language from the regenerated draft.",
                      "Do not alter unrelated facts merely because attorney input was supplied.",
                      "If attorney input conflicts with Case Brain or verified matter data, preserve and flag the conflict rather than silently resolving it.",
                    ]
                  : [],
              draftingMode:
                "government_response_reply",
              requestedOutput:
                "complete_reply_draft",
              attorneyWorkProduct:
                true,
              draftingRequirements: [
                "Analyze the government filing point by point before drafting.",
                "Treat government statements as assertions unless independently verified.",
                "Compare the filing against Case Brain and prior specialist work, including the original Scribe draft.",
                "Identify concessions, factual disputes, procedural defenses, cited authority, adverse points, and unanswered original arguments.",
                "Do not invent facts, holdings, citations, quotations, deadlines, docket events, or procedural history.",
                "Review prior_specialists.habeas.authorities from Elena first, then prior_specialists.research.authorities from Lex, before selecting case law for the reply.",
                "Prefer binding Supreme Court and controlling circuit authority when it directly supports the proposition; use persuasive district or out-of-circuit authority only when useful and clearly identified.",
                "Integrate relevant verified authorities into the body of the response where they strengthen an actual rebuttal point. Do not add cases merely to make the brief look researched.",
                "Every case, statute, regulation, or constitutional authority actually relied on in the draft must also be returned in output.authorities with title, citation, court, date, binding_status, proposition, relevance, URL when available, quote_status, and citator_status.",
                "Do not use a citation from a Cano drafting exemplar unless the same authority is independently present in verified authority research or a prior verified specialist authority record.",
                "Use verified authority research for independent legal propositions and preserve citator-review warnings.",
                "Draft a complete attorney-editable response/reply, not an outline.",
                "Use ATTORNEY INPUT NEEDED or compact TBD placeholders only for genuinely missing filing information.",
                "Return every unresolved placeholder in draft.placeholders so the attorney input editor can surface it.",
                "When attorneyInputs are supplied, integrate those values into the matching locations and remove the resolved placeholders.",
                "Nothing is filed automatically. The result remains pending attorney review.",
              ],
            },
          }),
        }
      );

      const data =
        await res.json();

      if (
        !res.ok ||
        data?.ok === false
      ) {
        throw new Error(
          data?.error ||
            "Unable to start Rhea."
        );
      }

      const startedAt =
        Date.now();

      while (
        Date.now() -
          startedAt <
        180000
      ) {
        await new Promise(
          (resolve) =>
            window.setTimeout(
              resolve,
              2500
            )
        );

        const stateRes =
          await fetch(
            `/api/agents/state?mondayItemId=${encodeURIComponent(
              mondayItemId
            )}`,
            {
              cache:
                "no-store",
            }
          );

        const stateData =
          await stateRes.json();

        if (
          !stateRes.ok ||
          stateData?.ok ===
            false
        ) {
          continue;
        }

        const next =
          stateData?.agents
            ?.rebuttal || {};

        setState(next);

        const nextStatus =
          clean(
            next?.run
              ?.status
          );

        if (
          [
            "review_ready",
            "needs_review",
            "error",
          ].includes(
            nextStatus
          )
        ) {
          if (
            nextStatus ===
            "error"
          ) {
            setError(
              clean(
                next?.run
                  ?.error_message
              ) ||
                "Rhea returned an error."
            );
          }

          return;
        }
      }

      await loadState();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to run Rhea."
      );
    } finally {
      setRunning(false);
    }
  }

  async function exportDraft(
    format: "docx" | "pdf"
  ) {
    if (
      !draft?.markdown ||
      !mondayItemId ||
      exporting
    ) {
      return;
    }

    setExporting(format);
    setError("");

    try {
      const res =
        await fetch(
          `/api/rebuttal/export?mondayItemId=${encodeURIComponent(
            mondayItemId
          )}&format=${format}`,
          {
            cache:
              "no-store",
          }
        );

      if (!res.ok) {
        let message =
          "Unable to export the response draft.";

        try {
          const data =
            await res.json();

          message =
            data?.error ||
            message;
        } catch {}

        throw new Error(
          message
        );
      }

      const blob =
        await res.blob();

      const disposition =
        res.headers.get(
          "content-disposition"
        ) || "";

      const match =
        disposition.match(
          /filename="?([^"]+)"?/i
        );

      const filename =
        match?.[1] ||
        `Cano-Government-Response.${format}`;

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download =
        filename;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      URL.revokeObjectURL(
        url
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to export the response draft."
      );
    } finally {
      setExporting(null);
    }
  }

  function clearInput() {
    if (
      !window.confirm(
        "Clear the pasted government response and attorney instructions for this matter?"
      )
    ) {
      return;
    }

    setGovernmentResponseText(
      ""
    );

    setAttorneyInstructions(
      ""
    );

    if (storageKey) {
      window.localStorage.removeItem(
        storageKey
      );
    }
  }

  return (
    <div
      className={
        styles.backdrop
      }
    >
      <section
        className={
          styles.workstation
        }
      >
        <header
          className={
            styles.topbar
          }
        >
          <div
            className={
              styles.titleRow
            }
          >
            <button
              className={
                styles.backButton
              }
              onClick={
                onClose
              }
              aria-label="Close Rhea"
            >
              <ArrowLeft
                size={18}
              />
            </button>

            <div
              className={
                styles.agentIcon
              }
            >
              <FilePenLine
                size={24}
              />
            </div>

            <div>
              <div
                className={
                  styles.kicker
                }
              >
                RHEA · GOVERNMENT
                RESPONSE &
                REBUTTAL
              </div>

              <h2>
                Government
                Response
                Workstation
              </h2>

              <p>
                Paste the
                government's
                filing, compare it
                against the active
                matter and prior
                legal work, then
                generate an
                attorney-review
                reply.
              </p>
            </div>
          </div>

          <div
            className={
              styles.status
            }
          >
            <span />
            {status.replaceAll(
              "_",
              " "
            )}
          </div>
        </header>

        {!matter ? (
          <div
            className={
              styles.empty
            }
          >
            <AlertTriangle
              size={30}
            />

            <h3>
              No active Case
              Brain matter
            </h3>

            <p>
              Select or assign a
              matter before
              preparing a
              response.
            </p>
          </div>
        ) : (
          <div
            className={
              styles.shell
            }
          >
            <aside
              className={
                styles.inputColumn
              }
            >
              <section
                className={
                  styles.matterCard
                }
              >
                <span>
                  ACTIVE MATTER
                </span>

                <strong>
                  {detaineeName}
                </strong>

                <p>
                  {matter
                    .caseBrain
                    ?.summary
                    ?.brief ||
                    "Case Brain loaded."}
                </p>
              </section>

              <section
                className={
                  styles.formCard
                }
              >
                <div
                  className={
                    styles.sectionHead
                  }
                >
                  <div>
                    <span>
                      GOVERNMENT
                      FILING
                    </span>

                    <h3>
                      Paste the
                      response
                    </h3>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.clearButton
                    }
                    onClick={
                      clearInput
                    }
                    disabled={
                      !governmentResponseText &&
                      !attorneyInstructions
                    }
                  >
                    <Trash2
                      size={13}
                    />
                    Clear
                  </button>
                </div>

                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Filing type
                  </span>

                  <select
                    value={
                      responseType
                    }
                    onChange={(
                      event
                    ) =>
                      setResponseType(
                        event
                          .target
                          .value as ResponseType
                      )
                    }
                  >
                    {RESPONSE_TYPES.map(
                      (
                        item
                      ) => (
                        <option
                          key={
                            item.value
                          }
                          value={
                            item.value
                          }
                        >
                          {
                            item.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Government
                    response text
                  </span>

                  <textarea
                    className={
                      styles.responseTextarea
                    }
                    value={
                      governmentResponseText
                    }
                    onChange={(
                      event
                    ) =>
                      setGovernmentResponseText(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Paste the United States' return, opposition, motion to dismiss, DHS position, or other government response here..."
                  />

                  <small>
                    {governmentResponseText.length.toLocaleString()}{" "}
                    characters
                  </small>
                </label>

                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Attorney
                    instructions
                    (optional)
                  </span>

                  <textarea
                    className={
                      styles.instructionsTextarea
                    }
                    value={
                      attorneyInstructions
                    }
                    onChange={(
                      event
                    ) =>
                      setAttorneyInstructions(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Example: Focus heavily on the government's jurisdiction argument and preserve the requested relief from our original petition."
                  />
                </label>

                <div
                  className={
                    styles.inputFooter
                  }
                >
                  <div>
                    <ClipboardPaste
                      size={14}
                    />

                    <span>
                      Paste is saved
                      locally to this
                      active matter.
                    </span>
                  </div>

                  <button
                    className={
                      styles.runButton
                    }
                    disabled={
                      running ||
                      governmentResponseText.trim()
                        .length <
                        100
                    }
                    onClick={() =>
                      void runRebuttal(
                        false
                      )
                    }
                  >
                    {running ||
                    status ===
                      "working" ? (
                      <>
                        <Loader2
                          size={15}
                          className={
                            styles.spin
                          }
                        />
                        Rhea
                        Working...
                      </>
                    ) : draft?.markdown ? (
                      <>
                        <RefreshCw
                          size={15}
                        />
                        Regenerate
                        Reply
                      </>
                    ) : (
                      <>
                        <Sparkles
                          size={15}
                        />
                        Analyze &
                        Draft Reply
                      </>
                    )}
                  </button>
                </div>
              </section>

              <section
                className={
                  styles.guardrailCard
                }
              >
                <ShieldAlert
                  size={16}
                />

                <div>
                  <strong>
                    Attorney review
                    required
                  </strong>

                  <p>
                    Rhea does not
                    file or send
                    anything.
                    Government
                    statements
                    remain
                    assertions
                    unless
                    independently
                    verified, and
                    case authority
                    remains subject
                    to citator
                    review.
                  </p>
                </div>
              </section>
            </aside>

            <main
              className={
                styles.outputColumn
              }
            >
              <div
                className={
                  styles.outputHead
                }
              >
                <div>
                  <span>
                    ATTORNEY WORK
                    PRODUCT
                  </span>

                  <h3>
                    {draft?.title ||
                      output?.title ||
                      "Government Response Analysis"}
                  </h3>
                </div>

                <div
                  className={
                    styles.exportActions
                  }
                >
                  {draft?.markdown &&
                  placeholders.length ? (
                    <button
                      type="button"
                      onClick={() =>
                        scrollToInputEditor()
                      }
                    >
                      <FilePenLine
                        size={14}
                      />
                      Inputs (
                      {placeholders.length -
                        completedInputs}
                      )
                    </button>
                  ) : null}

                  <button
                    disabled={
                      !draft?.markdown ||
                      Boolean(
                        exporting
                      )
                    }
                    onClick={() =>
                      void exportDraft(
                        "docx"
                      )
                    }
                  >
                    {exporting ===
                    "docx" ? (
                      <Loader2
                        className={
                          styles.spin
                        }
                        size={14}
                      />
                    ) : (
                      <FileDown
                        size={14}
                      />
                    )}
                    DOCX
                  </button>

                  <button
                    disabled={
                      !draft?.markdown ||
                      Boolean(
                        exporting
                      )
                    }
                    onClick={() =>
                      void exportDraft(
                        "pdf"
                      )
                    }
                  >
                    {exporting ===
                    "pdf" ? (
                      <Loader2
                        className={
                          styles.spin
                        }
                        size={14}
                      />
                    ) : (
                      <FileDown
                        size={14}
                      />
                    )}
                    PDF
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  className={
                    styles.errorBox
                  }
                >
                  <AlertTriangle
                    size={16}
                  />
                  {error}
                </div>
              ) : null}

              {loading &&
              !output ? (
                <div
                  className={
                    styles.emptyOutput
                  }
                >
                  <Loader2
                    className={
                      styles.spin
                    }
                    size={25}
                  />

                  <h4>
                    Loading Rhea
                  </h4>
                </div>
              ) : draft?.markdown ? (
                <>
                  <section
                    className={
                      styles.summaryCard
                    }
                  >
                    <CheckCircle2
                      size={18}
                    />

                    <div>
                      <span>
                        RESPONSE
                        STRATEGY
                      </span>

                      <p>
                        {output?.executive_summary ||
                          "Reply draft prepared for attorney review."}
                      </p>
                    </div>
                  </section>

                  {output
                    ?.readiness
                    ?.blocking_items
                    ?.length ? (
                    <section
                      className={
                        styles.blockers
                      }
                    >
                      <span>
                        BLOCKING /
                        REVIEW ITEMS
                      </span>

                      <ul>
                        {output.readiness.blocking_items.map(
                          (
                            item,
                            index
                          ) => (
                            <li
                              key={`${item}-${index}`}
                            >
                              {item}
                            </li>
                          )
                        )}
                      </ul>
                    </section>
                  ) : null}

                  <section
                    className={
                      styles.caseLawCard
                    }
                  >
                    <div
                      className={
                        styles.caseLawHead
                      }
                    >
                      <div>
                        <span>
                          CASE LAW USED IN RESPONSE
                        </span>

                        <h4>
                          Citations tied back to verified specialist research
                        </h4>

                        <p>
                          Rhea cross-checks the reply against Elena and Lex authority
                          records. Only authorities actually cited or identified in
                          this response are shown here. Binding status is
                          jurisdictional analysis only; attorney citator review is
                          still required before filing.
                        </p>
                      </div>

                      <div
                        className={
                          styles.caseLawCount
                        }
                      >
                        <Landmark
                          size={15}
                        />
                        {citedAuthorities.length} cited
                      </div>
                    </div>

                    {citedAuthorities.length ? (
                      <div
                        className={
                          styles.caseLawGrid
                        }
                      >
                        {citedAuthorities.map(
                          (
                            authority,
                            index
                          ) => (
                            <article
                              className={
                                styles.caseLawItem
                              }
                              key={`${clean(
                                authority.citation
                              )}-${clean(
                                authority.url
                              )}-${index}`}
                            >
                              <div
                                className={
                                  styles.caseLawTop
                                }
                              >
                                <div
                                  className={
                                    styles.caseLawKind
                                  }
                                >
                                  <Scale
                                    size={14}
                                  />
                                  {clean(
                                    authority.kind ||
                                      "case"
                                  ).replaceAll(
                                    "_",
                                    " "
                                  )}
                                  <span>
                                    {authority._sourceAgent ||
                                      "Verified Research"}
                                  </span>
                                </div>

                                <div
                                  className={`${styles.caseLawBinding} ${
                                    styles[
                                      `caseLawBinding_${clean(
                                        authority.binding_status ||
                                          "unknown"
                                      ).toLowerCase()}`
                                    ] || ""
                                  }`}
                                >
                                  {clean(
                                    authority.binding_status ||
                                      "unknown"
                                  )}
                                </div>
                              </div>

                              <h5>
                                {authority.title ||
                                  "Legal authority"}
                              </h5>

                              <div
                                className={
                                  styles.caseLawMeta
                                }
                              >
                                {authority.citation ? (
                                  <span>
                                    {
                                      authority.citation
                                    }
                                  </span>
                                ) : null}

                                {authority.court ? (
                                  <span>
                                    {
                                      authority.court
                                    }
                                  </span>
                                ) : null}

                                {authority.date ? (
                                  <span>
                                    {
                                      authority.date
                                    }
                                  </span>
                                ) : null}

                                {authority.precedential_status ? (
                                  <span>
                                    {
                                      authority.precedential_status
                                    }
                                  </span>
                                ) : null}
                              </div>

                              {authority.proposition ? (
                                <div
                                  className={
                                    styles.caseLawProposition
                                  }
                                >
                                  <strong>
                                    Relevant proposition
                                  </strong>

                                  <p>
                                    {
                                      authority.proposition
                                    }
                                  </p>
                                </div>
                              ) : null}

                              {authority.quote ? (
                                <blockquote
                                  className={
                                    styles.caseLawQuote
                                  }
                                >
                                  “
                                  {
                                    authority.quote
                                  }
                                  ”
                                </blockquote>
                              ) : null}

                              <div
                                className={
                                  styles.caseLawValidation
                                }
                              >
                                <span>
                                  {clean(
                                    authority.quote_status ||
                                      "quote not supplied"
                                  ).replaceAll(
                                    "_",
                                    " "
                                  )}
                                </span>

                                <span>
                                  {clean(
                                    authority.citator_status ||
                                      "needs_citator_review"
                                  ).replaceAll(
                                    "_",
                                    " "
                                  )}
                                </span>
                              </div>

                              {authority.relevance ? (
                                <p
                                  className={
                                    styles.caseLawRelevance
                                  }
                                >
                                  {
                                    authority.relevance
                                  }
                                </p>
                              ) : null}

                              {authority.url ? (
                                <a
                                  href={
                                    authority.url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className={
                                    styles.caseLawLink
                                  }
                                >
                                  Open source
                                  <ExternalLink
                                    size={12}
                                  />
                                </a>
                              ) : null}
                            </article>
                          )
                        )}
                      </div>
                    ) : (
                      <div
                        className={
                          styles.caseLawEmpty
                        }
                      >
                        <AlertTriangle
                          size={15}
                        />

                        <div>
                          <strong>
                            No verified case citation was matched in this saved
                            reply.
                          </strong>

                          <p>
                            Regenerate Rhea after the latest Elena/Lex research
                            is available. Rhea is now instructed to review those
                            authority records, use only genuinely relevant cases
                            in the response, and return every relied-on authority
                            for this case-law panel.
                          </p>
                        </div>
                      </div>
                    )}
                  </section>

                  <section
                    className={
                      styles.draftCard
                    }
                  >
                    <div
                      className={
                        styles.draftLabel
                      }
                    >
                      <Scale
                        size={15}
                      />
                      DRAFT REPLY /
                      RESPONSE
                    </div>

                    <pre>
                      {renderHighlightedDraft(
                        draft.markdown
                      )}
                    </pre>
                  </section>

                  <section
                    className={
                      styles.inputEditor
                    }
                    id="rhea-attorney-input-editor"
                  >
                    <div
                      className={
                        styles.inputEditorHead
                      }
                    >
                      <div>
                        <span>
                          ATTORNEY INPUT
                          EDITOR (
                          {completedInputs}/
                          {
                            placeholders.length
                          }{" "}
                          COMPLETED)
                        </span>

                        <h4>
                          Fill the
                          missing facts
                          here
                        </h4>

                        <p>
                          Yellow
                          placeholders
                          in the draft
                          are clickable.
                          Values save in
                          this browser
                          automatically.
                          Regenerate with
                          inputs to send
                          the completed
                          facts back to
                          Rhea.
                        </p>
                      </div>

                      <div
                        className={
                          styles.inputEditorActions
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            saveAttorneyInputs()
                          }
                        >
                          <Save
                            size={14}
                          />
                          {inputsSaved
                            ? "Saved"
                            : "Save Inputs"}
                        </button>

                        <button
                          type="button"
                          className={
                            styles.regenerateInputButton
                          }
                          disabled={
                            running ||
                            completedInputs ===
                              0 ||
                            governmentResponseText.trim()
                              .length <
                              100
                          }
                          onClick={() =>
                            void runRebuttal(
                              true
                            )
                          }
                        >
                          {running ? (
                            <Loader2
                              size={14}
                              className={
                                styles.spin
                              }
                            />
                          ) : (
                            <Sparkles
                              size={14}
                            />
                          )}
                          Regenerate With
                          Inputs
                        </button>
                      </div>
                    </div>

                    {placeholders.length ? (
                      <div
                        className={
                          styles.inputGrid
                        }
                      >
                        {placeholders.map(
                          (
                            item,
                            index
                          ) => {
                            const value =
                              attorneyInputs[
                                item
                              ] || "";

                            return (
                              <div
                                className={`${styles.inputCard} ${
                                  clean(
                                    value
                                  )
                                    ? styles.inputCardComplete
                                    : ""
                                }`}
                                key={
                                  item
                                }
                                id={`rhea-attorney-input-card-${index}`}
                              >
                                <div
                                  className={
                                    styles.inputNumber
                                  }
                                >
                                  {index +
                                    1}
                                </div>

                                <div
                                  className={
                                    styles.inputBody
                                  }
                                >
                                  <label
                                    htmlFor={`rhea-attorney-input-${index}`}
                                  >
                                    {placeholderDetail(
                                      item
                                    )}
                                  </label>

                                  <textarea
                                    id={`rhea-attorney-input-${index}`}
                                    rows={3}
                                    value={
                                      value
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      updateAttorneyInput(
                                        item,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    placeholder="Attorney input..."
                                  />

                                  <span>
                                    {clean(
                                      value
                                    )
                                      ? "Ready to integrate on regeneration"
                                      : "Still unresolved"}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div
                        className={
                          styles.inputComplete
                        }
                      >
                        <CheckCircle2
                          size={17}
                        />
                        No unresolved
                        attorney-input
                        placeholders are
                        listed in this
                        Rhea draft.
                      </div>
                    )}
                  </section>

                  {draft
                    .authority_checklist
                    ?.length ? (
                    <section
                      className={
                        styles.authorities
                      }
                    >
                      <span>
                        AUTHORITY
                        CHECKLIST
                      </span>

                      {draft.authority_checklist.map(
                        (
                          authority,
                          index
                        ) => (
                          <div
                            key={`${authority.authority}-${index}`}
                          >
                            <strong>
                              {
                                authority.authority
                              }
                            </strong>

                            <em>
                              {clean(
                                authority.status
                              ).replaceAll(
                                "_",
                                " "
                              )}
                            </em>

                            <p>
                              {
                                authority.note
                              }
                            </p>
                          </div>
                        )
                      )}
                    </section>
                  ) : null}

                  {activePlaceholder ? (
                    <div
                      className={
                        styles.quickBackdrop
                      }
                      onMouseDown={(
                        event
                      ) => {
                        if (
                          event.currentTarget ===
                          event.target
                        ) {
                          setActivePlaceholder(
                            null
                          );
                        }
                      }}
                    >
                      <section
                        className={
                          styles.quickInput
                        }
                        role="dialog"
                        aria-modal="true"
                        aria-label="Attorney input"
                      >
                        <div
                          className={
                            styles.quickHead
                          }
                        >
                          <div>
                            <span>
                              ATTORNEY
                              INPUT
                            </span>

                            <h3>
                              {placeholderDetail(
                                activePlaceholder
                              )}
                            </h3>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setActivePlaceholder(
                                null
                              )
                            }
                            aria-label="Close"
                          >
                            <X
                              size={16}
                            />
                          </button>
                        </div>

                        <textarea
                          autoFocus
                          rows={5}
                          value={
                            attorneyInputs[
                              activePlaceholder
                            ] || ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateAttorneyInput(
                              activePlaceholder,
                              event
                                .target
                                .value
                            )
                          }
                          placeholder="Type the attorney-supplied information here..."
                        />

                        <div
                          className={
                            styles.quickStatus
                          }
                        >
                          {clean(
                            attorneyInputs[
                              activePlaceholder
                            ]
                          )
                            ? "Saved locally and ready to integrate"
                            : "This placeholder is still unresolved"}
                        </div>

                        <div
                          className={
                            styles.quickActions
                          }
                        >
                          <button
                            type="button"
                            onClick={() => {
                              saveAttorneyInputs();
                              setActivePlaceholder(
                                null
                              );
                            }}
                          >
                            <Save
                              size={14}
                            />
                            Save &
                            Continue
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const target =
                                activePlaceholder;

                              setActivePlaceholder(
                                null
                              );

                              scrollToInputEditor(
                                target
                              );
                            }}
                          >
                            <FilePenLine
                              size={14}
                            />
                            Open in Input
                            Editor
                          </button>

                          <button
                            type="button"
                            className={
                              styles.regenerateInputButton
                            }
                            disabled={
                              running ||
                              !clean(
                                attorneyInputs[
                                  activePlaceholder
                                ]
                              ) ||
                              governmentResponseText.trim()
                                .length <
                                100
                            }
                            onClick={() => {
                              setActivePlaceholder(
                                null
                              );

                              void runRebuttal(
                                true
                              );
                            }}
                          >
                            <Sparkles
                              size={14}
                            />
                            Regenerate With
                            Inputs
                          </button>
                        </div>
                      </section>
                    </div>
                  ) : null}
                </>
              ) : (
                <div
                  className={
                    styles.emptyOutput
                  }
                >
                  <FilePenLine
                    size={30}
                  />

                  <h4>
                    Paste the
                    government
                    response
                  </h4>

                  <p>
                    Rhea will compare
                    it to Case Brain,
                    prior specialist
                    research, and the
                    existing drafting
                    work before
                    preparing an
                    attorney-review
                    reply.
                  </p>
                </div>
              )}
            </main>
          </div>
        )}
      </section>
    </div>
  );
}

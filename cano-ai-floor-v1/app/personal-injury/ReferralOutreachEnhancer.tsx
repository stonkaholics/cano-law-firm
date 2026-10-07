"use client";

import {
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type DraftResult = {
  id: string;
  referral_prospect_id?: string | null;
  subject?: string;
  message_summary?: string;
  status?: string;
  created_at?: string;
  metadata?: Record<string, any>;
};

type RunResponse = {
  ok: boolean;
  error?: string;
  prospectId?: string;
  contactId?: string;
  organizationName?: string;
  recipientName?: string;
  recipientEmail?: string;
  startedAt?: string;
  message?: string;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function findWebsite(card: HTMLElement) {
  const anchors = Array.from(
    card.querySelectorAll<HTMLAnchorElement>("a[href]")
  );

  const external = anchors.find((anchor) => {
    const href = cleanText(anchor.href);
    return (
      href.startsWith("http") &&
      !href.includes("linkedin.com")
    );
  });

  return external?.href || "";
}

function findOrganization(card: HTMLElement) {
  return cleanText(
    card.querySelector("h3")?.textContent
  );
}

function findDraftButton(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const button =
    target.closest("button");

  if (!button) {
    return null;
  }

  const label =
    cleanText(button.textContent)
      .toLowerCase();

  if (
    !label.includes(
      "draft outreach"
    )
  ) {
    return null;
  }

  return button as HTMLButtonElement;
}

function bodyFromDraft(
  draft: DraftResult | null
) {
  if (!draft) {
    return "";
  }

  return cleanText(
    draft.metadata?.body ||
    draft.message_summary ||
    ""
  );
}

export default function ReferralOutreachEnhancer() {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    phase,
    setPhase,
  ] = useState<
    | "idle"
    | "starting"
    | "waiting"
    | "ready"
    | "error"
  >("idle");

  const [
    error,
    setError,
  ] = useState("");

  const [
    run,
    setRun,
  ] =
    useState<RunResponse | null>(
      null
    );

  const [
    draft,
    setDraft,
  ] =
    useState<DraftResult | null>(
      null
    );

  const pollRef =
    useRef<number | null>(
      null
    );

  const stopPolling =
    useCallback(() => {
      if (
        pollRef.current !==
        null
      ) {
        window.clearInterval(
          pollRef.current
        );
        pollRef.current =
          null;
      }
    }, []);

  const loadDraft =
    useCallback(
      async (
        prospectId: string,
        startedAt: string
      ) => {
        try {
          const response =
            await fetch(
              "/api/pi/workspace",
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            data?.ok === false
          ) {
            return false;
          }

          const rows =
            Array.isArray(
              data?.outreach
            )
              ? data.outreach
              : [];

          const startMs =
            new Date(
              startedAt
            ).getTime();

          const match =
            rows.find(
              (item: any) => {
                if (
                  String(
                    item
                      ?.referral_prospect_id ||
                    ""
                  ) !==
                  prospectId
                ) {
                  return false;
                }

                const createdMs =
                  new Date(
                    item?.created_at ||
                    0
                  ).getTime();

                if (
                  Number.isFinite(
                    startMs
                  ) &&
                  createdMs <
                    startMs -
                      5000
                ) {
                  return false;
                }

                const agent =
                  String(
                    item?.metadata
                      ?.agent ||
                    ""
                  )
                    .trim()
                    .toLowerCase();

                return (
                  String(
                    item?.status ||
                    ""
                  ).toLowerCase() ===
                    "draft" &&
                  (
                    !agent ||
                    agent ===
                      "reach"
                  )
                );
              }
            ) || null;

          if (!match) {
            return false;
          }

          setDraft(match);
          setPhase("ready");
          stopPolling();
          return true;
        } catch {
          return false;
        }
      },
      [stopPolling]
    );

  const startPolling =
    useCallback(
      (
        prospectId: string,
        startedAt: string
      ) => {
        stopPolling();

        let attempts = 0;

        void loadDraft(
          prospectId,
          startedAt
        );

        pollRef.current =
          window.setInterval(
            async () => {
              attempts += 1;

              const found =
                await loadDraft(
                  prospectId,
                  startedAt
                );

              if (found) {
                return;
              }

              if (
                attempts >= 30
              ) {
                stopPolling();
                setPhase(
                  "error"
                );
                setError(
                  "Reach accepted the request, but the draft did not appear in the outreach queue within about 90 seconds. Check the Reach branch in n8n for the last executed node."
                );
              }
            },
            3000
          );
      },
      [
        loadDraft,
        stopPolling,
      ]
    );

  useEffect(() => {
    const handler =
      async (
        event: MouseEvent
      ) => {
        const button =
          findDraftButton(
            event.target
          );

        if (!button) {
          return;
        }

        if (
          button.disabled
        ) {
          return;
        }

        const card =
          button.closest(
            "article"
          ) as HTMLElement | null;

        if (!card) {
          return;
        }

        const organizationName =
          findOrganization(
            card
          );

        if (!organizationName) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const website =
          findWebsite(card);

        stopPolling();

        setOpen(true);
        setPhase(
          "starting"
        );
        setError("");
        setRun(null);
        setDraft(null);

        try {
          const response =
            await fetch(
              "/api/pi/reach/run",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    organizationName,
                    website,
                  }),
              }
            );

          const data =
            (await response.json()) as
              RunResponse;

          if (
            !response.ok ||
            data?.ok === false
          ) {
            throw new Error(
              data?.error ||
              "Unable to start Reach."
            );
          }

          setRun(data);
          setPhase("waiting");

          if (
            data.prospectId &&
            data.startedAt
          ) {
            startPolling(
              data.prospectId,
              data.startedAt
            );
          } else {
            throw new Error(
              "Reach started without returning the prospect tracking information."
            );
          }
        } catch (
          caught
        ) {
          setPhase("error");
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to start Reach."
          );
        }
      };

    document.addEventListener(
      "click",
      handler,
      true
    );

    return () => {
      document.removeEventListener(
        "click",
        handler,
        true
      );

      stopPolling();
    };
  }, [
    startPolling,
    stopPolling,
  ]);

  if (!open) {
    return null;
  }

  const body =
    bodyFromDraft(
      draft
    );

  return (
    <div
      style={{
        position:
          "fixed",
        inset: 0,
        zIndex: 5000,
        background:
          "rgba(1, 7, 11, 0.76)",
        backdropFilter:
          "blur(9px)",
        display:
          "flex",
        justifyContent:
          "flex-end",
      }}
      onMouseDown={
        (event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            stopPolling();
            setOpen(false);
          }
        }
      }
    >
      <aside
        style={{
          width:
            "min(560px, 100%)",
          height:
            "100%",
          overflowY:
            "auto",
          borderLeft:
            "1px solid rgba(173,194,206,.12)",
          background:
            "linear-gradient(180deg, rgba(10,29,40,.98), rgba(5,17,25,.99))",
          boxShadow:
            "-24px 0 80px rgba(0,0,0,.34)",
          padding:
            "26px",
          color:
            "#dfe8ed",
          fontFamily:
            "inherit",
        }}
      >
        <div
          style={{
            display:
              "flex",
            alignItems:
              "flex-start",
            justifyContent:
              "space-between",
            gap: 18,
            paddingBottom:
              18,
            borderBottom:
              "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div
            style={{
              display:
                "flex",
              gap: 13,
              alignItems:
                "center",
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                border:
                  "1px solid rgba(224,191,133,.22)",
                borderRadius:
                  12,
                display:
                  "grid",
                placeItems:
                  "center",
                color:
                  "#d7b77d",
                background:
                  "rgba(224,191,133,.04)",
              }}
            >
              <Send
                size={22}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize:
                    10,
                  fontWeight:
                    800,
                  letterSpacing:
                    ".08em",
                  color:
                    "#6ed9aa",
                }}
              >
                REACH · REFERRAL OUTREACH
              </div>

              <h2
                style={{
                  margin:
                    "5px 0 3px",
                  fontFamily:
                    "Georgia, serif",
                  fontSize:
                    28,
                  fontWeight:
                    500,
                }}
              >
                Outreach Draft
              </h2>

              <div
                style={{
                  color:
                    "#78909b",
                  fontSize:
                    11,
                }}
              >
                Human approval remains required before external sending.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopPolling();
              setOpen(false);
            }}
            style={{
              width: 36,
              height: 36,
              border:
                "1px solid rgba(173,194,206,.12)",
              borderRadius:
                9,
              background:
                "rgba(255,255,255,.02)",
              color:
                "#7c94a0",
              display:
                "grid",
              placeItems:
                "center",
              cursor:
                "pointer",
            }}
          >
            <X size={17} />
          </button>
        </div>

        {run ? (
          <div
            style={{
              marginTop:
                18,
              padding:
                13,
              border:
                "1px solid rgba(107,184,255,.10)",
              borderRadius:
                10,
              background:
                "rgba(107,184,255,.025)",
            }}
          >
            <div
              style={{
                color:
                  "#dfe8ed",
                fontSize:
                  13,
                fontWeight:
                  700,
              }}
            >
              {run.organizationName}
            </div>

            <div
              style={{
                marginTop:
                  5,
                color:
                  "#7896a4",
                fontSize:
                  11,
              }}
            >
              {[
                run.recipientName,
                run.recipientEmail,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " · "
                )}
            </div>
          </div>
        ) : null}

        {phase ===
          "starting" ||
        phase ===
          "waiting" ? (
          <div
            style={{
              minHeight:
                330,
              display:
                "grid",
              placeItems:
                "center",
              textAlign:
                "center",
            }}
          >
            <div>
              <Loader2
                size={29}
                style={{
                  animation:
                    "canoReachSpin .9s linear infinite",
                  color:
                    "#d7b77d",
                }}
              />

              <h3
                style={{
                  margin:
                    "15px 0 7px",
                  fontFamily:
                    "Georgia, serif",
                  fontSize:
                    20,
                  fontWeight:
                    500,
                }}
              >
                {phase ===
                "starting"
                  ? "Sending prospect to Reach"
                  : "Reach is drafting the introduction"}
              </h3>

              <p
                style={{
                  maxWidth:
                    390,
                  margin:
                    "0 auto",
                  color:
                    "#78909b",
                  fontSize:
                    11,
                  lineHeight:
                    1.6,
                }}
              >
                The n8n Reach branch is loading the referral context, classifying the relationship lane, drafting the email, and saving it to the outreach queue.
              </p>
            </div>
          </div>
        ) : null}

        {phase ===
          "ready" &&
        draft ? (
          <div
            style={{
              marginTop:
                18,
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: 8,
                marginBottom:
                  14,
                color:
                  "#72d5a5",
                fontSize:
                  11,
                fontWeight:
                  800,
              }}
            >
              <CheckCircle2
                size={16}
              />
              DRAFT SAVED · PENDING APPROVAL
            </div>

            <label
              style={{
                display:
                  "block",
                color:
                  "#d7b77d",
                fontSize:
                  9,
                fontWeight:
                  800,
                letterSpacing:
                  ".08em",
              }}
            >
              SUBJECT
            </label>

            <div
              style={{
                marginTop:
                  7,
                padding:
                  "12px 13px",
                border:
                  "1px solid rgba(173,194,206,.10)",
                borderRadius:
                  9,
                background:
                  "rgba(255,255,255,.015)",
                color:
                  "#e4edf1",
                fontSize:
                  13,
              }}
            >
              {draft.subject ||
                "No subject returned"}
            </div>

            <label
              style={{
                display:
                  "block",
                marginTop:
                  18,
                color:
                  "#d7b77d",
                fontSize:
                  9,
                fontWeight:
                  800,
                letterSpacing:
                  ".08em",
              }}
            >
              EMAIL BODY
            </label>

            <div
              style={{
                marginTop:
                  7,
                padding:
                  "15px",
                border:
                  "1px solid rgba(173,194,206,.10)",
                borderRadius:
                  9,
                background:
                  "rgba(255,255,255,.015)",
                color:
                  "#c7d4da",
                fontSize:
                  12,
                lineHeight:
                  1.7,
                whiteSpace:
                  "pre-wrap",
              }}
            >
              {body ||
                "Reach saved the draft, but no full body was present in metadata."}
            </div>

            <div
              style={{
                marginTop:
                  18,
                padding:
                  12,
                border:
                  "1px solid rgba(224,191,133,.12)",
                borderRadius:
                  9,
                background:
                  "rgba(224,191,133,.025)",
                color:
                  "#8fa3ac",
                fontSize:
                  10,
                lineHeight:
                  1.55,
              }}
            >
              This patch intentionally stops at drafting. Gmail sending, Guard approval, Orbit follow-up, and reply classification are the next layer.
            </div>
          </div>
        ) : null}

        {phase ===
          "error" ? (
          <div
            style={{
              marginTop:
                20,
              padding:
                15,
              border:
                "1px solid rgba(224,111,98,.18)",
              borderRadius:
                10,
              background:
                "rgba(224,111,98,.035)",
            }}
          >
            <div
              style={{
                color:
                  "#e29a8e",
                fontSize:
                  12,
                fontWeight:
                  800,
              }}
            >
              Reach could not complete the draft.
            </div>

            <div
              style={{
                marginTop:
                  7,
                color:
                  "#9bacb4",
                fontSize:
                  11,
                lineHeight:
                  1.6,
              }}
            >
              {error}
            </div>

            {run?.prospectId &&
            run?.startedAt ? (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setPhase(
                    "waiting"
                  );
                  startPolling(
                    run.prospectId!,
                    run.startedAt!
                  );
                }}
                style={{
                  marginTop:
                    13,
                  minHeight:
                    36,
                  border:
                    "1px solid rgba(224,191,133,.18)",
                  borderRadius:
                    8,
                  background:
                    "rgba(224,191,133,.045)",
                  color:
                    "#d7b77d",
                  padding:
                    "8px 12px",
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  gap: 7,
                  cursor:
                    "pointer",
                  fontWeight:
                    800,
                }}
              >
                <RefreshCw
                  size={14}
                />
                Check Again
              </button>
            ) : null}
          </div>
        ) : null}

        <style>{`
          @keyframes canoReachSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </aside>
    </div>
  );
}

"use client";

import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Mail,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./ReachWorkstation.module.css";

type ReferralStatus =
  | "new"
  | "researching"
  | "approved"
  | "contacted"
  | "replied"
  | "meeting"
  | "partner"
  | "not_fit";

type ReferralContact = {
  id: string;
  prospect_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  priority?: number;
  selected_for_outreach?: boolean;
};

type ReferralProspect = {
  id: string;
  organization_name: string;
  contact_name?: string;
  category?: string;
  practice_area?: string;
  city?: string;
  state?: string;
  website?: string;
  source_url?: string;
  why_fit?: string;
  relationship_status: ReferralStatus;
  score?: number;
  contacts?: ReferralContact[];
};

type OutreachEvent = {
  id: string;
  referral_prospect_id?: string | null;
  channel?: string;
  direction?: string;
  status?: string;
  subject?: string;
  message_summary?: string;
  approved_by?: string;
  approved_at?: string | null;
  occurred_at?: string | null;
  next_follow_up_at?: string | null;
  created_at?: string;
  metadata?: Record<string, any>;
};

type Workspace = {
  referrals: ReferralProspect[];
  outreach: OutreachEvent[];
};

type DraftTarget = {
  prospectId: string;
  contactId?: string;
  organizationName: string;
  recipientName?: string;
  recipientEmail?: string;
  startedAt: string;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function contactName(contact?: ReferralContact | null) {
  if (!contact) return "";
  return (
    clean(contact.full_name) ||
    [clean(contact.first_name), clean(contact.last_name)]
      .filter(Boolean)
      .join(" ")
  );
}

function preferredContact(prospect: ReferralProspect) {
  const contacts = Array.isArray(prospect.contacts)
    ? prospect.contacts.slice()
    : [];

  contacts.sort(
    (a, b) =>
      Number(a.priority || 99) -
      Number(b.priority || 99)
  );

  return (
    contacts.find(
      (item) =>
        item.selected_for_outreach &&
        clean(item.email)
    ) ||
    contacts.find(
      (item) =>
        item.selected_for_outreach
    ) ||
    contacts.find(
      (item) =>
        clean(item.email)
    ) ||
    contacts[0] ||
    null
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function fullDraftBody(event?: OutreachEvent | null) {
  if (!event) return "";

  return clean(
    event.metadata?.body ||
    event.message_summary ||
    ""
  );
}

function stageLabel(status: string) {
  const labels: Record<string, string> = {
    new: "New",
    researching: "Researching",
    approved: "Approved",
    contacted: "Contacted",
    replied: "Replied",
    meeting: "Meeting",
    partner: "Partner",
    not_fit: "Not Fit",
  };

  return labels[status] || status || "Unknown";
}

export default function ReachWorkstationBridge() {
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>({
    referrals: [],
    outreach: [],
  });
  const [loading, setLoading] = useState(false);
  const [runningProspectId, setRunningProspectId] =
    useState<string | null>(null);
  const [draftTarget, setDraftTarget] =
    useState<DraftTarget | null>(null);
  const [selectedDraft, setSelectedDraft] =
    useState<OutreachEvent | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/pi/workspace?reach=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
          "Unable to load Reach workspace."
        );
      }

      const next = {
        referrals: Array.isArray(data.referrals)
          ? data.referrals
          : [],
        outreach: Array.isArray(data.outreach)
          ? data.outreach
          : [],
      };

      setWorkspace(next);
      setError("");

      return next;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Reach workspace."
      );

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const findDraftForTarget = useCallback(
    (
      data: Workspace,
      target: DraftTarget
    ) => {
      const startedMs =
        new Date(target.startedAt).getTime();

      return (
        data.outreach.find((item) => {
          if (
            clean(item.referral_prospect_id) !==
            target.prospectId
          ) {
            return false;
          }

          if (
            clean(item.status).toLowerCase() !==
            "draft"
          ) {
            return false;
          }

          const agent =
            clean(item.metadata?.agent)
              .toLowerCase();

          if (agent && agent !== "reach") {
            return false;
          }

          const createdMs =
            new Date(
              item.created_at || 0
            ).getTime();

          return (
            !Number.isFinite(startedMs) ||
            createdMs >= startedMs - 5000
          );
        }) || null
      );
    },
    []
  );

  const startDraftPolling = useCallback(
    (target: DraftTarget) => {
      stopPolling();

      let attempts = 0;

      const check = async () => {
        attempts += 1;

        const next =
          await loadWorkspace();

        if (!next) {
          return;
        }

        const draft =
          findDraftForTarget(
            next,
            target
          );

        if (draft) {
          setSelectedDraft(draft);
          setRunningProspectId(null);
          setNotice(
            "Reach finished the draft. It is saved and waiting for human approval."
          );
          stopPolling();
          return;
        }

        if (attempts >= 30) {
          setRunningProspectId(null);
          setError(
            "Reach accepted the request, but no draft appeared within about 90 seconds. Open the latest Reach execution in n8n and inspect the last completed node."
          );
          stopPolling();
        }
      };

      void check();

      pollRef.current =
        window.setInterval(
          () => void check(),
          3000
        );
    },
    [
      findDraftForTarget,
      loadWorkspace,
      stopPolling,
    ]
  );

  const runReach = useCallback(
    async (
      prospect: ReferralProspect,
      explicitContact?: ReferralContact | null
    ) => {
      if (
        runningProspectId
      ) {
        return;
      }

      const contact =
        explicitContact ||
        preferredContact(
          prospect
        );

      if (!contact) {
        setError(
          "Scout has not found a usable contact for this firm yet."
        );
        return;
      }

      if (!clean(contact.email)) {
        setError(
          "The selected contact does not have an enriched email address yet."
        );
        return;
      }

      setRunningProspectId(
        prospect.id
      );
      setSelectedDraft(null);
      setError("");
      setNotice(
        `Reach is drafting an introduction for ${prospect.organization_name}.`
      );

      try {
        const response =
          await fetch(
            "/api/pi/reach/run",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                prospectId:
                  prospect.id,
                contactId:
                  contact.id,
                organizationName:
                  prospect.organization_name,
                website:
                  prospect.website || "",
              }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          data?.ok === false
        ) {
          throw new Error(
            data?.error ||
            "Unable to start Reach."
          );
        }

        const target: DraftTarget = {
          prospectId:
            clean(
              data.prospectId ||
              prospect.id
            ),
          contactId:
            clean(
              data.contactId ||
              contact.id
            ),
          organizationName:
            clean(
              data.organizationName ||
              prospect.organization_name
            ),
          recipientName:
            clean(
              data.recipientName ||
              contactName(contact)
            ),
          recipientEmail:
            clean(
              data.recipientEmail ||
              contact.email
            ),
          startedAt:
            clean(
              data.startedAt ||
              new Date().toISOString()
            ),
        };

        setDraftTarget(
          target
        );

        startDraftPolling(
          target
        );
      } catch (caught) {
        setRunningProspectId(
          null
        );
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to start Reach."
        );
      }
    },
    [
      runningProspectId,
      startDraftPolling,
    ]
  );

  useEffect(() => {
    const clickHandler = (
      event: MouseEvent
    ) => {
      if (
        !(event.target instanceof Element)
      ) {
        return;
      }

      const button =
        event.target.closest(
          "button"
        );

      if (!button) {
        return;
      }

      const label =
        clean(button.textContent)
          .replace(/\s+/g, " ")
          .toLowerCase();

      /*
      |--------------------------------------------------------------------------
      | REACH AGENT DESK
      |--------------------------------------------------------------------------
      |
      | The current PI floor uses one generic workstation shell for
      | Scout/Bridge/Reach/Orbit. Capture the Reach desk before React's generic
      | workstation handler fires and open this dedicated Reach workstation.
      |--------------------------------------------------------------------------
      */

      const isReachDesk =
        label.includes("outreach") &&
        label.includes("reach") &&
        !label.includes(
          "draft outreach"
        );

      if (isReachDesk) {
        event.preventDefault();
        event.stopPropagation();

        setOpen(true);
        setSelectedDraft(null);
        setNotice("");
        setError("");
        void loadWorkspace();
        return;
      }

      /*
      |--------------------------------------------------------------------------
      | DRAFT OUTREACH BUTTONS
      |--------------------------------------------------------------------------
      |
      | Scout's existing firm cards already have Draft Outreach buttons.
      | Those buttons now hand the selected firm directly to Reach.
      |--------------------------------------------------------------------------
      */

      if (
        label.includes(
          "draft outreach"
        )
      ) {
        if (
          (button as HTMLButtonElement)
            .disabled
        ) {
          return;
        }

        const card =
          button.closest(
            "article"
          );

        const organizationName =
          clean(
            card
              ?.querySelector(
                "h3"
              )
              ?.textContent
          );

        if (!organizationName) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const launch =
          async () => {
            const next =
              await loadWorkspace();

            if (!next) {
              setOpen(true);
              return;
            }

            const prospect =
              next.referrals.find(
                (item) =>
                  clean(
                    item.organization_name
                  ).toLowerCase() ===
                  organizationName.toLowerCase()
              );

            setOpen(true);

            if (!prospect) {
              setError(
                `Reach could not find ${organizationName} in the saved Scout referral records.`
              );
              return;
            }

            void runReach(
              prospect
            );
          };

        void launch();
      }
    };

    document.addEventListener(
      "click",
      clickHandler,
      true
    );

    return () => {
      document.removeEventListener(
        "click",
        clickHandler,
        true
      );
      stopPolling();
    };
  }, [
    loadWorkspace,
    runReach,
    stopPolling,
  ]);

  const approvedProspects =
    useMemo(() => {
      const needle =
        search
          .trim()
          .toLowerCase();

      return workspace.referrals
        .filter(
          (prospect) =>
            [
              "approved",
              "contacted",
              "replied",
              "meeting",
              "partner",
            ].includes(
              prospect.relationship_status
            )
        )
        .filter(
          (prospect) => {
            if (!needle) {
              return true;
            }

            return [
              prospect.organization_name,
              prospect.practice_area,
              prospect.city,
              prospect.state,
              prospect.why_fit,
              ...(prospect.contacts || [])
                .flatMap(
                  (contact) => [
                    contactName(
                      contact
                    ),
                    contact.title,
                    contact.email,
                  ]
                ),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                needle
              );
          }
        )
        .sort(
          (a, b) =>
            Number(
              b.score || 0
            ) -
            Number(
              a.score || 0
            )
        );
    },
    [
      workspace.referrals,
      search,
    ]
  );

  const reachDrafts =
    useMemo(
      () =>
        workspace.outreach.filter(
          (item) =>
            clean(
              item.metadata?.agent
            ).toLowerCase() ===
              "reach" ||
            (
              clean(
                item.status
              ).toLowerCase() ===
                "draft" &&
              clean(
                item.channel
              ).toLowerCase() ===
                "email"
            )
        ),
      [workspace.outreach]
    );

  const pendingDrafts =
    reachDrafts.filter(
      (item) =>
        clean(
          item.status
        ).toLowerCase() ===
        "draft"
    );

  const replies =
    workspace.referrals.filter(
      (item) =>
        item.relationship_status ===
        "replied"
    ).length;

  const meetings =
    workspace.referrals.filter(
      (item) =>
        item.relationship_status ===
        "meeting"
    ).length;

  const partners =
    workspace.referrals.filter(
      (item) =>
        item.relationship_status ===
        "partner"
    ).length;

  const prospectForDraft =
    selectedDraft
      ? workspace.referrals.find(
          (prospect) =>
            prospect.id ===
            selectedDraft
              .referral_prospect_id
        ) || null
      : null;

  if (!open) {
    return null;
  }

  return (
    <div
      className={
        styles.backdrop
      }
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          stopPolling();
          setOpen(false);
        }
      }}
    >
      <section
        className={
          styles.workstation
        }
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.identity
            }
          >
            <div
              className={
                styles.iconBox
              }
            >
              <Send size={25} />
            </div>

            <div>
              <div
                className={
                  styles.statusLine
                }
              >
                <span />
                REACH · OUTREACH
              </div>

              <h2>
                Reach Workstation
              </h2>

              <p>
                Turns approved Scout relationships into personalized attorney-to-attorney outreach, keeps every draft approval-gated, and hands sent conversations to Orbit for follow-up.
              </p>
            </div>
          </div>

          <div
            className={
              styles.headerActions
            }
          >
            <button
              className={
                styles.refreshButton
              }
              onClick={() =>
                void loadWorkspace()
              }
              disabled={
                loading
              }
            >
              <RefreshCw
                size={14}
                className={
                  loading
                    ? styles.spin
                    : ""
                }
              />
              Refresh
            </button>

            <button
              className={
                styles.closeButton
              }
              onClick={() => {
                stopPolling();
                setOpen(false);
              }}
              aria-label="Close Reach Workstation"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div
          className={
            styles.missionGrid
          }
        >
          <div>
            <span>
              REACH MISSION
            </span>
            <div
              className={
                styles.chips
              }
            >
              <em>
                Personalize approved referral outreach
              </em>
              <em>
                Draft attorney-to-attorney emails
              </em>
              <em>
                Preserve prospect + contact provenance
              </em>
              <em>
                Require human approval before send
              </em>
            </div>
          </div>

          <div>
            <span>
              HANDOFF
            </span>
            <div
              className={
                styles.chips
              }
            >
              <em>
                Scout → Reach
              </em>
              <em>
                Reach → Guard
              </em>
              <em>
                Approved send → Orbit
              </em>
              <em>
                Partner activity → Ledger
              </em>
            </div>
          </div>
        </div>

        <div
          className={
            styles.stats
          }
        >
          <div>
            <span>
              APPROVED TARGETS
            </span>
            <strong>
              {
                approvedProspects.length
              }
            </strong>
          </div>

          <div>
            <span>
              DRAFTS
            </span>
            <strong>
              {
                pendingDrafts.length
              }
            </strong>
          </div>

          <div>
            <span>
              REPLIED
            </span>
            <strong>
              {replies}
            </strong>
          </div>

          <div>
            <span>
              MEETINGS
            </span>
            <strong>
              {meetings}
            </strong>
          </div>

          <div>
            <span>
              PARTNERS
            </span>
            <strong>
              {partners}
            </strong>
          </div>
        </div>

        {notice ? (
          <div
            className={
              styles.notice
            }
          >
            <Sparkles
              size={15}
            />
            {notice}
          </div>
        ) : null}

        {error ? (
          <div
            className={
              styles.error
            }
          >
            <ShieldCheck
              size={15}
            />
            {error}
          </div>
        ) : null}

        <div
          className={
            styles.body
          }
        >
          <section
            className={
              styles.leftColumn
            }
          >
            <div
              className={
                styles.sectionHead
              }
            >
              <div>
                <span>
                  SCOUT → REACH
                </span>
                <h3>
                  Approved Referral Targets
                </h3>
                <p>
                  Reach only drafts against real Scout prospects that have moved into an approved relationship stage.
                </p>
              </div>

              <label
                className={
                  styles.search
                }
              >
                <Search
                  size={14}
                />
                <input
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Search firms, attorneys, practice area..."
                />
              </label>
            </div>

            <div
              className={
                styles.prospectGrid
              }
            >
              {approvedProspects.length ? (
                approvedProspects.map(
                  (prospect) => {
                    const contact =
                      preferredContact(
                        prospect
                      );

                    const hasEmail =
                      Boolean(
                        clean(
                          contact
                            ?.email
                        )
                      );

                    const isRunning =
                      runningProspectId ===
                      prospect.id;

                    return (
                      <article
                        key={
                          prospect.id
                        }
                        className={
                          styles.prospectCard
                        }
                      >
                        <div
                          className={
                            styles.prospectTop
                          }
                        >
                          <div>
                            <div
                              className={
                                styles.metaLine
                              }
                            >
                              <span>
                                {stageLabel(
                                  prospect.relationship_status
                                )}
                              </span>
                              <span>
                                {clean(
                                  prospect.practice_area
                                ) ||
                                  clean(
                                    prospect.category
                                  ) ||
                                  "Practice pending"}
                              </span>
                            </div>

                            <h4>
                              {
                                prospect.organization_name
                              }
                            </h4>

                            <p>
                              {[
                                prospect.city,
                                prospect.state,
                              ]
                                .filter(Boolean)
                                .join(", ") ||
                                "Location pending"}
                            </p>
                          </div>

                          <div
                            className={
                              styles.score
                            }
                          >
                            <strong>
                              {
                                prospect.score ||
                                0
                              }
                            </strong>
                            <span>
                              FIT
                            </span>
                          </div>
                        </div>

                        {prospect.why_fit ? (
                          <div
                            className={
                              styles.fit
                            }
                          >
                            {
                              prospect.why_fit
                            }
                          </div>
                        ) : null}

                        <div
                          className={
                            styles.contact
                          }
                        >
                          <div
                            className={
                              styles.contactIcon
                            }
                          >
                            <UserRoundCheck
                              size={15}
                            />
                          </div>

                          <div>
                            <strong>
                              {contactName(
                                contact
                              ) ||
                                "Contact pending"}
                            </strong>
                            <span>
                              {clean(
                                contact
                                  ?.title
                              ) ||
                                "Title unavailable"}
                            </span>
                          </div>

                          <div
                            className={
                              styles.contactEmail
                            }
                          >
                            <Mail
                              size={12}
                            />
                            {clean(
                              contact
                                ?.email
                            ) ||
                              "Email not enriched"}
                          </div>
                        </div>

                        <div
                          className={
                            styles.cardActions
                          }
                        >
                          {prospect.website ? (
                            <a
                              href={
                                prospect.website
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Firm
                              <ExternalLink
                                size={11}
                              />
                            </a>
                          ) : (
                            <span />
                          )}

                          <button
                            onClick={() =>
                              void runReach(
                                prospect,
                                contact
                              )
                            }
                            disabled={
                              !hasEmail ||
                              Boolean(
                                runningProspectId
                              )
                            }
                          >
                            {isRunning ? (
                              <RefreshCw
                                size={13}
                                className={
                                  styles.spin
                                }
                              />
                            ) : (
                              <MessageSquareText
                                size={13}
                              />
                            )}
                            {isRunning
                              ? "Drafting…"
                              : "Draft Email"}
                          </button>
                        </div>
                      </article>
                    );
                  }
                )
              ) : (
                <div
                  className={
                    styles.empty
                  }
                >
                  <UsersRound
                    size={24}
                  />
                  <h4>
                    No approved referral targets yet
                  </h4>
                  <p>
                    Move Scout prospects to Approved when they are ready for Reach.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside
            className={
              styles.rightColumn
            }
          >
            <div
              className={
                styles.sectionHeadCompact
              }
            >
              <div>
                <span>
                  APPROVAL QUEUE
                </span>
                <h3>
                  Reach Drafts
                </h3>
              </div>

              <div
                className={
                  styles.queueCount
                }
              >
                {
                  pendingDrafts.length
                }
              </div>
            </div>

            <div
              className={
                styles.draftList
              }
            >
              {reachDrafts.length ? (
                reachDrafts
                  .slice(0, 15)
                  .map(
                    (draft) => {
                      const prospect =
                        workspace.referrals.find(
                          (item) =>
                            item.id ===
                            draft.referral_prospect_id
                        );

                      return (
                        <button
                          key={
                            draft.id
                          }
                          className={`${styles.draftRow} ${
                            selectedDraft
                              ?.id ===
                            draft.id
                              ? styles.draftRowActive
                              : ""
                          }`}
                          onClick={() =>
                            setSelectedDraft(
                              draft
                            )
                          }
                        >
                          <div
                            className={
                              styles.draftRowIcon
                            }
                          >
                            <Mail
                              size={14}
                            />
                          </div>

                          <div>
                            <strong>
                              {prospect
                                ?.organization_name ||
                                draft
                                  .metadata
                                  ?.organization_name ||
                                "Referral prospect"}
                            </strong>

                            <span>
                              {draft.subject ||
                                "Untitled Reach draft"}
                            </span>

                            <small>
                              {formatDate(
                                draft.created_at
                              )}
                            </small>
                          </div>

                          <div
                            className={
                              styles.statusBadge
                            }
                          >
                            {clean(
                              draft.status
                            ) ||
                              "draft"}
                          </div>
                        </button>
                      );
                    }
                  )
              ) : (
                <div
                  className={
                    styles.emptySmall
                  }
                >
                  <Mail
                    size={20}
                  />
                  <span>
                    Reach drafts will appear here.
                  </span>
                </div>
              )}
            </div>

            <div
              className={
                styles.pipelineBox
              }
            >
              <span>
                REFERRAL OUTREACH PIPELINE
              </span>

              <div>
                <b>1</b>
                <em>
                  Scout approves prospect
                </em>
              </div>

              <div>
                <b>2</b>
                <em>
                  Reach drafts email
                </em>
              </div>

              <div>
                <b>3</b>
                <em>
                  Guard / human approves
                </em>
              </div>

              <div>
                <b>4</b>
                <em>
                  Email sends
                </em>
              </div>

              <div>
                <b>5</b>
                <em>
                  Orbit follows response
                </em>
              </div>
            </div>
          </aside>
        </div>

        {selectedDraft ? (
          <div
            className={
              styles.reviewBackdrop
            }
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setSelectedDraft(
                  null
                );
              }
            }}
          >
            <div
              className={
                styles.reviewPanel
              }
            >
              <div
                className={
                  styles.reviewHead
                }
              >
                <div>
                  <span>
                    REACH DRAFT · HUMAN REVIEW
                  </span>
                  <h3>
                    {prospectForDraft
                      ?.organization_name ||
                      selectedDraft
                        .metadata
                        ?.organization_name ||
                      "Referral Outreach"}
                  </h3>
                  <p>
                    {selectedDraft
                      .metadata
                      ?.recipient_name ||
                      "Recipient"}
                    {selectedDraft
                      .metadata
                      ?.recipient_email
                      ? ` · ${selectedDraft.metadata.recipient_email}`
                      : ""}
                  </p>
                </div>

                <button
                  onClick={() =>
                    setSelectedDraft(
                      null
                    )
                  }
                >
                  <X
                    size={17}
                  />
                </button>
              </div>

              <div
                className={
                  styles.reviewStatus
                }
              >
                <CheckCircle2
                  size={15}
                />
                DRAFT SAVED · SEND NOT ENABLED
              </div>

              <div
                className={
                  styles.field
                }
              >
                <label>
                  SUBJECT
                </label>
                <div>
                  {selectedDraft.subject ||
                    "No subject"}
                </div>
              </div>

              <div
                className={
                  styles.field
                }
              >
                <label>
                  EMAIL
                </label>
                <div
                  className={
                    styles.emailBody
                  }
                >
                  {fullDraftBody(
                    selectedDraft
                  ) ||
                    "The draft record does not contain a full body yet."}
                </div>
              </div>

              <div
                className={
                  styles.reviewMeta
                }
              >
                <div>
                  <span>
                    RELATIONSHIP LANE
                  </span>
                  <strong>
                    {clean(
                      selectedDraft
                        .metadata
                        ?.referral_lane
                    ) ||
                      "general referral"}
                  </strong>
                </div>

                <div>
                  <span>
                    CONFIDENCE
                  </span>
                  <strong>
                    {Number(
                      selectedDraft
                        .metadata
                        ?.confidence ||
                        0
                    )}
                    %
                  </strong>
                </div>

                <div>
                  <span>
                    CREATED
                  </span>
                  <strong>
                    {formatDate(
                      selectedDraft.created_at
                    )}
                  </strong>
                </div>
              </div>

              <div
                className={
                  styles.reviewFooter
                }
              >
                <ShieldCheck
                  size={15}
                />

                <span>
                  Sending is intentionally disabled in this build. The next PI-only patch connects Guard approval, Gmail sending, and Orbit follow-up.
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

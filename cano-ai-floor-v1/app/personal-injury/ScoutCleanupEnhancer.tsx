"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import styles from "./ScoutCleanupEnhancer.module.css";

type ReferralContact = {
  id?: string;
};

type ReferralProspect = {
  id: string;
  organization_name?: string;
  city?: string;
  state?: string;
  relationship_status?: string;
  contacts?: ReferralContact[];
};

type WorkspacePayload = {
  ok?: boolean;
  referrals?: ReferralProspect[];
};

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

function normalize(
  value: unknown
) {
  return clean(
    value
  )
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

function isRelationshipSelect(
  select:
    HTMLSelectElement
) {
  return [
    "new",
    "researching",
    "approved",
    "contacted",
    "replied",
    "meeting",
    "partner",
    "not_fit",
  ].includes(
    normalize(
      select.value
    )
  );
}

function findScoutCards() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      "article"
    )
  ).filter(
    (card) => {
      const h3 =
        card.querySelector(
          "h3"
        );

      const relationshipSelect =
        Array.from(
          card.querySelectorAll<HTMLSelectElement>(
            "select"
          )
        ).find(
          isRelationshipSelect
        );

      return Boolean(
        h3 &&
        relationshipSelect
      );
    }
  );
}

function firmNameFromCard(
  card:
    HTMLElement
) {
  return clean(
    card.querySelector(
      "h3"
    )?.textContent
  );
}

function referralMatch(
  card:
    HTMLElement,
  referrals:
    ReferralProspect[]
) {
  const organization =
    normalize(
      firmNameFromCard(
        card
      )
    );

  const matches =
    referrals.filter(
      (row) =>
        normalize(
          row.organization_name
        ) ===
        organization
    );

  if (
    matches.length <=
    1
  ) {
    return matches[0] ||
      null;
  }

  /*
  | Disambiguate same-name firms by matching the rendered card location.
  */
  const cardText =
    normalize(
      card.textContent
    );

  return (
    matches.find(
      (row) => {
        const city =
          normalize(
            row.city
          );

        const state =
          normalize(
            row.state
          );

        return (
          (!city ||
            cardText.includes(
              city
            )) &&
          (!state ||
            cardText.includes(
              state
            ))
        );
      }
    ) ||
    matches[0] ||
    null
  );
}

function removePhonePlaceholders(
  card:
    HTMLElement
) {
  const phoneIcons =
    Array.from(
      card.querySelectorAll<SVGElement>(
        "svg.lucide-phone"
      )
    );

  for (
    const icon of
    phoneIcons
  ) {
    const row =
      icon.closest(
        "span"
      ) as HTMLElement | null;

    if (row) {
      row.style.display =
        "none";
    }
  }
}

function findFooter(
  card:
    HTMLElement
) {
  const select =
    Array.from(
      card.querySelectorAll<HTMLSelectElement>(
        "select"
      )
    ).find(
      isRelationshipSelect
    );

  if (!select) {
    return null;
  }

  return (
    select.parentElement ||
    null
  );
}

function trashSvg() {
  return `
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 6h18"></path>
      <path d="M8 6V4h8v2"></path>
      <path d="M19 6l-1 14H6L5 6"></path>
      <path d="M10 11v5"></path>
      <path d="M14 11v5"></path>
    </svg>
  `;
}

export default function ScoutCleanupEnhancer() {
  const referralsRef =
    useRef<
      ReferralProspect[]
    >([]);

  const loadingRef =
    useRef(
      false
    );

  const loadReferrals =
    useCallback(
      async () => {
        if (
          loadingRef.current
        ) {
          return;
        }

        loadingRef.current =
          true;

        try {
          const response =
            await fetch(
              `/api/pi/workspace?ts=${Date.now()}`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json() as
              WorkspacePayload;

          if (
            response.ok &&
            data?.ok !==
              false &&
            Array.isArray(
              data.referrals
            )
          ) {
            referralsRef.current =
              data.referrals;
          }
        } catch {
          /*
          | The normal PI workspace already surfaces load errors.
          | This enhancer stays silent so it never breaks the floor.
          */
        } finally {
          loadingRef.current =
            false;
        }
      },
      []
    );

  const enhanceCards =
    useCallback(
      () => {
        const referrals =
          referralsRef.current;

        if (
          !referrals.length
        ) {
          return;
        }

        const cards =
          findScoutCards();

        for (
          const card of
          cards
        ) {
          removePhonePlaceholders(
            card
          );

          const prospect =
            referralMatch(
              card,
              referrals
            );

          if (!prospect) {
            continue;
          }

          card.dataset.scoutProspectId =
            prospect.id;

          const existing =
            card.querySelector<HTMLButtonElement>(
              '[data-scout-remove-button="true"]'
            );

          if (existing) {
            continue;
          }

          const footer =
            findFooter(
              card
            );

          if (!footer) {
            continue;
          }

          const removeButton =
            document.createElement(
              "button"
            );

          removeButton.type =
            "button";

          removeButton.className =
            styles.removeButton;

          removeButton.dataset.scoutRemoveButton =
            "true";

          removeButton.title =
            "Permanently remove this Scout prospect so it can be discovered again with fresh research.";

          removeButton.innerHTML =
            `${trashSvg()}<span>Remove</span>`;

          removeButton.addEventListener(
            "click",
            async (
              event
            ) => {
              event.preventDefault();
              event.stopPropagation();

              const firm =
                clean(
                  prospect.organization_name
                ) ||
                "this prospect";

              const confirmed =
                window.confirm(
                  `Remove ${firm} from Scout?\n\nThis is for cleanup / re-research. The prospect and its Scout contact records will be deleted so Scout can discover the firm again with current data.\n\nRecords with a sent email or referral meeting are protected and will not be deleted.`
                );

              if (
                !confirmed
              ) {
                return;
              }

              removeButton.disabled =
                true;

              removeButton.classList.add(
                styles.removeButtonWorking
              );

              removeButton.innerHTML =
                `<span>Removing…</span>`;

              try {
                const response =
                  await fetch(
                    "/api/pi/scout/remove",
                    {
                      method:
                        "POST",

                      headers: {
                        "Content-Type":
                          "application/json",
                      },

                      body:
                        JSON.stringify(
                          {
                            prospectId:
                              prospect.id,
                          }
                        ),
                    }
                  );

                const data =
                  await response.json();

                if (
                  !response.ok ||
                  data?.ok ===
                    false
                ) {
                  throw new Error(
                    data?.error ||
                    "Unable to remove this Scout prospect."
                  );
                }

                /*
                | Remove immediately for a clean visual response, then reload
                | so counts / filters / workspace state all reconcile.
                */
                card.style.opacity =
                  "0";

                card.style.transform =
                  "scale(.985)";

                window.setTimeout(
                  () => {
                    window.location.reload();
                  },
                  250
                );
              } catch (
                error
              ) {
                removeButton.disabled =
                  false;

                removeButton.classList.remove(
                  styles.removeButtonWorking
                );

                removeButton.innerHTML =
                  `${trashSvg()}<span>Remove</span>`;

                window.alert(
                  error instanceof
                  Error
                    ? error.message
                    : "Unable to remove this Scout prospect."
                );
              }
            }
          );

          /*
          | Put cleanup control beside the existing relationship status and
          | Draft Outreach controls.
          */
          footer.insertBefore(
            removeButton,
            footer.lastElementChild
          );
        }
      },
      []
    );

  useEffect(
    () => {
      let stopped =
        false;

      void loadReferrals()
        .then(
          () => {
            if (
              !stopped
            ) {
              enhanceCards();
            }
          }
        );

      const observer =
        new MutationObserver(
          () => {
            if (
              stopped
            ) {
              return;
            }

            enhanceCards();
          }
        );

      observer.observe(
        document.body,
        {
          childList:
            true,

          subtree:
            true,
        }
      );

      const refresh =
        window.setInterval(
          () => {
            void loadReferrals()
              .then(
                () => {
                  if (
                    !stopped
                  ) {
                    enhanceCards();
                  }
                }
              );
          },
          30000
        );

      return () => {
        stopped =
          true;

        observer.disconnect();

        window.clearInterval(
          refresh
        );
      };
    },
    [
      enhanceCards,
      loadReferrals,
    ]
  );

  return null;
}

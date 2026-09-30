import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  SPECIALIST_AGENTS,
  isSpecialistAgentId,
  insertAgentRun,
  getLatestSpecialistState,
} from "../../../../lib/supabase/agents";

import {
  buildStoredMatter,
  getMatterByMondayId,
  insertActivity,
} from "../../../../lib/supabase/matters";

import {
  FIRM_HABEAS_DRAFTING_PROFILE,
} from "../../../../lib/legal/firm-habeas-profile";

import {
  retrieveFirmDraftingSources,
} from "../../../../lib/legal/firm-drafting-retrieval";

export async function POST(
  request: NextRequest
) {
  const body =
    await request.json();

  const mondayItemId =
    String(
      body?.mondayItemId || ""
    );

  const agentId =
    String(
      body?.agentId || ""
    );

  const triggerType =
    String(
      body?.triggerType ||
        "manual"
    );

  const options =
    body?.options &&
    typeof body.options === "object"
      ? body.options
      : {};

  if (
    !mondayItemId ||
    !agentId
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "mondayItemId and agentId are required.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !isSpecialistAgentId(
      agentId
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `Unsupported specialist agent: ${agentId}`,
      },
      {
        status: 400,
      }
    );
  }

  const webhook =
    process.env
      .N8N_SPECIALIST_AGENT_WEBHOOK;

  if (!webhook) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing N8N_SPECIALIST_AGENT_WEBHOOK. Add the generic specialist workflow webhook in Vercel.",
      },
      {
        status: 500,
      }
    );
  }

  try {
    const matter =
      await getMatterByMondayId(
        mondayItemId
      );

    if (!matter) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Matter not found in Supabase.",
        },
        {
          status: 404,
        }
      );
    }

    const storedMatter =
      await buildStoredMatter(
        matter
      );

    if (
      !storedMatter?.caseBrain
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Case Brain must be completed before a specialist agent can run.",
        },
        {
          status: 409,
        }
      );
    }

    const priorAgents =
      await getLatestSpecialistState(
        matter.id
      );

    const config =
      SPECIALIST_AGENTS[
        agentId
      ];

    const existingState =
      priorAgents[agentId];

    if (
      existingState?.run
        ?.status === "working"
    ) {
      return NextResponse.json(
        {
          ok: true,
          accepted: true,
          deduplicated: true,
          runId:
            existingState.run.id,
          agentId,
          agentName:
            config.name,
          status: "working",
        },
        {
          status: 202,
        }
      );
    }

    let draftingRequest: any =
      options;

    let firmSourceCount = 0;
    let firmRetrievalWarning = "";

    const draftType =
      String(
        (options as any)
          ?.draftType || ""
      ).toLowerCase();

    if (
      agentId === "drafting"
    ) {
      let firmDraftingSources:
        any[] = [];

      let firmDraftingQuery =
        "";

      try {
        const retrieval =
          await retrieveFirmDraftingSources(
            {
              matter:
                storedMatter,
              priorAgents,
              draftType:
                draftType ||
                "habeas",
            }
          );

        firmDraftingSources =
          retrieval.sources;

        firmDraftingQuery =
          retrieval.query;

        firmSourceCount =
          firmDraftingSources.length;
      } catch (error) {
        firmRetrievalWarning =
          error instanceof Error
            ? error.message
            : "Firm drafting retrieval failed.";

        // Drafting is still allowed
        // to proceed using Case Brain,
        // specialists, authorities,
        // and the static firm profile.
        console.error(
          "Firm drafting retrieval:",
          error
        );
      }

      draftingRequest = {
        ...options,

        ...(draftType ===
        "habeas"
          ? {
              firmDraftingProfile:
                FIRM_HABEAS_DRAFTING_PROFILE,

              firmTemplateStatus:
                "cano_habeas_exemplars_v1",
            }
          : {}),

        firmDraftingRetrieval: {
          enabled: true,

          documentFamily:
            draftType ===
            "bond_motion"
              ? "bond"
              : "habeas",

          sourceRole:
            "style_exemplar",

          sourceCount:
            firmDraftingSources.length,

          query:
            firmDraftingQuery,

          warning:
            firmRetrievalWarning ||
            null,
        },

        firmDraftingSources,

        firmDraftingInstructions: [
          "The supplied firmDraftingSources are Cano Law Firm drafting exemplars retrieved specifically for this active matter.",
          "Use them for writing style, pleading organization, section sequencing, factual-development patterns, argument organization, and level of detail.",
          "Never copy exemplar client facts into the active matter.",
          "Never copy names, A-numbers, dates, detention facilities, family facts, criminal history, or procedural history from an exemplar.",
          "The active Case Brain and verified specialist record control all client facts.",
          "Verified authority research controls legal propositions and quotations.",
          "An exemplar may show how Cano Law Firm framed an argument, but it does not independently verify the legal authority supporting that argument.",
          "Court orders and outcome references are not style exemplars unless explicitly identified as such.",
          "Prefer closely matched exemplar sections over generic style guidance when both are available.",
          "Preserve the active matter's unresolved facts and attorney-input placeholders.",
        ],
      };
    }

    const inputPayload = {
      matter: storedMatter,

      request:
        draftingRequest,

      prior_specialists:
        Object.fromEntries(
          Object.entries(
            priorAgents
          ).map(
            ([
              id,
              state,
            ]: [
              string,
              any
            ]) => [
              id,
              state?.output ||
                null,
            ]
          )
        ),
    };

    const run =
      await insertAgentRun({
        matter_id:
          matter.id,

        monday_item_id:
          mondayItemId,

        agent_id:
          agentId,

        agent_name:
          config.name,

        trigger_type:
          triggerType,

        status:
          "working",

        input_payload:
          inputPayload,

        started_at:
          new Date()
            .toISOString(),
      });

    if (!run) {
      throw new Error(
        "Unable to create specialist agent run."
      );
    }

    await insertActivity({
      matter_id:
        matter.id,

      monday_item_id:
        mondayItemId,

      event_type:
        "specialist_started",

      agent_id:
        agentId,

      actor:
        "Santiago",

      title:
        `${config.name} started`,

      detail:
        agentId === "drafting"
          ? `${config.routeLabel} is drafting with ${firmSourceCount} retrieved firm exemplar section${
              firmSourceCount ===
              1
                ? ""
                : "s"
            }.`
          : `${config.routeLabel} is analyzing the active matter.`,

      metadata: {
        run_id:
          run.id,

        trigger_type:
          triggerType,

        ...(agentId ===
        "drafting"
          ? {
              firm_source_count:
                firmSourceCount,

              firm_retrieval_warning:
                firmRetrievalWarning ||
                null,
            }
          : {}),
      },
    });

    const callbackUrl =
      new URL(
        "/api/agents/complete",
        request.nextUrl.origin
      ).toString();

    const authorityResearchUrl =
      new URL(
        "/api/legal-authorities/research",
        request.nextUrl.origin
      ).toString();

    const response =
      await fetch(
        webhook,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...(process.env
              .N8N_SHARED_SECRET
              ? {
                  "x-cano-secret":
                    process.env
                      .N8N_SHARED_SECRET,
                }
              : {}),
          },

          body:
            JSON.stringify({
              action:
                "run_specialist_agent",

              runId:
                run.id,

              agentId,

              agentName:
                config.name,

              mondayItemId,

              databaseMatterId:
                matter.id,

              triggerType,

              callbackUrl,

              authorityResearchUrl,

              input:
                inputPayload,
            }),

          cache:
            "no-store",
        }
      );

    const ack =
      await response.text();

    if (
      !response.ok
    ) {
      throw new Error(
        `n8n could not accept ${config.name} (${response.status}): ${
          ack ||
          response.statusText
        }`
      );
    }

    return NextResponse.json(
      {
        ok: true,

        accepted: true,

        runId:
          run.id,

        agentId,

        agentName:
          config.name,

        status:
          "working",

        ...(agentId ===
        "drafting"
          ? {
              firmDraftingSources:
                firmSourceCount,

              firmDraftingRetrievalWarning:
                firmRetrievalWarning ||
                null,
            }
          : {}),
      },
      {
        status: 202,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to start specialist agent.",
      },
      {
        status: 500,
      }
    );
  }
}

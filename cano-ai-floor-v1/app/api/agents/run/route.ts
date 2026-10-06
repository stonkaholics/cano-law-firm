import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  SPECIALIST_AGENTS,
  isSpecialistAgentId,
  insertAgentRun,
  getLatestSpecialistState,
  updateAgentRun,
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

/*
|--------------------------------------------------------------------------
| SPECIALIST WEBHOOK
|--------------------------------------------------------------------------
|
| Keep the Vercel env var as the preferred configuration, but use the
| production n8n endpoint as a safe fallback so Immigration specialists
| cannot silently stop dispatching because the env var is missing/renamed.
|
*/

const DEFAULT_SPECIALIST_WEBHOOK =
  "https://epiq.app.n8n.cloud/webhook/specialist-agent";

/*
|--------------------------------------------------------------------------
| WORKING-RUN RECOVERY
|--------------------------------------------------------------------------
|
| A failed n8n execution can die before /api/agents/complete is called.
| In that situation Supabase still says the latest run is "working".
|
| Previously /api/agents/run treated ANY "working" run as a duplicate forever,
| which meant every later click returned accepted/deduplicated WITHOUT ever
| posting to n8n again.
|
| Automatic pipeline calls still dedupe fresh work. Manual refreshes can
| supersede the stuck run immediately, and old automatic runs self-heal.
|
*/

const WORKING_RUN_STALE_MS = 10 * 60 * 1000;

function ageMs(isoDate?: string | null) {
  if (!isoDate) return Number.POSITIVE_INFINITY;

  const time = new Date(isoDate).getTime();

  if (!Number.isFinite(time)) {
    return Number.POSITIVE_INFINITY;
  }

  return Date.now() - time;
}

export async function POST(
  request: NextRequest
) {
  const body =
    await request.json();

  const mondayItemId =
    String(
      body?.mondayItemId || ""
    ).trim();

  const agentId =
    String(
      body?.agentId || ""
    ).trim();

  const triggerType =
    String(
      body?.triggerType ||
        "manual"
    ).trim();

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
    String(
      process.env
        .N8N_SPECIALIST_AGENT_WEBHOOK ||
        DEFAULT_SPECIALIST_WEBHOOK
    ).trim();

  if (!webhook) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Specialist webhook is not configured.",
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

    /*
    |--------------------------------------------------------------------------
    | DO NOT LET FAILED N8N RUNS PERMANENTLY BLOCK IMMIGRATION
    |--------------------------------------------------------------------------
    */

    if (
      existingState?.run
        ?.status === "working"
    ) {
      const existingRun =
        existingState.run;

      const runAge =
        ageMs(
          existingRun.started_at
        );

      const explicitUserRetry =
        triggerType === "refresh" ||
        body?.forceRestart === true;

      const staleWorkingRun =
        runAge >=
        WORKING_RUN_STALE_MS;

      /*
      | Pipeline calls should not create duplicates while a real run is fresh.
      | Manual refreshes are intentional user retries and may supersede it.
      */
      if (
        !explicitUserRetry &&
        !staleWorkingRun
      ) {
        return NextResponse.json(
          {
            ok: true,
            accepted: true,
            deduplicated: true,
            runId:
              existingRun.id,
            agentId,
            agentName:
              config.name,
            status: "working",
            webhookDispatched:
              false,
            reason:
              "fresh_working_run",
          },
          {
            status: 202,
          }
        );
      }

      /*
      | Close the abandoned run before creating the replacement. This keeps
      | Supabase truthful and prevents the UI from being locked forever.
      */
      try {
        await updateAgentRun(
          existingRun.id,
          {
            status: "error",
            error_message:
              explicitUserRetry
                ? "Superseded by an explicit specialist refresh."
                : "Recovered stale working run that never completed its n8n callback.",
            completed_at:
              new Date()
                .toISOString(),
          }
        );

        await insertActivity({
          matter_id:
            matter.id,
          monday_item_id:
            mondayItemId,
          event_type:
            "specialist_stale_run_recovered",
          agent_id:
            agentId,
          actor:
            "Cano AI",
          title:
            `${config.name} stale run cleared`,
          detail:
            explicitUserRetry
              ? "A user refresh superseded the prior working run so n8n could be dispatched again."
              : "The prior run remained working without a completion callback and was automatically cleared.",
          metadata: {
            superseded_run_id:
              existingRun.id,
            previous_started_at:
              existingRun.started_at,
            age_ms:
              runAge,
            trigger_type:
              triggerType,
          },
        });
      } catch (recoveryError) {
        console.error(
          "Unable to mark prior specialist run as superseded:",
          recoveryError
        );
      }
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

    /*
    |--------------------------------------------------------------------------
    | SCRIBE RETRIEVAL
    |--------------------------------------------------------------------------
    |
    | Preserve the drafting-library work already added. Immigration specialist
    | dispatch does not depend on this branch unless agentId === "drafting".
    |
    */

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

        /*
        | Drafting may continue using Case Brain, specialists, authorities,
        | and the static firm profile if exemplar retrieval itself fails.
        */
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
      matter:
        storedMatter,

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
          : `${config.routeLabel} is being dispatched to the Cano n8n specialist workflow.`,

      metadata: {
        run_id:
          run.id,

        trigger_type:
          triggerType,

        specialist_webhook:
          webhook,

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

    /*
    |--------------------------------------------------------------------------
    | DISPATCH TO N8N
    |--------------------------------------------------------------------------
    */

    let response: Response;
    let ack = "";

    try {
      response =
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

      ack =
        await response.text();
    } catch (dispatchError) {
      const message =
        dispatchError instanceof Error
          ? dispatchError.message
          : "Unknown n8n dispatch error.";

      /*
      | Critical recovery: never leave a run as "working" if the POST itself
      | could not be delivered.
      */
      await updateAgentRun(
        run.id,
        {
          status: "error",
          error_message:
            `n8n specialist webhook dispatch failed: ${message}`,
          completed_at:
            new Date()
              .toISOString(),
        }
      );

      await insertActivity({
        matter_id:
          matter.id,

        monday_item_id:
          mondayItemId,

        event_type:
          "specialist_dispatch_error",

        agent_id:
          agentId,

        actor:
          "Cano AI",

        title:
          `${config.name} could not reach n8n`,

        detail:
          message,

        metadata: {
          run_id:
            run.id,
          webhook,
        },
      });

      throw new Error(
        `Could not reach the n8n specialist webhook: ${message}`
      );
    }

    if (
      !response.ok
    ) {
      const message =
        `n8n could not accept ${config.name} (${response.status}): ${
          ack ||
          response.statusText
        }`;

      /*
      | Same recovery for an HTTP rejection: mark the new run error now,
      | otherwise the next click would once again look permanently "working".
      */
      await updateAgentRun(
        run.id,
        {
          status: "error",
          error_message:
            message,
          completed_at:
            new Date()
              .toISOString(),
        }
      );

      await insertActivity({
        matter_id:
          matter.id,

        monday_item_id:
          mondayItemId,

        event_type:
          "specialist_dispatch_error",

        agent_id:
          agentId,

        actor:
          "Cano AI",

        title:
          `${config.name} n8n dispatch rejected`,

        detail:
          message,

        metadata: {
          run_id:
            run.id,
          webhook,
          http_status:
            response.status,
          response_body:
            ack,
        },
      });

      throw new Error(
        message
      );
    }

    return NextResponse.json(
      {
        ok: true,

        accepted: true,

        webhookDispatched:
          true,

        webhook:
          webhook,

        runId:
          run.id,

        agentId,

        agentName:
          config.name,

        status:
          "working",

        n8nAck:
          ack
            ? ack.slice(0, 1000)
            : null,

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

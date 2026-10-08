import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getLatestSpecialistState,
} from "../../../../lib/supabase/agents";

import {
  buildStoredMatter,
  getMatterByMondayId,
} from "../../../../lib/supabase/matters";

import {
  retrieveFirmDraftingSources,
} from "../../../../lib/legal/firm-drafting-retrieval";

/*
|--------------------------------------------------------------------------
| RHEA RUN WRAPPER
|--------------------------------------------------------------------------
|
| This route adds Cano Law Firm response/reply exemplars to Rhea's request,
| then forwards the enriched request into the existing specialist dispatcher.
|
| Existing /api/agents/run is intentionally left untouched.
|--------------------------------------------------------------------------
*/

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function POST(
  request: NextRequest
) {
  const body =
    await request.json();

  const mondayItemId =
    clean(body?.mondayItemId);

  if (!mondayItemId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "mondayItemId is required.",
      },
      {
        status: 400,
      }
    );
  }

  const incomingOptions =
    body?.options &&
    typeof body.options ===
      "object"
      ? body.options
      : {};

  const responseType =
    clean(
      incomingOptions
        ?.responseType
    );

  /*
  | A bond opposition should use the existing bond family.
  | Every other current Rhea filing is treated as a habeas-response search.
  */
  const retrievalDraftType =
    responseType ===
    "bond_opposition"
      ? "bond_motion"
      : "government_response_reply";

  const documentFamily =
    retrievalDraftType ===
    "bond_motion"
      ? "bond"
      : "habeas";

  const preferredDocumentKind =
    documentFamily === "habeas"
      ? "government_response_reply"
      : "";

  let firmDraftingSources:
    any[] = [];

  let firmDraftingQuery = "";
  let firmRetrievalWarning = "";
  let retrievalStats:
    Record<string, any> | null =
      null;

  let ingestion:
    Record<string, any> | null =
      null;

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

    if (!storedMatter?.caseBrain) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Case Brain must be completed before Rhea can run.",
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

    const retrieval =
      await retrieveFirmDraftingSources(
        {
          matter:
            storedMatter,

          priorAgents,

          draftType:
            retrievalDraftType,

          preferredDocumentKind:
            preferredDocumentKind ||
            undefined,

          intendedAgent:
            "rebuttal",
        }
      );

    firmDraftingSources =
      retrieval.sources;

    firmDraftingQuery =
      retrieval.query;

    retrievalStats =
      retrieval.retrievalStats;

    ingestion =
      retrieval.ingestion;

    firmRetrievalWarning =
      Array.isArray(
        retrieval.warnings
      )
        ? retrieval.warnings
            .filter(Boolean)
            .join(" ")
        : "";
  } catch (error) {
    firmRetrievalWarning =
      error instanceof Error
        ? error.message
        : "Rhea firm drafting retrieval failed.";

    /*
    | Rhea may continue using Case Brain + verified authority even if the
    | style-exemplar retrieval layer is temporarily unavailable.
    */
    console.error(
      "Rhea firm drafting retrieval:",
      error
    );
  }

  const enrichedOptions = {
    ...incomingOptions,

    firmTemplateStatus:
      preferredDocumentKind &&
      firmDraftingSources.length
        ? "cano_government_response_exemplar_v1"
        : "no_response_exemplar_retrieved",

    firmDraftingRetrieval: {
      enabled: true,

      documentFamily,

      sourceRole:
        "style_exemplar",

      preferredDocumentKind:
        preferredDocumentKind ||
        null,

      intendedAgent:
        "rebuttal",

      sourceCount:
        firmDraftingSources.length,

      query:
        firmDraftingQuery,

      retrievalStats,

      ingestion,

      warning:
        firmRetrievalWarning ||
        null,
    },

    firmDraftingSources,

    firmDraftingInstructions: [
      "These are Cano Law Firm internal drafting exemplars selected for Rhea's current response/reply task.",
      "When a government_response_reply exemplar is supplied, treat it as high-priority style and structure guidance.",
      "Use it for tone, caption organization, introduction style, point-by-point rebuttal sequencing, argument organization, conclusion structure, signature structure, and certificate-of-service structure when appropriate.",
      "Rewrite every sentence for the active matter.",
      "Never copy exemplar client names, A-numbers, dates, detention facilities, case numbers, family facts, criminal facts, immigration facts, procedural events, or other client-specific information.",
      "Never copy the exemplar's requested relief unless the active record and verified authority independently support the same relief.",
      "Never treat an exemplar citation or quotation as verified authority merely because it appears in the exemplar.",
      "Case Brain and verified specialist outputs control active-matter facts.",
      "Verified authority research controls legal propositions, quotations, holdings, and citation status.",
      "If an exemplar contains an apparent carryover error or internal inconsistency, do not reproduce it.",
      "Preserve unresolved active-matter facts as attorney-review placeholders.",
    ],
  };

  /*
  |--------------------------------------------------------------------------
  | FORWARD INTO THE EXISTING SPECIALIST DISPATCHER
  |--------------------------------------------------------------------------
  |
  | Preserve the current /api/agents/run behavior, Supabase run tracking,
  | n8n webhook, authority-research flow, callback, and activity logging.
  |--------------------------------------------------------------------------
  */

  const cookie =
    request.headers.get(
      "cookie"
    );

  const authorization =
    request.headers.get(
      "authorization"
    );

  const forwarded =
    await fetch(
      new URL(
        "/api/agents/run",
        request.nextUrl.origin
      ),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          ...(cookie
            ? {
                cookie,
              }
            : {}),

          ...(authorization
            ? {
                authorization,
              }
            : {}),
        },

        body:
          JSON.stringify({
            ...body,
            mondayItemId,
            agentId:
              "rebuttal",
            options:
              enrichedOptions,
          }),

        cache:
          "no-store",
      }
    );

  const text =
    await forwarded.text();

  let payload: any = {};

  try {
    payload =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    payload = {
      ok:
        forwarded.ok,
      raw:
        text,
    };
  }

  return NextResponse.json(
    {
      ...payload,

      rheaFirmDrafting: {
        sourceCount:
          firmDraftingSources.length,

        preferredDocumentKind:
          preferredDocumentKind ||
          null,

        warning:
          firmRetrievalWarning ||
          null,

        retrievalStats,

        ingestion,
      },
    },
    {
      status:
        forwarded.status,
    }
  );
}

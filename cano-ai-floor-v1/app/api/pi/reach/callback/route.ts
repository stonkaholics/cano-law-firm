import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseSelect,
} from "../../../../../lib/supabase/rest";

type Prospect = {
  id: string;
  organization_name: string;
  contact_name: string;
  category: string;
  practice_area: string;
  city: string;
  state: string;
  website: string;
  email: string;
  phone: string;
  why_fit: string;
  source_url: string;
  relationship_status: string;
  score: number;
  metadata: Record<string, any>;
};

type Contact = {
  id: string;
  prospect_id: string;
  apollo_person_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  title: string;
  seniority: string;
  email: string;
  phone: string;
  linkedin_url: string;
  priority: number;
  selected_for_outreach: boolean;
  enrichment_status: string;
  email_status: string;
  metadata: Record<string, any>;
};

type Outreach = {
  id: string;
  referral_prospect_id: string;
  channel: string;
  direction: string;
  status: string;
  subject: string;
  message_summary: string;
  approved_by: string;
  approved_at: string | null;
  occurred_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  metadata: Record<string, any>;
};

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

function eq(
  value: string
) {
  return `eq.${value}`;
}

async function proxyToWorkspace(
  request: NextRequest,
  body: Record<string, any>
) {
  const workspaceUrl =
    new URL(
      "/api/pi/workspace",
      request.nextUrl.origin
    );

  const response =
    await fetch(
      workspaceUrl,
      {
        method:
          "POST",

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
          JSON.stringify(
            body
          ),

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  let data: any =
    null;

  try {
    data =
      text
        ? JSON.parse(
            text
          )
        : {};
  } catch {
    data = {
      ok:
        response.ok,
      raw:
        text,
    };
  }

  return NextResponse.json(
    data,
    {
      status:
        response.status,
    }
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const action =
      clean(
        body?.action
      );

    if (
      action ===
      "get_referral_outreach_context"
    ) {
      const prospectId =
        clean(
          body
            ?.prospect_id ||
          body
            ?.prospectId
        );

      const contactId =
        clean(
          body
            ?.contact_id ||
          body
            ?.contactId
        );

      if (!prospectId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "prospect_id is required.",
          },
          {
            status: 400,
          }
        );
      }

      const prospects =
        await supabaseSelect<Prospect>(
          "pi_referral_prospects",
          {
            select:
              "*",
            id:
              eq(
                prospectId
              ),
            limit:
              1,
          }
        );

      const prospect =
        prospects[0] ||
        null;

      if (!prospect) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Referral prospect was not found.",
          },
          {
            status: 404,
          }
        );
      }

      const contacts =
        await supabaseSelect<Contact>(
          "pi_referral_contacts",
          {
            select:
              "*",
            prospect_id:
              eq(
                prospectId
              ),
            order:
              "priority.asc",
            limit:
              25,
          }
        );

      let normalizedContacts =
        contacts;

      if (contactId) {
        const requested =
          contacts.find(
            (contact) =>
              contact.id ===
              contactId
          );

        if (requested) {
          normalizedContacts = [
            requested,
            ...contacts.filter(
              (contact) =>
                contact.id !==
                contactId
            ),
          ];
        }
      }

      const priorOutreach =
        await supabaseSelect<Outreach>(
          "pi_outreach_events",
          {
            select:
              "*",
            referral_prospect_id:
              eq(
                prospectId
              ),
            order:
              "created_at.desc",
            limit:
              50,
          }
        );

      return NextResponse.json({
        ok: true,
        prospect,
        contacts:
          normalizedContacts,
        prior_outreach:
          priorOutreach,
      });
    }

    if (
      action ===
      "create_outreach_event"
    ) {
      return proxyToWorkspace(
        request,
        body
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          `Unsupported Reach callback action: ${action}`,
      },
      {
        status: 400,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to process Reach callback.",
      },
      {
        status: 500,
      }
    );
  }
}

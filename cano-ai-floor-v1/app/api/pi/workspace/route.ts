import { NextRequest, NextResponse } from "next/server";

type TableName =
  | "pi_referral_prospects"
  | "pi_referral_contacts"
  | "pi_leads"
  | "pi_campaigns"
  | "pi_incident_watch"
  | "pi_market_opportunities"
  | "pi_outreach_events"
  | "pi_incident_sources"
  | "pi_incident_intelligence"
  | "pi_incident_people"
  | "pi_report_research_tasks";

const APOLLO_TEST_LIMIT_PER_HOUR = 10;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in Vercel."
    );
  }

  return { url, key };
}

async function supabaseRequest(
  path: string,
  init: RequestInit = {}
) {
  const { url, key } = config();

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase PI request failed (${response.status}): ${
        text || response.statusText
      }`
    );
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readTable(
  table: TableName,
  order: string
) {
  return (
    (await supabaseRequest(
      `${table}?select=*&order=${encodeURIComponent(order)}`
    )) || []
  );
}

async function getApolloBudget() {
  const result = await supabaseRequest(
    "rpc/get_pi_apollo_budget",
    {
      method: "POST",
      body: JSON.stringify({
        p_limit: APOLLO_TEST_LIMIT_PER_HOUR,
      }),
    }
  );

  const row = Array.isArray(result)
    ? result[0]
    : result;

  return {
    limit: Number(
      row?.limit_value ||
      APOLLO_TEST_LIMIT_PER_HOUR
    ),
    used: Number(row?.used_value || 0),
    remaining: Number(
      row?.remaining_value ??
      APOLLO_TEST_LIMIT_PER_HOUR
    ),
    window_minutes: 60,
  };
}

export async function GET() {
  try {
    const [
      referrals,
      contacts,
      leads,
      campaigns,
      incidents,
      opportunities,
      outreach,
      incidentSources,
      incidentIntelligence,
      incidentPeople,
      apolloBudget,
    ] = await Promise.all([
      readTable(
        "pi_referral_prospects",
        "score.desc,created_at.desc"
      ),
      readTable(
        "pi_referral_contacts",
        "priority.asc,created_at.asc"
      ),
      readTable(
        "pi_leads",
        "created_at.desc"
      ),
      readTable(
        "pi_campaigns",
        "created_at.desc"
      ),
      readTable(
        "pi_incident_watch",
        "occurred_at.desc"
      ),
      readTable(
        "pi_market_opportunities",
        "score.desc,created_at.desc"
      ),
      readTable(
        "pi_outreach_events",
        "created_at.desc"
      ),
      readTable(
        "pi_incident_sources",
        "region.asc,name.asc"
      ),
      readTable(
        "pi_incident_intelligence",
        "research_score.desc,updated_at.desc"
      ),
      readTable(
        "pi_incident_people",
        "created_at.desc"
      ),
      getApolloBudget(),
    ]);

    const contactsByProspect =
      new Map<string, any[]>();

    for (const contact of contacts) {
      const prospectId =
        String(contact.prospect_id || "");

      if (!contactsByProspect.has(prospectId)) {
        contactsByProspect.set(
          prospectId,
          []
        );
      }

      contactsByProspect
        .get(prospectId)!
        .push(contact);
    }

    const hydratedReferrals =
      referrals.map(
        (referral: any) => ({
          ...referral,
          contacts:
            contactsByProspect.get(
              String(referral.id)
            ) || [],
        })
      );

    return NextResponse.json({
      ok: true,
      referrals: hydratedReferrals,
      leads,
      campaigns,
      incidents,
      opportunities,
      outreach,
      incidentSources,
      incidentIntelligence,
      incidentPeople,
      apolloBudget,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load PI workspace.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const action =
      String(body?.action || "");

    if (
      action ===
      "reserve_apollo_call"
    ) {
      const agentId =
        String(
          body?.agent_id ||
          body?.agentId ||
          "scout"
        );

      const operation =
        String(
          body?.operation ||
          "apollo_request"
        );

      const requestedLimit =
        Number(
          body?.limit ||
          APOLLO_TEST_LIMIT_PER_HOUR
        );

      const limit =
        Math.max(
          1,
          Math.min(
            APOLLO_TEST_LIMIT_PER_HOUR,
            Number.isFinite(
              requestedLimit
            )
              ? requestedLimit
              : APOLLO_TEST_LIMIT_PER_HOUR
          )
        );

      const result =
        await supabaseRequest(
          "rpc/reserve_pi_apollo_call",
          {
            method: "POST",
            body: JSON.stringify({
              p_agent_id:
                agentId,
              p_operation:
                operation,
              p_limit:
                limit,
            }),
          }
        );

      const row =
        Array.isArray(result)
          ? result[0]
          : result;

      return NextResponse.json({
        ok: true,
        allowed:
          Boolean(row?.allowed),
        used:
          Number(
            row?.used_value || 0
          ),
        remaining:
          Number(
            row?.remaining_value || 0
          ),
        limit:
          Number(
            row?.limit_value ||
            limit
          ),
        window_minutes: 60,
      });
    }

    if (
      action ===
      "update_referral_status"
    ) {
      const id =
        String(body?.id || "");

      const status =
        String(
          body?.status || ""
        );

      if (!id || !status) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "id and status are required.",
          },
          { status: 400 }
        );
      }

      await supabaseRequest(
        `pi_referral_prospects?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer:
              "return=representation",
          },
          body: JSON.stringify({
            relationship_status:
              status,
            updated_at:
              new Date()
                .toISOString(),
          }),
        }
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      action ===
      "update_referral_contact"
    ) {
      const id =
        String(body?.id || "");

      if (!id) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "contact id is required.",
          },
          { status: 400 }
        );
      }

      await supabaseRequest(
        `pi_referral_contacts?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer:
              "return=representation",
          },
          body: JSON.stringify({
            selected_for_outreach:
              Boolean(
                body?.selected_for_outreach
              ),
            updated_at:
              new Date()
                .toISOString(),
          }),
        }
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      action ===
      "update_lead_status"
    ) {
      const id =
        String(body?.id || "");

      const status =
        String(
          body?.status || ""
        );

      if (!id || !status) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "id and status are required.",
          },
          { status: 400 }
        );
      }

      await supabaseRequest(
        `pi_leads?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer:
              "return=representation",
          },
          body: JSON.stringify({
            status,
            updated_at:
              new Date()
                .toISOString(),
          }),
        }
      );

      return NextResponse.json({
        ok: true,
      });
    }

    if (
      action ===
      "bulk_upsert_referrals"
    ) {
      const rows =
        Array.isArray(body?.rows)
          ? body.rows
          : [];

      if (!rows.length) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "rows are required.",
          },
          { status: 400 }
        );
      }

      const normalized =
        rows.map(
          (payload: any) => ({
            organization_name:
              String(
                payload.organization_name ||
                ""
              ),

            contact_name:
              String(
                payload.contact_name ||
                ""
              ),

            category:
              String(
                payload.category ||
                ""
              ),

            practice_area:
              String(
                payload.practice_area ||
                ""
              ),

            city:
              String(
                payload.city || ""
              ),

            state:
              String(
                payload.state || "FL"
              ),

            website:
              String(
                payload.website || ""
              ),

            email:
              String(
                payload.email || ""
              ),

            phone:
              String(
                payload.phone || ""
              ),

            why_fit:
              String(
                payload.why_fit || ""
              ),

            source_url:
              String(
                payload.source_url ||
                ""
              ),

            apollo_organization_id:
              String(
                payload.apollo_organization_id ||
                ""
              ),

            organization_domain:
              String(
                payload.organization_domain ||
                ""
              ),

            relationship_status:
              String(
                payload.relationship_status ||
                "new"
              ),

            score:
              Math.max(
                0,
                Math.min(
                  100,
                  Number(
                    payload.score || 0
                  )
                )
              ),

            metadata:
              payload.metadata &&
              typeof payload.metadata ===
                "object"
                ? payload.metadata
                : {},

            updated_at:
              new Date()
                .toISOString(),
          })
        );

      const prospects =
        await supabaseRequest(
          "pi_referral_prospects?on_conflict=organization_name,city,state",
          {
            method: "POST",
            headers: {
              Prefer:
                "resolution=merge-duplicates,return=representation",
            },
            body:
              JSON.stringify(
                normalized
              ),
          }
        );

      const returnedProspects =
        Array.isArray(prospects)
          ? prospects
          : [];

      const contactRows: any[] =
        [];

      for (
        let i = 0;
        i < rows.length;
        i++
      ) {
        const source =
          rows[i] || {};

        const prospect =
          returnedProspects.find(
            (candidate: any) =>
              String(
                candidate.organization_name ||
                ""
              )
                .trim()
                .toLowerCase() ===
                String(
                  source.organization_name ||
                  ""
                )
                  .trim()
                  .toLowerCase() &&
              String(
                candidate.city ||
                ""
              )
                .trim()
                .toLowerCase() ===
                String(
                  source.city || ""
                )
                  .trim()
                  .toLowerCase() &&
              String(
                candidate.state ||
                ""
              )
                .trim()
                .toLowerCase() ===
                String(
                  source.state || "FL"
                )
                  .trim()
                  .toLowerCase()
          );

        if (
          !prospect ||
          !Array.isArray(
            source.contacts
          )
        ) {
          continue;
        }

        for (
          let c = 0;
          c <
          source.contacts.length;
          c++
        ) {
          const contact =
            source.contacts[c] ||
            {};

          const apolloPersonId =
            String(
              contact.apollo_person_id ||
              contact.id ||
              ""
            ).trim();

          if (!apolloPersonId) {
            continue;
          }

          contactRows.push({
            prospect_id:
              prospect.id,

            apollo_person_id:
              apolloPersonId,

            first_name:
              String(
                contact.first_name ||
                ""
              ),

            last_name:
              String(
                contact.last_name ||
                ""
              ),

            full_name:
              String(
                contact.full_name ||
                [
                  contact.first_name,
                  contact.last_name,
                ]
                  .filter(Boolean)
                  .join(" ")
              ),

            title:
              String(
                contact.title || ""
              ),

            seniority:
              String(
                contact.seniority ||
                ""
              ),

            email:
              String(
                contact.email || ""
              ),

            phone:
              String(
                contact.phone || ""
              ),

            linkedin_url:
              String(
                contact.linkedin_url ||
                ""
              ),

            priority:
              Math.max(
                1,
                Math.min(
                  99,
                  Number(
                    contact.priority ||
                    c + 1
                  )
                )
              ),

            selected_for_outreach:
              Boolean(
                contact.selected_for_outreach
              ),

            enrichment_status:
              String(
                contact.enrichment_status ||
                "search_only"
              ),

            email_status:
              String(
                contact.email_status ||
                ""
              ),

            metadata:
              contact.metadata &&
              typeof contact.metadata ===
                "object"
                ? contact.metadata
                : {},

            updated_at:
              new Date()
                .toISOString(),
          });
        }
      }

      let contacts: any[] =
        [];

      if (
        contactRows.length
      ) {
        const saved =
          await supabaseRequest(
            "pi_referral_contacts?on_conflict=prospect_id,apollo_person_id",
            {
              method: "POST",
              headers: {
                Prefer:
                  "resolution=merge-duplicates,return=representation",
              },
              body:
                JSON.stringify(
                  contactRows
                ),
            }
          );

        contacts =
          Array.isArray(saved)
            ? saved
            : [];
      }

      return NextResponse.json({
        ok: true,
        rows:
          returnedProspects,
        contacts,
      });
    }

    if (
      action ===
      "bulk_upsert_referral_contacts"
    ) {
      const rows =
        Array.isArray(body?.rows)
          ? body.rows
          : [];

      if (!rows.length) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "rows are required.",
          },
          { status: 400 }
        );
      }

      const saved =
        await supabaseRequest(
          "pi_referral_contacts?on_conflict=prospect_id,apollo_person_id",
          {
            method: "POST",
            headers: {
              Prefer:
                "resolution=merge-duplicates,return=representation",
            },
            body:
              JSON.stringify(rows),
          }
        );

      return NextResponse.json({
        ok: true,
        rows:
          Array.isArray(saved)
            ? saved
            : [],
      });
    }

    if (
      action ===
      "create_outreach_event"
    ) {
      const payload =
        body?.payload || {};

      const row =
        await supabaseRequest(
          "pi_outreach_events",
          {
            method: "POST",
            headers: {
              Prefer:
                "return=representation",
            },
            body: JSON.stringify({
              referral_prospect_id:
                payload.referral_prospect_id ||
                null,

              channel:
                String(
                  payload.channel || ""
                ),

              direction:
                String(
                  payload.direction ||
                  "outbound"
                ),

              status:
                String(
                  payload.status ||
                  "draft"
                ),

              subject:
                String(
                  payload.subject || ""
                ),

              message_summary:
                String(
                  payload.message_summary ||
                  ""
                ),

              approved_by:
                String(
                  payload.approved_by ||
                  ""
                ),

              approved_at:
                payload.approved_at ||
                null,

              occurred_at:
                payload.occurred_at ||
                null,

              next_follow_up_at:
                payload.next_follow_up_at ||
                null,

              metadata:
                payload.metadata &&
                typeof payload.metadata ===
                  "object"
                  ? payload.metadata
                  : {},
            }),
          }
        );

      return NextResponse.json({
        ok: true,
        row,
      });
    }

    if (
      action ===
      "create_compliance_review"
    ) {
      const payload =
        body?.payload || {};

      const row =
        await supabaseRequest(
          "pi_compliance_reviews",
          {
            method: "POST",
            headers: {
              Prefer:
                "return=representation",
            },
            body: JSON.stringify({
              review_type:
                String(
                  payload.review_type ||
                  ""
                ),

              subject_type:
                String(
                  payload.subject_type ||
                  ""
                ),

              subject_id:
                String(
                  payload.subject_id ||
                  ""
                ),

              status:
                String(
                  payload.status ||
                  "needs_review"
                ),

              notes:
                String(
                  payload.notes || ""
                ),

              reviewed_by:
                String(
                  payload.reviewed_by ||
                  ""
                ),

              reviewed_at:
                payload.reviewed_at ||
                null,

              metadata:
                payload.metadata &&
                typeof payload.metadata ===
                  "object"
                  ? payload.metadata
                  : {},
            }),
          }
        );

      return NextResponse.json({
        ok: true,
        row,
      });
    }

    if (
      action ===
      "upsert_campaigns"
    ) {
      const rows =
        Array.isArray(body?.rows)
          ? body.rows
          : [];

      if (!rows.length) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "rows are required.",
          },
          { status: 400 }
        );
      }

      const normalized =
        rows.map(
          (payload: any) => ({
            name:
              String(
                payload.name || ""
              ),

            channel:
              String(
                payload.channel || ""
              ),

            status:
              String(
                payload.status ||
                "draft"
              ),

            leads:
              Number(
                payload.leads || 0
              ),

            consults:
              Number(
                payload.consults || 0
              ),

            signed:
              Number(
                payload.signed || 0
              ),

            spend:
              Number(
                payload.spend || 0
              ),

            notes:
              String(
                payload.notes || ""
              ),

            metadata:
              payload.metadata &&
              typeof payload.metadata ===
                "object"
                ? payload.metadata
                : {},

            updated_at:
              new Date()
                .toISOString(),
          })
        );

      const result =
        await supabaseRequest(
          "pi_campaigns?on_conflict=name,channel",
          {
            method: "POST",
            headers: {
              Prefer:
                "resolution=merge-duplicates,return=representation",
            },
            body:
              JSON.stringify(
                normalized
              ),
          }
        );

      return NextResponse.json({
        ok: true,
        rows:
          Array.isArray(result)
            ? result
            : [],
      });
    }

    if (
      action ===
      "create_lead"
    ) {
      const payload =
        body?.payload || {};

      const row =
        await supabaseRequest(
          "pi_leads",
          {
            method: "POST",
            headers: {
              Prefer:
                "return=representation",
            },
            body: JSON.stringify({
              name:
                String(
                  payload.name || ""
                ),

              source:
                String(
                  payload.source || ""
                ),

              accident_type:
                String(
                  payload.accident_type ||
                  ""
                ),

              city:
                String(
                  payload.city || ""
                ),

              state:
                String(
                  payload.state || "FL"
                ),

              phone:
                String(
                  payload.phone || ""
                ),

              email:
                String(
                  payload.email || ""
                ),

              summary:
                String(
                  payload.summary || ""
                ),

              urgency:
                String(
                  payload.urgency ||
                  "medium"
                ),

              status:
                String(
                  payload.status || "new"
                ),

              metadata:
                payload.metadata &&
                typeof payload.metadata ===
                  "object"
                  ? payload.metadata
                  : {},
            }),
          }
        );

      return NextResponse.json({
        ok: true,
        row,
      });
    }

    if (
      action ===
      "get_incident_for_research"
    ) {
      const incidentId = String(body?.incident_id || body?.incidentId || "").trim();
      if (!incidentId) {
        return NextResponse.json({ ok: false, error: "incident_id is required." }, { status: 400 });
      }

      const [incidents, intelligence, people] = await Promise.all([
        supabaseRequest(`pi_incident_watch?id=eq.${encodeURIComponent(incidentId)}&select=*&limit=1`),
        supabaseRequest(`pi_incident_intelligence?incident_id=eq.${encodeURIComponent(incidentId)}&select=*&limit=1`),
        supabaseRequest(`pi_incident_people?incident_id=eq.${encodeURIComponent(incidentId)}&select=*&order=created_at.asc`),
      ]);

      const incident = Array.isArray(incidents) ? incidents[0] : null;
      if (!incident) {
        return NextResponse.json({ ok: false, error: "Incident not found." }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        incident,
        intelligence: Array.isArray(intelligence) ? intelligence[0] || null : null,
        people: Array.isArray(people) ? people : [],
      });
    }

    if (
      action ===
      "upsert_incident_intelligence"
    ) {
      const payload = body?.row && typeof body.row === "object" ? body.row : body;
      const incidentId = String(payload?.incident_id || "").trim();
      if (!incidentId) {
        return NextResponse.json({ ok: false, error: "incident_id is required." }, { status: 400 });
      }

      const normalized = {
        incident_id: incidentId,
        investigating_agency: String(payload.investigating_agency || ""),
        agency_case_number: String(payload.agency_case_number || ""),
        crash_report_number: String(payload.crash_report_number || ""),
        report_filed_at: payload.report_filed_at || null,
        report_public_at: payload.report_public_at || null,
        vehicle_count: payload.vehicle_count ?? null,
        injury_count: payload.injury_count ?? null,
        serious_injury_count: payload.serious_injury_count ?? null,
        fatality_count: payload.fatality_count ?? null,
        commercial_vehicle: payload.commercial_vehicle ?? null,
        pedestrian_involved: payload.pedestrian_involved ?? null,
        motorcycle_involved: payload.motorcycle_involved ?? null,
        bicycle_involved: payload.bicycle_involved ?? null,
        identity_status: String(payload.identity_status || "not_researched"),
        report_status: String(payload.report_status || "unknown"),
        research_status: String(payload.research_status || "pending"),
        contact_count: Math.max(0, Number(payload.contact_count || 0)),
        research_score: Math.max(0, Math.min(100, Number(payload.research_score || 0))),
        source_urls: Array.isArray(payload.source_urls) ? payload.source_urls : [],
        metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
        researched_at: payload.researched_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await supabaseRequest(
        "pi_incident_intelligence?on_conflict=incident_id",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify([normalized]),
        }
      );

      return NextResponse.json({ ok: true, rows: Array.isArray(result) ? result : [] });
    }

    if (
      action ===
      "bulk_upsert_incident_people"
    ) {
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      if (!rows.length) {
        return NextResponse.json({ ok: true, rows: [] });
      }

      const normalized = rows
        .filter((payload: any) => payload?.incident_id && payload?.name)
        .map((payload: any) => ({
          incident_id: String(payload.incident_id),
          role: String(payload.role || "unknown"),
          name: String(payload.name || ""),
          phone: String(payload.phone || ""),
          email: String(payload.email || ""),
          mailing_address: String(payload.mailing_address || ""),
          identity_source: String(payload.identity_source || ""),
          contact_source: String(payload.contact_source || ""),
          source_available_at: payload.source_available_at || null,
          represented_status: String(payload.represented_status || "unknown"),
          outreach_status: String(payload.outreach_status || "blocked"),
          metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
          updated_at: new Date().toISOString(),
        }));

      if (!normalized.length) return NextResponse.json({ ok: true, rows: [] });

      const result = await supabaseRequest(
        "pi_incident_people?on_conflict=incident_id,role,name",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify(normalized),
        }
      );

      return NextResponse.json({ ok: true, rows: Array.isArray(result) ? result : [] });
    }

    if (
      action ===
      "bulk_upsert_incidents"
    ) {
      const rows =
        Array.isArray(body?.rows)
          ? body.rows
          : [];

      if (!rows.length) {
        return NextResponse.json(
          { ok: false, error: "rows are required." },
          { status: 400 }
        );
      }

      const normalized =
        rows.map((payload: any) => ({
          source: String(payload.source || ""),
          external_id: String(payload.external_id || ""),
          incident_type: String(payload.incident_type || ""),
          county: String(payload.county || ""),
          location: String(payload.location || ""),
          occurred_at:
            payload.occurred_at ||
            new Date().toISOString(),
          report_filed_at:
            payload.report_filed_at ||
            null,
          source_url: String(payload.source_url || ""),
          severity: String(payload.severity || ""),
          identity_source: String(payload.identity_source || ""),
          identity_available: Boolean(payload.identity_available),
          solicitation_eligible_at:
            payload.solicitation_eligible_at ||
            null,
          crash_report_public_at:
            payload.crash_report_public_at ||
            null,
          earliest_contact_review_at:
            payload.earliest_contact_review_at ||
            null,
          status: String(payload.status || "observed"),
          notes: String(payload.notes || ""),
          metadata:
            payload.metadata &&
            typeof payload.metadata === "object"
              ? payload.metadata
              : {},
          updated_at: new Date().toISOString(),
        }));

      const result =
        await supabaseRequest(
          "pi_incident_watch?on_conflict=source,external_id",
          {
            method: "POST",
            headers: {
              Prefer:
                "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify(normalized),
          }
        );

      return NextResponse.json({
        ok: true,
        rows: Array.isArray(result) ? result : [],
      });
    }

    if (
      action ===
      "bulk_upsert_opportunities"
    ) {
      const rows =
        Array.isArray(body?.rows)
          ? body.rows
          : [];

      if (!rows.length) {
        return NextResponse.json(
          { ok: false, error: "rows are required." },
          { status: 400 }
        );
      }

      const normalized =
        rows.map((payload: any) => ({
          agent_id: String(payload.agent_id || ""),
          kind: String(payload.kind || ""),
          title: String(payload.title || ""),
          geography: String(payload.geography || "Florida"),
          summary: String(payload.summary || ""),
          score: Math.max(
            0,
            Math.min(100, Number(payload.score || 0))
          ),
          status: String(payload.status || "new"),
          source_url: String(payload.source_url || ""),
          metadata:
            payload.metadata &&
            typeof payload.metadata === "object"
              ? payload.metadata
              : {},
          updated_at: new Date().toISOString(),
        }));

      const result =
        await supabaseRequest(
          "pi_market_opportunities?on_conflict=agent_id,kind,title,geography",
          {
            method: "POST",
            headers: {
              Prefer:
                "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify(normalized),
          }
        );

      return NextResponse.json({
        ok: true,
        rows: Array.isArray(result) ? result : [],
      });
    }

    if (
      action ===
      "update_incident_source"
    ) {
      const sourceKey =
        String(body?.source_key || "").trim();

      if (!sourceKey) {
        return NextResponse.json(
          { ok: false, error: "source_key is required." },
          { status: 400 }
        );
      }

      const patch: Record<string, any> = {
        last_checked_at:
          body.last_checked_at ||
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      };

      if ("status" in body) {
        patch.status =
          String(body.status || "");
      }

      if ("last_success_at" in body) {
        patch.last_success_at =
          body.last_success_at || null;
      }

      if ("last_error" in body) {
        patch.last_error =
          body.last_error || null;
      }

      if (
        body.metadata &&
        typeof body.metadata === "object"
      ) {
        patch.metadata =
          body.metadata;
      }

      const result =
        await supabaseRequest(
          `pi_incident_sources?source_key=eq.${encodeURIComponent(sourceKey)}`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=representation",
            },
            body: JSON.stringify(patch),
          }
        );

      return NextResponse.json({
        ok: true,
        rows: Array.isArray(result) ? result : [],
      });
    }


    if (
      action ===
      "create_report_research_task"
    ) {
      const incidentId = String(
        body?.incident_id ||
        body?.incidentId ||
        ""
      ).trim();

      if (!incidentId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "incident_id is required.",
          },
          { status: 400 }
        );
      }

      const intelligenceId =
        String(
          body?.intelligence_id ||
          body?.intelligenceId ||
          ""
        ).trim() || null;

      const agentId =
        String(
          body?.agent_id ||
          body?.agentId ||
          "pulse"
        ).trim() || "pulse";

      const taskType =
        String(
          body?.task_type ||
          body?.taskType ||
          "official_crash_report_lookup"
        ).trim() ||
        "official_crash_report_lookup";

      const identifiers =
        body?.identifiers &&
        typeof body.identifiers ===
          "object" &&
        !Array.isArray(body.identifiers)
          ? body.identifiers
          : {};

      const fingerprint =
        body?.fingerprint &&
        typeof body.fingerprint ===
          "object" &&
        !Array.isArray(body.fingerprint)
          ? body.fingerprint
          : {};

      const portal =
        body?.portal &&
        typeof body.portal ===
          "object" &&
        !Array.isArray(body.portal)
          ? body.portal
          : {};

      const verificationRules =
        body?.verification_rules &&
        typeof body.verification_rules ===
          "object" &&
        !Array.isArray(
          body.verification_rules
        )
          ? body.verification_rules
          : {};

      const researchContext =
        body?.research_context &&
        typeof body.research_context ===
          "object" &&
        !Array.isArray(
          body.research_context
        )
          ? body.research_context
          : {};

      const requestedFields =
        Array.isArray(
          body?.requested_fields
        )
          ? body.requested_fields
          : [];

      const normalized = {
        incident_id: incidentId,
        intelligence_id:
          intelligenceId,
        agent_id: agentId,
        task_type: taskType,
        provider: String(
          body?.provider || ""
        ),
        status:
          String(
            body?.status ||
            "ready_for_official_lookup"
          ) ||
          "ready_for_official_lookup",
        priority:
          String(
            body?.priority ||
            "normal"
          ) || "normal",
        identifiers,
        fingerprint,
        portal,
        requested_fields:
          requestedFields,
        verification_rules:
          verificationRules,
        research_context:
          researchContext,
        next_action: String(
          body?.next_action || ""
        ),
        updated_at:
          new Date().toISOString(),
      };

      const result =
        await supabaseRequest(
          "pi_report_research_tasks?on_conflict=incident_id,task_type",
          {
            method: "POST",
            headers: {
              Prefer:
                "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify([
              normalized,
            ]),
          }
        );

      return NextResponse.json({
        ok: true,
        action:
          "create_report_research_task",
        rows: Array.isArray(result)
          ? result
          : [],
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          `Unsupported PI workspace action: ${action}`,
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update PI workspace.",
      },
      { status: 500 }
    );
  }
}

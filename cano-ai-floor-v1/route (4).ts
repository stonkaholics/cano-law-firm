import { NextRequest, NextResponse } from "next/server";
import { resolveFederalJurisdiction } from "../../../../lib/legal/jurisdiction";

type AuthorityResult = {
  kind: "case" | "statute" | "constitution" | "regulation" | "official_source";
  title: string;
  citation?: string | null;
  court?: string | null;
  date?: string | null;
  url: string;
  sourceProvider: string;
  sourceText?: string | null;
  snippet?: string | null;
  precedentialStatus?: string | null;
  validationStatus:
    | "source_text_verified"
    | "metadata_verified"
    | "official_source"
    | "needs_review";
  citatorStatus: "needs_citator_review";
};

function stripHtml(value: string) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max = 7000) {
  const clean = stripHtml(value);
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function buildCaseQueries(agentId: string, input: any) {
  const text = JSON.stringify(input || {}).toLowerCase();
  const q: string[] = [];

  if (agentId === "habeas" || agentId === "research") {
    q.push(
      '"immigration detention" habeas "28 U.S.C. 2241"',
      '"immigration detention" "due process" prolonged detention',
      '"immigration detention" "final order of removal" habeas'
    );
  }

  if (agentId === "bond" || agentId === "research") {
    q.push(
      '"immigration detention" "bond hearing" due process',
      '"immigration bond" dangerousness flight risk detention'
    );
  }

  if (/(u visa|u-visa|u status)/.test(text)) {
    q.push('"U visa" immigration detention', '"U nonimmigrant status" detention removal');
  }
  if (text.includes("i-485")) {
    q.push('"I-485" immigration detention removal order', '"adjustment of status" detention removal order');
  }
  if (text.includes("reopen")) {
    q.push('"motion to reopen" "removal order" detention habeas');
  }
  if (/(removal order|deportation order)/.test(text)) {
    q.push('"removal order" immigration detention habeas due process');
  }

  if (!q.length) q.push('"immigration detention" due process', '"immigration detention" habeas');
  return [...new Set(q)].slice(0, 7);
}

function buildOfficialQueries(agentId: string, input: any) {
  const text = JSON.stringify(input || {}).toLowerCase();
  const q = [
    "immigration detention habeas United States Code",
    "immigration detention due process Constitution"
  ];

  if (agentId === "habeas") {
    q.push(
      "28 USC 2241 habeas immigration detention",
      "Due Process Clause immigration detention Constitution Annotated"
    );
  }
  if (agentId === "bond") {
    q.push(
      "immigration detention bond hearing United States Code",
      "immigration detention bond regulations eCFR"
    );
  }
  if (text.includes("removal order")) {
    q.push("detention after removal order United States Code immigration");
  }
  if (/(u visa|u-visa)/.test(text)) {
    q.push("U nonimmigrant status United States Code");
  }

  return [...new Set(q)].slice(0, 6);
}

async function courtListenerSearch(
  query: string,
  courtIds: string[],
  token: string
): Promise<AuthorityResult[]> {
  const params = new URLSearchParams({
    q: query,
    type: "o",
    order_by: "score desc"
  });
  if (courtIds.length) params.set("court", courtIds.join(","));

  const res = await fetch(
    `https://www.courtlistener.com/api/rest/v4/search/?${params.toString()}`,
    {
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    }
  );

  if (!res.ok) {
    throw new Error(`CourtListener search ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results.slice(0, 6) : [];
  const out: AuthorityResult[] = [];

  for (const item of results) {
    const absoluteUrl = item?.absolute_url || item?.absoluteUrl || item?.url || "";
    const url = absoluteUrl
      ? absoluteUrl.startsWith("http")
        ? absoluteUrl
        : `https://www.courtlistener.com${absoluteUrl}`
      : "https://www.courtlistener.com/";

    const caseName =
      item?.caseName || item?.case_name || item?.caption || item?.name || "Case law result";

    const citations = Array.isArray(item?.citation)
      ? item.citation.join("; ")
      : Array.isArray(item?.citations)
      ? item.citations.join("; ")
      : item?.citation || item?.cite || null;

    const opinionIds: number[] = [];
    if (Array.isArray(item?.opinions)) {
      for (const opinion of item.opinions) {
        const id = typeof opinion === "number" ? opinion : Number(opinion?.id);
        if (Number.isFinite(id)) opinionIds.push(id);
      }
    }

    let sourceText = "";
    let validationStatus: AuthorityResult["validationStatus"] = "metadata_verified";

    if (opinionIds[0]) {
      try {
        const opinionRes = await fetch(
          `https://www.courtlistener.com/api/rest/v4/opinions/${opinionIds[0]}/`,
          {
            headers: {
              Authorization: `Token ${token}`,
              Accept: "application/json"
            },
            cache: "no-store"
          }
        );

        if (opinionRes.ok) {
          const opinion = await opinionRes.json();
          sourceText = truncate(
            opinion?.html_with_citations || opinion?.html || opinion?.plain_text || "",
            8000
          );
          if (sourceText) validationStatus = "source_text_verified";
        }
      } catch {}
    }

    out.push({
      kind: "case",
      title: String(caseName),
      citation: citations ? String(citations) : null,
      court: item?.court ? String(item.court) : null,
      date: item?.dateFiled || item?.date_filed || item?.dateCreated || null,
      url,
      sourceProvider: "CourtListener",
      sourceText: sourceText || null,
      snippet: truncate(item?.snippet || "", 1400) || null,
      precedentialStatus: item?.status || item?.status_exact || null,
      validationStatus,
      citatorStatus: "needs_citator_review"
    });
  }

  return out;
}

async function tavilyOfficialSearch(
  query: string,
  apiKey: string
): Promise<AuthorityResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 5,
      include_raw_content: true,
      include_domains: [
        "uscode.house.gov",
        "constitution.congress.gov",
        "ecfr.gov",
        "govinfo.gov"
      ]
    }),
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Official-source search ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results.slice(0, 5) : [];

  return results.map((item: any) => {
    let host = "";
    try { host = new URL(item.url).hostname; } catch {}

    const kind: AuthorityResult["kind"] =
      host.includes("constitution.congress.gov")
        ? "constitution"
        : host.includes("ecfr.gov")
        ? "regulation"
        : host.includes("uscode.house.gov") || host.includes("govinfo.gov")
        ? "statute"
        : "official_source";

    return {
      kind,
      title: String(item.title || "Official legal source"),
      citation: null,
      court: null,
      date: null,
      url: String(item.url || ""),
      sourceProvider: "Official source via Tavily retrieval",
      sourceText: truncate(item.raw_content || item.content || "", 6500),
      snippet: truncate(item.content || "", 1200),
      precedentialStatus: null,
      validationStatus: "official_source",
      citatorStatus: "needs_citator_review"
    };
  });
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.N8N_SHARED_SECRET;
  const receivedSecret = request.headers.get("x-cano-secret") || "";

  if (expectedSecret && receivedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok:false, error:"Unauthorized legal-authority research request." },
      { status:401 }
    );
  }

  const body = await request.json();
  const agentId = String(body?.agentId || "research");
  const input = body?.input || body?.matter || {};

  const jurisdiction = resolveFederalJurisdiction(input);

  const courtIds = [
    "scotus",
    jurisdiction.circuitId,
    jurisdiction.districtId
  ].filter(Boolean) as string[];

  const caseQueries = buildCaseQueries(agentId, input);
  const officialQueries = buildOfficialQueries(agentId, input);

  const warnings: string[] = [];
  const cases: AuthorityResult[] = [];
  const official: AuthorityResult[] = [];

  const courtListenerToken = process.env.COURTLISTENER_API_TOKEN || "";
  if (!courtListenerToken) {
    warnings.push("COURTLISTENER_API_TOKEN is not configured. Case-law search was skipped.");
  } else {
    for (const query of caseQueries.slice(0, 5)) {
      try {
        cases.push(...await courtListenerSearch(query, courtIds, courtListenerToken));
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "CourtListener search failed.");
      }
    }
  }

  const tavilyKey = process.env.TAVILY_API_KEY || "";
  if (!tavilyKey) {
    warnings.push(
      "TAVILY_API_KEY is not configured. Current official U.S. Code / Constitution / eCFR source retrieval was skipped."
    );
  } else {
    for (const query of officialQueries.slice(0, 4)) {
      try {
        official.push(...await tavilyOfficialSearch(query, tavilyKey));
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : "Official-source search failed.");
      }
    }
  }

  const dedupe = (items: AuthorityResult[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.title}|${item.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return NextResponse.json({
    ok:true,
    researchedAt:new Date().toISOString(),
    agentId,
    jurisdiction,
    courtIds,
    caseQueries,
    officialQueries,
    caseLaw:dedupe(cases).slice(0,12),
    officialSources:dedupe(official).slice(0,10),
    validationRules:{
      sourceTextVerified:"Retrieved opinion/source text was available to the model.",
      metadataVerified:"Case metadata/search result was retrieved but full opinion text was not loaded.",
      officialSource:"Content was retrieved from an official federal legal-source domain.",
      citator:"CourtListener and official-source retrieval do NOT replace Shepard's, KeyCite, or attorney citator review. Every authority must be checked for subsequent negative treatment before filing."
    },
    warnings
  });
}

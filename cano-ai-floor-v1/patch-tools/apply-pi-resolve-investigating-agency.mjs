import fs from "node:fs";
import path from "node:path";

const target = path.join(
  process.cwd(),
  "app",
  "api",
  "pi",
  "workspace",
  "route.ts"
);

if (!fs.existsSync(target)) {
  throw new Error(
    `PI agency resolver patch: target not found: ${target}`
  );
}

let source = fs.readFileSync(target, "utf8");

if (
  source.includes(
    '"resolve_investigating_agency"'
  )
) {
  console.log(
    "PI agency resolver patch: already applied"
  );
  process.exit(0);
}

const anchor = `    if (
      action ===
      "create_report_research_task"
    ) {`;

if (!source.includes(anchor)) {
  throw new Error(
    "PI agency resolver patch: create_report_research_task anchor not found"
  );
}

const block = `    if (
      action ===
      "resolve_investigating_agency"
    ) {
      const incomingTask =
        body?.task &&
        typeof body.task === "object" &&
        !Array.isArray(body.task)
          ? body.task
          : {};

      const taskId = String(
        incomingTask?.task_id ||
          incomingTask?.id ||
          body?.task_id ||
          body?.taskId ||
          ""
      ).trim();

      const requestedIncidentId = String(
        incomingTask?.incident_id ||
          body?.incident_id ||
          body?.incidentId ||
          ""
      ).trim();

      if (!taskId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "resolve_investigating_agency: task_id is required.",
          },
          { status: 400 }
        );
      }

      const taskRows =
        await supabaseRequest(
          \`pi_report_research_tasks?id=eq.\${encodeURIComponent(
            taskId
          )}&select=*\`,
          {
            method: "GET",
          }
        );

      const storedTask =
        Array.isArray(taskRows)
          ? taskRows[0]
          : null;

      if (!storedTask) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "resolve_investigating_agency: report research task not found.",
          },
          { status: 404 }
        );
      }

      const canonicalIncidentId =
        requestedIncidentId ||
        String(
          storedTask?.incident_id ||
            ""
        ).trim();

      const storedFingerprint =
        storedTask?.fingerprint &&
        typeof storedTask.fingerprint ===
          "object" &&
        !Array.isArray(
          storedTask.fingerprint
        )
          ? storedTask.fingerprint
          : {};

      const incomingFingerprint =
        incomingTask?.fingerprint &&
        typeof incomingTask.fingerprint ===
          "object" &&
        !Array.isArray(
          incomingTask.fingerprint
        )
          ? incomingTask.fingerprint
          : {};

      const fingerprint = {
        ...storedFingerprint,
        ...incomingFingerprint,
      };

      const storedResearchContext =
        storedTask?.research_context &&
        typeof storedTask.research_context ===
          "object" &&
        !Array.isArray(
          storedTask.research_context
        )
          ? storedTask.research_context
          : {};

      const incomingResearchContext =
        incomingTask?.research_context &&
        typeof incomingTask.research_context ===
          "object" &&
        !Array.isArray(
          incomingTask.research_context
        )
          ? incomingTask.research_context
          : {};

      const researchContext = {
        ...storedResearchContext,
        ...incomingResearchContext,
      };

      const county = String(
        incomingTask?.county ||
          fingerprint?.county ||
          researchContext?.county ||
          ""
      ).trim();

      const location = String(
        incomingTask?.location ||
          fingerprint?.location ||
          researchContext?.location ||
          ""
      ).trim();

      const crashDate = String(
        incomingTask?.crash_date ||
          fingerprint?.crash_date ||
          ""
      ).trim();

      const occurredAt =
        incomingTask?.occurred_at ||
        fingerprint?.occurred_at ||
        researchContext?.occurred_at ||
        null;

      const discoverySource = String(
        incomingTask?.discovery_source ||
          researchContext?.discovery_source ||
          ""
      ).trim();

      const discoverySourceKey = String(
        researchContext
          ?.discovery_source_key ||
          ""
      ).trim();

      const discoverySourceUrl = String(
        researchContext
          ?.discovery_source_url ||
          storedTask?.portal
            ?.verified_event_source ||
          ""
      ).trim();

      const existingAgency = String(
        fingerprint?.agency ||
          ""
      ).trim();

      const strategy = String(
        researchContext?.strategy ||
          ""
      ).trim();

      const combinedSourceText = [
        discoverySource,
        discoverySourceKey,
        discoverySourceUrl,
      ]
        .join(" ")
        .toLowerCase();

      const locationUpper =
        location.toUpperCase();

      let resolved = false;
      let investigatingAgency = "";
      let agencyType = "unknown";
      let confidence = 0;
      let resolutionType = "unresolved";

      let reason =
        "No event-specific official source has verified the investigating agency.";

      const candidateAgencies: any[] =
        [];

      const evidence: any[] =
        [];

      const priorAgencyVerified =
        researchContext
          ?.investigating_agency_verified ===
          true ||
        researchContext
          ?.agency_verified ===
          true;

      if (
        existingAgency &&
        priorAgencyVerified
      ) {
        resolved = true;
        investigatingAgency =
          existingAgency;
        agencyType =
          "verified_existing_agency";
        confidence = 1;
        resolutionType =
          "existing_verified_task_agency";
        reason =
          "The canonical report research task already contains an explicitly verified investigating agency.";

        evidence.push({
          type:
            "existing_verified_task_field",
          field:
            "fingerprint.agency",
          value:
            existingAgency,
        });
      }

      const explicitFhpSource =
        combinedSourceText.includes(
          "florida highway patrol live"
        ) ||
        combinedSourceText.includes(
          "fhp_south_florida"
        ) ||
        combinedSourceText.includes(
          "trafficincidents.flhsmv.gov"
        );

      if (
        !resolved &&
        explicitFhpSource
      ) {
        resolved = true;
        investigatingAgency =
          "Florida Highway Patrol";
        agencyType =
          "state_patrol";
        confidence = 0.99;
        resolutionType =
          "official_event_source";
        reason =
          "The event was sourced directly from the Florida Highway Patrol live incident system.";

        evidence.push({
          type:
            "official_event_source",
          source:
            discoverySource ||
            "Florida Highway Patrol Live",
          source_key:
            discoverySourceKey,
          source_url:
            discoverySourceUrl,
        });
      }

      const looksLikeInterstate =
        /\\bI[-\\s]?\\d+\\b/i.test(
          locationUpper
        );

      const looksLikeStateRoad =
        /\\b(?:SR|STATE ROAD)[-\\s]?\\d+\\b/i.test(
          locationUpper
        );

      const looksLikeUsHighway =
        /\\b(?:US|U\\.S\\.)[-\\s]?\\d+\\b/i.test(
          locationUpper
        );

      const looksLikeTurnpike =
        locationUpper.includes(
          "TURNPIKE"
        ) ||
        locationUpper.includes(
          "TPKE"
        );

      if (
        !resolved &&
        (
          looksLikeInterstate ||
          looksLikeStateRoad ||
          looksLikeUsHighway ||
          looksLikeTurnpike
        )
      ) {
        candidateAgencies.push({
          agency:
            "Florida Highway Patrol",
          agency_type:
            "state_patrol",
          confidence:
            0.72,
          basis:
            "The event occurred on an interstate, state road, U.S. highway, or Florida Turnpike corridor. FHP is a plausible investigating agency, but roadway jurisdiction alone does not verify who investigated this specific event.",
          evidence_type:
            "jurisdictional_candidate",
        });
      }

      const sourceRequiresResolution =
        combinedSourceText.includes(
          "signal four"
        ) ||
        combinedSourceText.includes(
          "fl511"
        ) ||
        combinedSourceText.includes(
          "fort_lauderdale_fire"
        ) ||
        combinedSourceText.includes(
          "fort lauderdale fire"
        ) ||
        combinedSourceText.includes(
          "fire rescue"
        ) ||
        combinedSourceText.includes(
          "miami_dade_mdfr"
        ) ||
        combinedSourceText.includes(
          "mdfr"
        ) ||
        combinedSourceText.includes(
          "miami-dade fire"
        );

      if (
        !resolved &&
        sourceRequiresResolution
      ) {
        evidence.push({
          type:
            "discovery_source_only",
          source:
            discoverySource,
          source_key:
            discoverySourceKey,
          source_url:
            discoverySourceUrl,
          note:
            "This discovery source verifies or corroborates the event but does not by itself establish the investigating law-enforcement agency.",
        });
      }

      const normalizedCounty =
        county
          .trim()
          .toLowerCase();

      if (
        !resolved &&
        normalizedCounty ===
          "broward"
      ) {
        candidateAgencies.push({
          agency:
            "Broward Sheriff's Office",
          agency_type:
            "county_law_enforcement",
          confidence:
            0.35,
          basis:
            "County-level jurisdiction candidate only. Event-specific verification is still required.",
          evidence_type:
            "county_candidate",
        });
      }

      if (
        !resolved &&
        (
          normalizedCounty ===
            "miami-dade" ||
          normalizedCounty ===
            "miami dade"
        )
      ) {
        candidateAgencies.push({
          agency:
            "Miami-Dade Sheriff's Office",
          agency_type:
            "county_law_enforcement",
          confidence:
            0.35,
          basis:
            "County-level jurisdiction candidate only. Event-specific verification is still required.",
          evidence_type:
            "county_candidate",
        });
      }

      const uniqueCandidates =
        Array.from(
          new Map(
            candidateAgencies.map(
              (
                candidate: any
              ) => [
                String(
                  candidate?.agency ||
                    ""
                )
                  .trim()
                  .toLowerCase(),
                candidate,
              ]
            )
          ).values()
        ).filter(
          (candidate: any) =>
            Boolean(
              String(
                candidate?.agency ||
                  ""
              ).trim()
            )
        );

      const resolutionResult = {
        resolved,
        investigating_agency:
          investigatingAgency,
        agency_type:
          agencyType,
        confidence,
        resolution_type:
          resolutionType,
        reason,
        county,
        location,
        crash_date:
          crashDate,
        occurred_at:
          occurredAt,
        strategy,
        discovery_source:
          discoverySource,
        discovery_source_key:
          discoverySourceKey,
        discovery_source_url:
          discoverySourceUrl,
        candidate_agencies:
          uniqueCandidates,
        evidence,
        official_source_required:
          true,
        event_specific_verification:
          resolved,
        resolved_at:
          new Date()
            .toISOString(),
      };

      const nextStatus =
        resolved
          ? "ready_for_official_lookup"
          : "needs_agency_resolution";

      const nextProvider =
        resolved &&
        investigatingAgency ===
          "Florida Highway Patrol"
          ? "Florida Crash Portal / FLHSMV"
          : resolved
          ? "Florida Official Records"
          : "Florida Official Records - Agency Resolution";

      const nextAction =
        resolved
          ? "locate_official_crash_report"
          : "continue_agency_resolution";

      const patchedFingerprint = {
        ...fingerprint,
        agency:
          resolved
            ? investigatingAgency
            : "",
      };

      const patchedResearchContext = {
        ...researchContext,
        agency_resolution_required:
          !resolved,
        agency_resolution_attempted:
          true,
        agency_resolution_result:
          resolutionResult,
        investigating_agency_verified:
          resolved,
        agency_resolution_updated_at:
          new Date().toISOString(),
      };

      const existingResult =
        storedTask?.result &&
        typeof storedTask.result ===
          "object" &&
        !Array.isArray(
          storedTask.result
        )
          ? storedTask.result
          : {};

      const patchedResult = {
        ...existingResult,
        agency_resolution:
          resolutionResult,
        next_action:
          nextAction,
      };

      const updatedTasks =
        await supabaseRequest(
          \`pi_report_research_tasks?id=eq.\${encodeURIComponent(
            taskId
          )}\`,
          {
            method: "PATCH",
            headers: {
              Prefer:
                "return=representation",
            },
            body: JSON.stringify({
              provider:
                nextProvider,
              status:
                nextStatus,
              next_action:
                nextAction,
              fingerprint:
                patchedFingerprint,
              research_context:
                patchedResearchContext,
              result:
                patchedResult,
              updated_at:
                new Date().toISOString(),
            }),
          }
        );

      let intelligenceRows: any[] =
        [];

      if (
        resolved &&
        canonicalIncidentId
      ) {
        const existingIntelRows =
          await supabaseRequest(
            \`pi_incident_intelligence?incident_id=eq.\${encodeURIComponent(
              canonicalIncidentId
            )}&select=*\`,
            {
              method: "GET",
            }
          );

        const existingIntel =
          Array.isArray(
            existingIntelRows
          )
            ? existingIntelRows[0]
            : null;

        if (existingIntel) {
          const existingMetadata =
            existingIntel?.metadata &&
            typeof existingIntel.metadata ===
              "object" &&
            !Array.isArray(
              existingIntel.metadata
            )
              ? existingIntel.metadata
              : {};

          const savedIntel =
            await supabaseRequest(
              \`pi_incident_intelligence?incident_id=eq.\${encodeURIComponent(
                canonicalIncidentId
              )}\`,
              {
                method: "PATCH",
                headers: {
                  Prefer:
                    "return=representation",
                },
                body:
                  JSON.stringify({
                    investigating_agency:
                      investigatingAgency,
                    research_status:
                      "official_source_research_ready",
                    metadata: {
                      ...existingMetadata,
                      investigating_agency_verified:
                        true,
                      investigating_agency_source:
                        resolutionType,
                      agency_resolution:
                        resolutionResult,
                      official_lookup_requires_agency_resolution:
                        false,
                      next_action:
                        "official_report_lookup_ready",
                    },
                    researched_at:
                      new Date().toISOString(),
                    updated_at:
                      new Date().toISOString(),
                  }),
              }
            );

          intelligenceRows =
            Array.isArray(savedIntel)
              ? savedIntel
              : [];
        }
      }

      return NextResponse.json({
        ok: true,
        action:
          "resolve_investigating_agency",
        task_id:
          taskId,
        incident_id:
          canonicalIncidentId,
        resolved,
        investigating_agency:
          investigatingAgency,
        agency_type:
          agencyType,
        confidence,
        reason,
        candidate_agencies:
          uniqueCandidates,
        evidence,
        status:
          nextStatus,
        provider:
          nextProvider,
        next_action:
          nextAction,
        rows:
          Array.isArray(
            updatedTasks
          )
            ? updatedTasks
            : [],
        intelligence_rows:
          intelligenceRows,
      });
    }

`;

source = source.replace(
  anchor,
  `${block}${anchor}`
);

fs.writeFileSync(
  target,
  source,
  "utf8"
);

console.log(
  "Applied PI investigating-agency resolver API patch."
);

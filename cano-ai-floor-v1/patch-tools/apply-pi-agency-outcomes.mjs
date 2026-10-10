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
    `PI agency outcomes patch: target not found: ${target}`
  );
}

let source =
  fs.readFileSync(
    target,
    "utf8"
  );

const alreadyApplied =
  source.includes(
    '"promote_verified_agency"'
  ) &&
  source.includes(
    '"save_agency_resolution_pending"'
  ) &&
  source.includes(
    '"save_agency_resolution_no_evidence"'
  );

if (alreadyApplied) {
  console.log(
    "PI agency outcomes patch: already applied"
  );
  process.exit(0);
}

const anchor = `    if (
      action ===
      "create_report_research_task"
    ) {`;

if (!source.includes(anchor)) {
  throw new Error(
    "PI agency outcomes patch: create_report_research_task anchor not found"
  );
}

const block = `    /*
    |--------------------------------------------------------------------------
    | PI AGENCY VERIFICATION OUTCOMES
    |--------------------------------------------------------------------------
    |
    | These actions persist the three branches built in n8n:
    |
    | 1. promote_verified_agency
    | 2. save_agency_resolution_pending
    | 3. save_agency_resolution_no_evidence
    |
    | They intentionally keep a jurisdictional candidate separate from a
    | verified investigating agency.
    |
    */

    if (
      action ===
      "promote_verified_agency"
    ) {
      const taskId =
        String(
          body?.task_id ||
          body?.taskId ||
          ""
        ).trim();

      const incidentId =
        String(
          body?.incident_id ||
          body?.incidentId ||
          ""
        ).trim();

      const investigatingAgency =
        String(
          body?.investigating_agency ||
          body?.investigatingAgency ||
          ""
        ).trim();

      const agencyType =
        String(
          body?.agency_type ||
          body?.agencyType ||
          "unknown"
        ).trim() || "unknown";

      const verification =
        body?.verification &&
        typeof body.verification ===
          "object" &&
        !Array.isArray(
          body.verification
        )
          ? body.verification
          : {};

      const verifiedEvidence =
        Array.isArray(
          body?.verified_evidence
        )
          ? body.verified_evidence
          : [];

      if (!taskId) {
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error:
              "promote_verified_agency: task_id is required.",
          },
          { status: 400 }
        );
      }

      if (!investigatingAgency) {
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error:
              "promote_verified_agency: investigating_agency is required.",
          },
          { status: 400 }
        );
      }

      const verificationPassed =
        verification?.verified ===
          true &&
        verification
          ?.official_domain ===
          true &&
        verification
          ?.agency_match ===
          true &&
        verification
          ?.date_match ===
          true &&
        verification
          ?.location_match ===
          true;

      if (!verificationPassed) {
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error:
              "promote_verified_agency: event-specific verification requirements were not satisfied.",
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

      const existingTask =
        Array.isArray(taskRows)
          ? taskRows[0]
          : null;

      if (!existingTask) {
        return NextResponse.json(
          {
            ok: false,
            verified: false,
            error:
              "promote_verified_agency: report research task not found.",
          },
          { status: 404 }
        );
      }

      const canonicalIncidentId =
        incidentId ||
        String(
          existingTask?.incident_id ||
          ""
        ).trim();

      const existingFingerprint =
        existingTask?.fingerprint &&
        typeof existingTask.fingerprint ===
          "object" &&
        !Array.isArray(
          existingTask.fingerprint
        )
          ? existingTask.fingerprint
          : {};

      const existingResearchContext =
        existingTask?.research_context &&
        typeof existingTask.research_context ===
          "object" &&
        !Array.isArray(
          existingTask.research_context
        )
          ? existingTask.research_context
          : {};

      const existingResult =
        existingTask?.result &&
        typeof existingTask.result ===
          "object" &&
        !Array.isArray(
          existingTask.result
        )
          ? existingTask.result
          : {};

      const provider =
        investigatingAgency ===
          "Florida Highway Patrol"
          ? "Florida Crash Portal / FLHSMV"
          : "Florida Official Records";

      const verifiedAt =
        verification?.verified_at ||
        new Date().toISOString();

      const promotionRecord = {
        verified: true,
        investigating_agency:
          investigatingAgency,
        agency_type:
          agencyType,
        verification_confidence:
          Number(
            body?.verification_confidence ||
            0
          ),
        candidate_confidence:
          Number(
            body?.candidate_confidence ||
            0
          ),
        verification,
        verified_evidence:
          verifiedEvidence,
        promoted_at:
          verifiedAt,
      };

      const taskPatch = {
        provider,
        status:
          "ready_for_official_lookup",
        next_action:
          "locate_official_crash_report",

        fingerprint: {
          ...existingFingerprint,
          agency:
            investigatingAgency,
        },

        research_context: {
          ...existingResearchContext,

          agency_resolution_required:
            false,

          agency_resolution_attempted:
            true,

          investigating_agency_verified:
            true,

          investigating_agency:
            investigatingAgency,

          investigating_agency_type:
            agencyType,

          agency_verification:
            promotionRecord,

          agency_resolution_updated_at:
            verifiedAt,
        },

        result: {
          ...existingResult,

          agency_verification:
            promotionRecord,

          next_action:
            "locate_official_crash_report",
        },

        updated_at:
          new Date().toISOString(),
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

            body:
              JSON.stringify(
                taskPatch
              ),
          }
        );

      let intelligenceRows: any[] =
        [];

      if (
        canonicalIncidentId
      ) {
        const intelRows =
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
            intelRows
          )
            ? intelRows[0]
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

                      investigating_agency:
                        investigatingAgency,

                      investigating_agency_type:
                        agencyType,

                      agency_resolution_required:
                        false,

                      agency_verification:
                        promotionRecord,

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
            Array.isArray(
              savedIntel
            )
              ? savedIntel
              : [];
        }
      }

      return NextResponse.json({
        ok: true,
        verified: true,
        action:
          "promote_verified_agency",

        task_id:
          taskId,

        incident_id:
          canonicalIncidentId,

        investigating_agency:
          investigatingAgency,

        agency_type:
          agencyType,

        provider,

        status:
          "ready_for_official_lookup",

        next_action:
          "locate_official_crash_report",

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

    if (
      action ===
      "save_agency_resolution_pending"
    ) {
      const taskId =
        String(
          body?.task_id ||
          body?.taskId ||
          ""
        ).trim();

      const incidentId =
        String(
          body?.incident_id ||
          body?.incidentId ||
          ""
        ).trim();

      if (!taskId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "save_agency_resolution_pending: task_id is required.",
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

      const existingTask =
        Array.isArray(taskRows)
          ? taskRows[0]
          : null;

      if (!existingTask) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "save_agency_resolution_pending: report research task not found.",
          },
          { status: 404 }
        );
      }

      const canonicalIncidentId =
        incidentId ||
        String(
          existingTask?.incident_id ||
          ""
        ).trim();

      const existingFingerprint =
        existingTask?.fingerprint &&
        typeof existingTask.fingerprint ===
          "object" &&
        !Array.isArray(
          existingTask.fingerprint
        )
          ? existingTask.fingerprint
          : {};

      const existingResearchContext =
        existingTask?.research_context &&
        typeof existingTask.research_context ===
          "object" &&
        !Array.isArray(
          existingTask.research_context
        )
          ? existingTask.research_context
          : {};

      const existingResult =
        existingTask?.result &&
        typeof existingTask.result ===
          "object" &&
        !Array.isArray(
          existingTask.result
        )
          ? existingTask.result
          : {};

      const bestCandidate =
        String(
          body?.best_candidate ||
          ""
        ).trim();

      const agencyType =
        String(
          body?.agency_type ||
          "unknown"
        ).trim() || "unknown";

      const pendingRecord = {
        resolution_state:
          "unresolved",

        agency_verified:
          false,

        best_candidate:
          bestCandidate,

        agency_type:
          agencyType,

        candidate_confidence:
          Number(
            body?.candidate_confidence ||
            0
          ),

        candidate_basis:
          String(
            body?.candidate_basis ||
            ""
          ),

        best_evidence:
          body?.best_evidence ||
          null,

        official_evidence_count:
          Number(
            body?.official_evidence_count ||
            0
          ),

        total_unique_evidence:
          Number(
            body?.total_unique_evidence ||
            0
          ),

        all_unresolved_candidates:
          Array.isArray(
            body?.all_unresolved_candidates
          )
            ? body.all_unresolved_candidates
            : [],

        evidence:
          Array.isArray(
            body?.evidence
          )
            ? body.evidence
            : [],

        saved_at:
          new Date().toISOString(),
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

            body:
              JSON.stringify({
                provider:
                  "Florida Official Records - Agency Resolution",

                status:
                  "needs_agency_resolution",

                next_action:
                  "continue_agency_resolution",

                fingerprint: {
                  ...existingFingerprint,
                  agency: "",
                },

                research_context: {
                  ...existingResearchContext,

                  agency_resolution_required:
                    true,

                  investigating_agency_verified:
                    false,

                  best_agency_candidate:
                    bestCandidate,

                  best_agency_candidate_type:
                    agencyType,

                  best_agency_candidate_confidence:
                    Number(
                      body?.candidate_confidence ||
                      0
                    ),

                  agency_resolution_outcome:
                    pendingRecord,

                  agency_resolution_updated_at:
                    new Date().toISOString(),
                },

                result: {
                  ...existingResult,

                  agency_resolution_outcome:
                    pendingRecord,

                  next_action:
                    "continue_agency_resolution",
                },

                updated_at:
                  new Date().toISOString(),
              }),
          }
        );

      let intelligenceRows: any[] =
        [];

      if (
        canonicalIncidentId
      ) {
        const intelRows =
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
            intelRows
          )
            ? intelRows[0]
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
                      "",

                    research_status:
                      "agency_resolution_required",

                    metadata: {
                      ...existingMetadata,

                      investigating_agency_verified:
                        false,

                      agency_resolution_required:
                        true,

                      best_agency_candidate:
                        bestCandidate,

                      best_agency_candidate_type:
                        agencyType,

                      best_agency_candidate_confidence:
                        Number(
                          body?.candidate_confidence ||
                          0
                        ),

                      agency_resolution_outcome:
                        pendingRecord,

                      next_action:
                        "continue_agency_resolution",
                    },

                    researched_at:
                      new Date().toISOString(),

                    updated_at:
                      new Date().toISOString(),
                  }),
              }
            );

          intelligenceRows =
            Array.isArray(
              savedIntel
            )
              ? savedIntel
              : [];
        }
      }

      return NextResponse.json({
        ok: true,
        verified: false,
        action:
          "save_agency_resolution_pending",

        task_id:
          taskId,

        incident_id:
          canonicalIncidentId,

        best_candidate:
          bestCandidate,

        status:
          "needs_agency_resolution",

        provider:
          "Florida Official Records - Agency Resolution",

        next_action:
          "continue_agency_resolution",

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

    if (
      action ===
      "save_agency_resolution_no_evidence"
    ) {
      const taskId =
        String(
          body?.task_id ||
          body?.taskId ||
          ""
        ).trim();

      const incidentId =
        String(
          body?.incident_id ||
          body?.incidentId ||
          ""
        ).trim();

      if (!taskId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "save_agency_resolution_no_evidence: task_id is required.",
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

      const existingTask =
        Array.isArray(taskRows)
          ? taskRows[0]
          : null;

      if (!existingTask) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "save_agency_resolution_no_evidence: report research task not found.",
          },
          { status: 404 }
        );
      }

      const canonicalIncidentId =
        incidentId ||
        String(
          existingTask?.incident_id ||
          ""
        ).trim();

      const existingFingerprint =
        existingTask?.fingerprint &&
        typeof existingTask.fingerprint ===
          "object" &&
        !Array.isArray(
          existingTask.fingerprint
        )
          ? existingTask.fingerprint
          : {};

      const existingResearchContext =
        existingTask?.research_context &&
        typeof existingTask.research_context ===
          "object" &&
        !Array.isArray(
          existingTask.research_context
        )
          ? existingTask.research_context
          : {};

      const existingResult =
        existingTask?.result &&
        typeof existingTask.result ===
          "object" &&
        !Array.isArray(
          existingTask.result
        )
          ? existingTask.result
          : {};

      const bestCandidate =
        String(
          body?.best_candidate ||
          ""
        ).trim();

      const bestCandidateType =
        String(
          body?.best_candidate_type ||
          "unknown"
        ).trim() || "unknown";

      const candidateSummary =
        Array.isArray(
          body?.candidate_summary
        )
          ? body.candidate_summary
          : [];

      const evidenceSummary =
        body?.evidence_summary &&
        typeof body.evidence_summary ===
          "object" &&
        !Array.isArray(
          body.evidence_summary
        )
          ? body.evidence_summary
          : {};

      const noEvidenceRecord = {
        resolution_state:
          "no_evidence",

        agency_verified:
          false,

        best_candidate:
          bestCandidate,

        best_candidate_type:
          bestCandidateType,

        best_candidate_confidence:
          Number(
            body?.best_candidate_confidence ||
            0
          ),

        candidate_summary:
          candidateSummary,

        evidence_summary:
          evidenceSummary,

        saved_at:
          new Date().toISOString(),
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

            body:
              JSON.stringify({
                provider:
                  "Florida Official Records - Agency Resolution",

                status:
                  "needs_agency_resolution",

                next_action:
                  "agency_resolution_no_evidence",

                fingerprint: {
                  ...existingFingerprint,
                  agency: "",
                },

                research_context: {
                  ...existingResearchContext,

                  agency_resolution_required:
                    true,

                  investigating_agency_verified:
                    false,

                  best_agency_candidate:
                    bestCandidate,

                  best_agency_candidate_type:
                    bestCandidateType,

                  best_agency_candidate_confidence:
                    Number(
                      body?.best_candidate_confidence ||
                      0
                    ),

                  agency_resolution_outcome:
                    noEvidenceRecord,

                  agency_resolution_updated_at:
                    new Date().toISOString(),
                },

                result: {
                  ...existingResult,

                  agency_resolution_outcome:
                    noEvidenceRecord,

                  next_action:
                    "agency_resolution_no_evidence",
                },

                updated_at:
                  new Date().toISOString(),
              }),
          }
        );

      let intelligenceRows: any[] =
        [];

      if (
        canonicalIncidentId
      ) {
        const intelRows =
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
            intelRows
          )
            ? intelRows[0]
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
                      "",

                    research_status:
                      "agency_resolution_required",

                    metadata: {
                      ...existingMetadata,

                      investigating_agency_verified:
                        false,

                      agency_resolution_required:
                        true,

                      best_agency_candidate:
                        bestCandidate,

                      best_agency_candidate_type:
                        bestCandidateType,

                      best_agency_candidate_confidence:
                        Number(
                          body?.best_candidate_confidence ||
                          0
                        ),

                      agency_resolution_outcome:
                        noEvidenceRecord,

                      next_action:
                        "agency_resolution_no_evidence",
                    },

                    researched_at:
                      new Date().toISOString(),

                    updated_at:
                      new Date().toISOString(),
                  }),
              }
            );

          intelligenceRows =
            Array.isArray(
              savedIntel
            )
              ? savedIntel
              : [];
        }
      }

      return NextResponse.json({
        ok: true,
        verified: false,
        action:
          "save_agency_resolution_no_evidence",

        task_id:
          taskId,

        incident_id:
          canonicalIncidentId,

        best_candidate:
          bestCandidate,

        status:
          "needs_agency_resolution",

        provider:
          "Florida Official Records - Agency Resolution",

        next_action:
          "agency_resolution_no_evidence",

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

source =
  source.replace(
    anchor,
    `${block}${anchor}`
  );

fs.writeFileSync(
  target,
  source,
  "utf8"
);

console.log(
  "Applied PI agency outcome API actions."
);

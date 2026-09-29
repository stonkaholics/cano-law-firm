import {
  getMatterByMondayId,
  insertActivity,
  insertPipelineEvent,
  updateMatter,
} from "./matters";
import {
  SPECIALIST_AGENTS,
  SpecialistAgentId,
} from "./agents";

type PipelineDecision = {
  nextAgent: SpecialistAgentId | null;
  routeLabel: string;
  stage: string;
  reason: string;
  stopForAttorney?: boolean;
};

export function chooseAfterCaseBrain(caseBrain: any): PipelineDecision {
  const recommended =
    String(caseBrain?.routing?.recommended_specialist || "").toLowerCase();

  const practiceArea =
    String(caseBrain?.matter?.practice_area || "").toLowerCase();

  const matterType =
    String(caseBrain?.matter?.matter_type || "").toLowerCase();

  // Immigration matters run through Lex first so the primary specialist
  // receives a Case Brain record plus a structured research plan.
  if (
    practiceArea.includes("immigration") ||
    ["habeas", "bond"].includes(recommended) ||
    matterType.includes("immigration")
  ) {
    return {
      nextAgent: "research",
      routeLabel: "Lex · Research",
      stage: "research",
      reason:
        "Immigration matter: run Lex first to frame legal research questions and factual predicates before the primary detention specialist.",
    };
  }

  // For other current Cano matters, Lex is the safest first specialist
  // until practice-specific agents are added.
  return {
    nextAgent: "research",
    routeLabel: "Lex · Research",
    stage: "research",
    reason:
      "Run Lex first to frame the legal issues and identify what requires attorney-verified authority before further specialist work.",
  };
}

export function chooseAfterResearch(
  caseBrain: any,
  researchOutput: any,
  persistedRecommendation?: string | null
): PipelineDecision {
  const agentIdRecommendation = String(
    caseBrain?.agent_id || ""
  ).toLowerCase();

  const recommended = String(
    caseBrain?.routing?.recommended_specialist ||
    persistedRecommendation ||
    (["habeas", "bond", "timeline"].includes(agentIdRecommendation)
      ? agentIdRecommendation
      : "") ||
    ""
  ).toLowerCase();

  const readiness =
    String(researchOutput?.readiness?.status || "").toLowerCase();

  const blockingItems =
    Array.isArray(researchOutput?.readiness?.blocking_items)
      ? researchOutput.readiness.blocking_items
      : [];

  if (readiness === "not_ready" && blockingItems.length > 0) {
    return {
      nextAgent: null,
      routeLabel: "Attorney Review",
      stage: "attorney_review",
      reason:
        "Lex identified blocking information that should be reviewed before another specialist is started.",
      stopForAttorney: true,
    };
  }

  if (recommended === "habeas") {
    return {
      nextAgent: "habeas",
      routeLabel: "Elena · Habeas",
      stage: "habeas",
      reason:
        "Case Brain recommends habeas. Lex completed the research-framing pass, so Elena is the next specialist.",
    };
  }

  if (recommended === "bond") {
    return {
      nextAgent: "bond",
      routeLabel: "Mateo · Bond",
      stage: "bond",
      reason:
        "Case Brain recommends bond. Lex completed the research-framing pass, so Mateo is the next specialist.",
    };
  }

  if (recommended === "timeline") {
    return {
      nextAgent: "timeline",
      routeLabel: "Chronos · Timeline",
      stage: "timeline",
      reason:
        "Case Brain identifies chronology as the next major task.",
    };
  }

  return {
    nextAgent: null,
    routeLabel: "Attorney Review",
    stage: "attorney_review",
    reason:
      "Case Brain did not identify a supported primary detention specialist after Lex. Pause for attorney routing.",
    stopForAttorney: true,
  };
}

export function chooseAfterPrimarySpecialist(
  agentId: SpecialistAgentId,
  output: any
): PipelineDecision {
  const readiness =
    String(output?.readiness?.status || "").toLowerCase();

  if (readiness === "not_ready") {
    return {
      nextAgent: null,
      routeLabel: "Attorney Review",
      stage: "attorney_review",
      reason:
        `${SPECIALIST_AGENTS[agentId].name} identified blocking issues. Attorney review is required before the pipeline continues.`,
      stopForAttorney: true,
    };
  }

  return {
    nextAgent: "timeline",
    routeLabel: "Chronos · Timeline",
    stage: "timeline",
    reason:
      `${SPECIALIST_AGENTS[agentId].name} completed the primary specialist pass. Build a consolidated chronology next.`,
  };
}

export function chooseAfterTimeline(output: any): PipelineDecision {
  const readiness =
    String(output?.readiness?.status || "").toLowerCase();

  if (readiness === "not_ready") {
    return {
      nextAgent: null,
      routeLabel: "Attorney Review",
      stage: "attorney_review",
      reason:
        "Chronos found timeline conflicts or blocking chronology issues that need attorney review.",
      stopForAttorney: true,
    };
  }

  return {
    nextAgent: "hearing",
    routeLabel: "Avery · Hearing Prep",
    stage: "hearing_prep",
    reason:
      "The matter now has Case Brain, research/specialist analysis, and a chronology. Avery can synthesize the hearing-prep packet.",
  };
}

export function chooseAfterHearing(): PipelineDecision {
  return {
    nextAgent: null,
    routeLabel: "Attorney Review",
    stage: "attorney_review",
    reason:
      "Automated preparation is complete. The matter is ready for attorney review.",
    stopForAttorney: true,
  };
}

export async function recordPipelineTransition({
  mondayItemId,
  fromStage,
  decision,
}: {
  mondayItemId: string;
  fromStage?: string | null;
  decision: PipelineDecision;
}) {
  const matter = await getMatterByMondayId(mondayItemId);
  if (!matter) throw new Error("Matter not found for pipeline transition.");

  await updateMatter(matter.id, {
    pipeline_status: decision.stopForAttorney ? "paused" : "running",
    pipeline_stage: decision.stage,
    pipeline_next_agent: decision.nextAgent,
    current_route: decision.routeLabel,
    routed_by: "Santiago Auto-Pipeline",
    routed_at: new Date().toISOString(),
  });

  await insertPipelineEvent({
    matter_id: matter.id,
    monday_item_id: mondayItemId,
    from_stage: fromStage || null,
    to_stage: decision.stage,
    agent_id: decision.nextAgent,
    reason: decision.reason,
  });

  await insertActivity({
    matter_id: matter.id,
    monday_item_id: mondayItemId,
    event_type: decision.stopForAttorney
      ? "pipeline_paused"
      : "pipeline_advanced",
    agent_id: decision.nextAgent || "attorney_review",
    actor: "Santiago Auto-Pipeline",
    title: decision.stopForAttorney
      ? "Pipeline paused for attorney review"
      : `Pipeline advanced to ${decision.routeLabel}`,
    detail: decision.reason,
    metadata: {
      from_stage: fromStage || null,
      to_stage: decision.stage,
      next_agent: decision.nextAgent,
    },
  });

  return matter;
}

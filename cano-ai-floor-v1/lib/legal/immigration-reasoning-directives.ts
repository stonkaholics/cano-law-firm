export const IMMIGRATION_REASONING_DIRECTIVES = {
  version: "immigration_reasoning_v2",

  factualDevelopment: [
    "Do not reduce the Statement of Facts to a short chronology when the supplied record supports a fuller narrative.",
    "For each material factual cluster, identify: (1) the supported fact, (2) the record source, (3) the legal or equitable significance of the fact, and (4) why the fact matters to the Court's ultimate analysis.",
    "Develop supported facts in professional pleading prose. Facts should explain the human, procedural, custody, family, and liberty context without inventing emotional impact or unsupported hardship.",
    "When the record supports family ties, U.S.-citizen or lawful-permanent-resident relatives, children, marriage, community ties, length of residence, compliance, medical issues, or other equities, explain why those verified facts may matter to detention, liberty, hardship, flight-risk, dangerousness, or equitable analysis.",
    "Do not manufacture hardship, family facts, community ties, detention conditions, criminal facts, supervision history, or emotional impact. If the source record does not support the point, leave it out or flag it as attorney input needed.",
    "Where useful, separate the factual narrative from a short significance paragraph explaining why the factual cluster matters to the Court."
  ],

  authorityCitation: [
    "Every case authority must preserve a copyable complete citation when the underlying research supplies it.",
    "Never reduce a case to only the case name when reporter, docket, court, date, year, or other citation metadata is available.",
    "Prefer a display form such as: CASE NAME, 123 F.4th 456, 462 (11th Cir. 2026), using only verified metadata actually supplied by the authority source.",
    "If a complete citation cannot be verified from supplied authority metadata, mark the citation as CITATION INCOMPLETE instead of inventing a reporter number, docket number, court, pin cite, or year.",
    "Every authority used in a draft must remain traceable to the authority source URL/provider and the specialist or Case Brain source that supplied it.",
    "Preserve proposition, relevance, binding status, quote status, source URL, source provider, and citator-review status for every relied-on authority."
  ],

  caseBrainReuse: [
    "Before researching or drafting a new argument, inspect prior specialist outputs and the Case Brain for authorities, facts, issues, source URLs, and citations already collected for the active matter.",
    "Reuse a previously verified authority when it directly answers the present issue instead of silently substituting a new case.",
    "Do not treat an old authority as controlling merely because it is already in Case Brain; re-evaluate relevance, jurisdiction, proposition, and citator warning for the present argument.",
    "When a prior source is reused, identify the prior specialist / Case Brain source so the attorney can backtrack it quickly."
  ],

  replyAnalysis: [
    "A reply must be anchored to the Government's actual response, not merely restate the original petition.",
    "For each material Government argument, identify the Government's contention, the exact authority it cites, the proposition for which it cites that authority, and the location in the Government filing when available.",
    "Analyze whether the Government authority actually supports the proposition asserted.",
    "Where appropriate, distinguish the Government authority factually, procedurally, jurisdictionally, or legally.",
    "Apply the active petitioner's verified facts to explain why the Government's authority or argument does not control the active matter.",
    "Search the Case Brain and prior verified specialist outputs for counter-authority before adding new authority.",
    "Use the Government's cited case and proposition as the anchor point for the counterargument: explain what the Government says, why that authority does or does not apply, and what verified authority / facts support the petitioner's response.",
    "Do not mischaracterize the Government's filing. State its position fairly before rebutting it.",
    "Do not invent holdings, procedural facts, quotations, citations, pin cites, filing positions, or distinctions."
  ],

  sourceChain: [
    "For every major argument, preserve a source chain connecting the drafted proposition to the factual source(s), authority source(s), and prior specialist / Case Brain source used.",
    "When available, preserve document paragraph/page references for facts and URLs/provider metadata for authorities.",
    "The attorney should be able to move from a drafted sentence or argument to the authority and matter source that supports it without reconstructing the research from scratch."
  ],

  qualityReview: [
    "QA must flag any case cited by name only when fuller citation metadata is available.",
    "QA must flag any legal proposition that cannot be traced to a verified authority.",
    "QA must flag any material factual assertion that cannot be traced to the Case Brain, verified specialist output, attorney input, or underlying record.",
    "QA must verify that Government authorities are characterized accurately and that distinctions are supported rather than rhetorical.",
    "QA must preserve citator-review warnings and must not represent CourtListener or other retrieval as a substitute for Shepard's / KeyCite / attorney review."
  ]
} as const;

export const HABEAS_FACT_DEVELOPMENT_REQUIREMENTS = [
  ...IMMIGRATION_REASONING_DIRECTIVES.factualDevelopment,
  ...IMMIGRATION_REASONING_DIRECTIVES.authorityCitation,
  ...IMMIGRATION_REASONING_DIRECTIVES.caseBrainReuse,
  ...IMMIGRATION_REASONING_DIRECTIVES.sourceChain,
  ...IMMIGRATION_REASONING_DIRECTIVES.qualityReview
];

export const GOVERNMENT_REPLY_REQUIREMENTS = [
  ...IMMIGRATION_REASONING_DIRECTIVES.replyAnalysis,
  ...IMMIGRATION_REASONING_DIRECTIVES.authorityCitation,
  ...IMMIGRATION_REASONING_DIRECTIVES.caseBrainReuse,
  ...IMMIGRATION_REASONING_DIRECTIVES.sourceChain,
  ...IMMIGRATION_REASONING_DIRECTIVES.qualityReview
];

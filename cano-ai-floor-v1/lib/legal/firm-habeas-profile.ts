export const FIRM_HABEAS_DRAFTING_PROFILE = {
  version: "cano_habeas_exemplars_v1",
  purpose:
    "Cano Law Firm drafting style and structural guidance for attorney-review habeas corpus petitions. Active-matter facts and verified authority remain controlling.",
  source_set: {
    petition_exemplars: [
      "Yanny Heredia Corrales - Petition for Writ of Habeas Corpus - Classic",
      "Luis Lage Miranda - Petition for Writ of Habeas Corpus",
      "Juan Gabriel Poloche Aguirre - Petition for Writ of Habeas Corpus",
      "Juan Domingo Rodriguez Correa - Petition for Writ of Habeas Corpus",
      "Ronnie Alejandro Gonzalez Romero - Petition for Writ of Habeas Corpus - Withholding of Removal and OSUP",
    ],
    court_outcome_reference: [
      "Juan Gabriel Poloche Aguirre - Order Granting Petition for Writ of Habeas Corpus",
    ],
  },
  source_roles: {
    petition_exemplars:
      "Use for organization, tone, caption style, section ordering, paragraph style, argument sequencing, exhibit references, prayer structure, and level of detail. Never copy exemplar client facts into another matter.",
    court_outcome_reference:
      "Use only as a drafting/outcome reference for issue spotting. Do not cite, quote, or characterize it as governing authority unless Lex or another verified authority source separately supplies it for the active matter.",
  },
  drafting_conventions: {
    caption: [
      "Begin with the United States District Court, district, and division.",
      "Include a blank or confirmed civil case number.",
      "Identify petitioner and A-number when verified.",
      "List the immediate custodian plus additional federal immigration officials only when appropriate and verified.",
      "Use official-capacity wording where supported.",
      "Use PETITION FOR WRIT OF HABEAS CORPUS prominently in the caption.",
    ],
    paragraph_style: [
      "Use numbered paragraphs throughout the substantive pleading.",
      "Write fact-specific prose rather than outline bullets.",
      "Tie important factual assertions to available exhibits when the matter record actually contains them.",
      "Use direct, litigation-ready sentences while preserving uncertainty where facts are not verified.",
    ],
    preferred_section_sequence: [
      "INTRODUCTION",
      "CUSTODY",
      "JURISDICTION",
      "VENUE",
      "REQUIREMENTS OF 28 U.S.C. § 2243",
      "PARTIES",
      "STATEMENT OF FACTS",
      "IMMIGRATION / CUSTODY / PROCEDURAL HISTORY as needed for the matter",
      "LEGAL STANDARD / GROUNDS FOR RELIEF / ARGUMENT, tailored to the verified detention posture",
      "EXHAUSTION when legally relevant and supported",
      "RELIEF REQUESTED",
      "DATED / RESPECTFULLY SUBMITTED / COUNSEL SIGNATURE BLOCK",
    ],
    factual_narrative: [
      "Develop the client's chronology in detail: entry, immigration processing, release/parole/supervision, immigration applications or orders, community and family ties, criminal events if any, ICE re-detention, transfers, and current custody.",
      "Explain favorable equities through concrete conduct, not conclusory labels.",
      "Distinguish arrests or allegations from convictions.",
      "Where prior government release or supervision exists, explain the history and compliance only if documented in the active matter.",
    ],
    legal_argument: [
      "Lead with the verified statutory detention posture and governing jurisdiction.",
      "Use verified Supreme Court and controlling circuit authority first, then persuasive district authority.",
      "Apply each cited proposition to the active facts rather than stacking citations.",
      "Preserve adverse authority and unresolved factual predicates.",
      "Do not import a burden, hearing deadline, release remedy, transfer injunction, fee request, or other relief from an exemplar unless the active record and verified authority support it.",
    ],
    relief: [
      "Use a structured WHEREFORE / requested-relief section.",
      "Request only relief supported by the active record and verified authority.",
      "If strategy is unresolved, preserve an attorney-editable placeholder rather than selecting relief automatically.",
    ],
    placeholder_contract: [
      "Every unresolved fact that requires attorney input must appear in draft.markdown as a bracketed token and also be listed verbatim or semantically equivalently in draft.placeholders.",
      "Preferred canonical form is [ATTORNEY INPUT NEEDED: specific item].",
      "Compact display forms such as [DIVISION TBD], [RESPONDENT TBD], and [CASE NO. TBD] are UI aliases only; they must remain editable.",
    ],
  },
  safety_and_integrity: [
    "The active Case Brain and specialist record control facts.",
    "Verified authority research controls legal propositions and quotations.",
    "The exemplar pack controls style and structure only.",
    "Never copy names, A-numbers, dates, facilities, family facts, criminal facts, exhibits, procedural history, or requested relief from an exemplar into an unrelated active matter.",
    "Never treat the court order as controlling authority merely because it is included in the firm source pack.",
    "Attorney review remains mandatory before filing.",
  ],
} as const;

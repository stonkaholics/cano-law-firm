import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(
    path.join(root, rel),
    "utf8"
  );
}

function write(rel, value) {
  fs.writeFileSync(
    path.join(root, rel),
    value,
    "utf8"
  );
}

/*
|--------------------------------------------------------------------------
| 1) REACH EMAIL QUALITY
|--------------------------------------------------------------------------
|
| The prior "always mention PI + Immigration" rule solved capability coverage,
| but it over-constrained the copy and made drafts feel templated.
|
| This patch keeps the capability requirement while restoring research-driven
| personalization and sentence variation.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/api/pi/reach/run/route.ts";

  let source =
    read(rel);

  /*
  | Add a richer quality policy immediately before evidenceRule.
  | This anchor survives the previous build-time prompt patches.
  */
  if (
    !source.includes(
      "researchDrivenPersonalization:"
    )
  ) {
    const anchor =
`  evidenceRule:
    "Recipient-specific statements must be supported by the saved Scout prospect, verified_location, practice_evidence, practice_source_urls, or other supplied verified professional context.",`;

    if (!source.includes(anchor)) {
      throw new Error(
        "Reach email quality patch: evidenceRule anchor not found."
      );
    }

    const insertion =
`  researchDrivenPersonalization: {
    priority:
      "HIGH",

    instruction:
      "The substance of the email must come from the saved Scout research. First determine the strongest actual reason this specific firm and Cano may be useful professional resources to one another. Build the email around that bridge instead of filling a generic outreach template.",

    referralBridgeExamples: [
      "Different but complementary practice areas that create natural cross-referral situations.",
      "A firm whose clients may encounter immigration issues while Cano clients may need that firm's estate, probate, family, criminal, business, or other verified practice.",
      "Geographic coverage, conflicts, capacity, or matter-type differences only when those facts are actually supported by the saved prospect research.",
      "A plaintiff-side or adjacent practice where either firm may encounter matters outside its primary focus.",
    ],

    requiredBehavior: [
      "Identify one primary referral bridge before drafting.",
      "Use one or two verified details about the recipient firm that make that bridge credible.",
      "Explain WHY Erik thought it was worth introducing the firms.",
      "Do not merely restate the recipient firm's practice areas.",
      "Do not produce a generic networking email that could be sent unchanged to another law firm.",
    ],
  },

  canoCapabilityMention: {
    instruction:
      "The body should make the recipient aware that Cano handles both Personal Injury and Immigration in Florida, but this must be woven naturally into the referral reason. Do not force the exact same sentence in every email.",

    allowedPatterns: [
      "We handle personal injury and immigration matters in Florida...",
      "Our work is primarily personal injury and immigration...",
      "At Cano, our main practice areas are personal injury and immigration...",
      "We focus on personal injury and immigration matters here in Florida...",
    ],

    rules: [
      "Mention Personal Injury and Immigration once in the body.",
      "Do not turn the sentence into a list of services.",
      "Do not lead with Immigration unless Immigration is directly relevant to the prospect.",
      "Vary wording and sentence structure between firms.",
    ],
  },

  antiTemplateRules: [
    "Do not repeatedly use: I handle our referral relationships at Cano Law Firm and thought there may be times when it's useful for our firms to know each other.",
    "Do not repeatedly use: I came across [Firm] while looking at firms handling [practice] in Florida.",
    "Do not use the same opening construction for every recipient.",
    "Do not use the same referral paragraph construction for every recipient.",
    "Avoid empty phrases such as useful for our firms to know each other unless followed by a specific reason.",
    "Prefer concrete language such as a matter falling outside one firm's core practice, a client needing a complementary practice area, or another verified referral bridge.",
    "The email must still sound like a short human-written note, not a detailed research report.",
  ],

  openingVariationRules: [
    "Choose the most natural opening based on the saved research rather than using a fixed template.",
    "Possible approaches include mentioning the recipient's specific practice focus, the firm's complementary work, a relevant geographic overlap, or a particular professional reason the firm stood out.",
    "Keep the opening to one short paragraph.",
  ],

  approvedToneExamples: [
    {
      label:
        "complementary_practice",
      example:
        "I was looking through Florida firms handling probate and estate matters and came across your practice. Since we regularly work with clients on personal injury and immigration matters, there are situations where someone we speak with needs help well outside our lane, and your firm stood out as a possible resource.",
    },
    {
      label:
        "adjacent_practice",
      example:
        "I came across your firm while looking at plaintiff-side practices in Florida. Your work overlaps with some of the matters we see, but you also handle areas we do not, so I thought it made sense to introduce myself.",
    },
    {
      label:
        "simple_human",
      example:
        "I was reviewing firms in Florida that might make sense for referrals outside our core practice and your firm caught my attention because of your work in [VERIFIED PRACTICE].",
    },
  ],

${anchor}`;

    source =
      source.replace(
        anchor,
        insertion
      );
  }

  /*
  | Remove/soften any exact forced sentence added by the previous prompt patch.
  | Keep the requirement, but stop telling the model to mimic one sentence.
  */
  source =
    source.replace(
      /"Always mention Cano's two primary referral lanes once in the body using natural language substantially similar to: We handle personal injury and immigration matters in Florida\. Do not turn this into a service list and do not make immigration the lead unless it is relevant to the prospect\.",\s*/g,
      `"Mention Cano's two primary referral lanes, Personal Injury and Immigration, once in the body, but vary the wording naturally and tie the sentence to the actual referral reason. Do not turn this into a service list.",\n    `
    );

  write(
    rel,
    source
  );

  console.log(
    `${rel}: research-driven email quality policy patched`
  );
}

/*
|--------------------------------------------------------------------------
| 2) REACH CONFIDENCE DISPLAY
|--------------------------------------------------------------------------
|
| Some Reach draft metadata arrives without metadata.confidence, producing 0%.
| Use the saved Scout fit score as a display fallback instead of showing 0.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/personal-injury/ReachWorkstation.tsx";

  let source =
    read(rel);

  const oldConfidence =
`                    {Number(
                      selectedDraft
                        .metadata
                        ?.confidence ||
                        0
                    )}
                    %`;

  const newConfidence =
`                    {Math.round(
                      Number(
                        selectedDraft
                          .metadata
                          ?.confidence ||
                        prospectForDraft
                          ?.score ||
                        0
                      )
                    )}
                    %`;

  if (
    source.includes(
      oldConfidence
    )
  ) {
    source =
      source.replace(
        oldConfidence,
        newConfidence
      );

    console.log(
      `${rel}: confidence fallback patched`
    );
  } else {
    console.log(
      `${rel}: confidence block already changed or patched`
    );
  }

  write(
    rel,
    source
  );
}

console.log(
  "Applied Reach research-driven email quality + confidence fallback patch."
);

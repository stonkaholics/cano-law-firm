import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing file: ${rel}`);
  }
  return fs.readFileSync(p, "utf8");
}

function write(rel, value) {
  fs.writeFileSync(
    path.join(root, rel),
    value
  );
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) {
    return source;
  }

  if (!source.includes(before)) {
    throw new Error(
      `Orbit full-details patch could not find anchor: ${label}`
    );
  }

  return source.replace(
    before,
    after
  );
}

/*
|--------------------------------------------------------------------------
| 1. LIB / CALENDLY EXTRACTION
|--------------------------------------------------------------------------
*/

const libRel =
  "lib/pi/referral-meetings.ts";

let lib =
  read(libRel);

const oldExtract =
`export function extractCalendlyMeetingFields(
  invitee: any,
  event: any
) {
  const organizationName =
    answerByKeywords(
      invitee,
      [
        "firm",
        "organization",
        "company",
      ]
    );

  const website =
    answerByKeywords(
      invitee,
      [
        "website",
        "url",
      ]
    );

  const practiceAreasRaw =
    answerByKeywords(
      invitee,
      [
        "practice area",
        "practice areas",
        "primary practice",
      ]
    );

  const phone =
    clean(
      invitee
        ?.text_reminder_number
    ) ||
    answerByKeywords(
      invitee,
      [
        "phone",
        "telephone",
        "mobile",
      ]
    );

  const practiceAreas =
    practiceAreasRaw
      ? practiceAreasRaw
          .split(
            /[,;|]/g
          )
          .map(clean)
          .filter(Boolean)
      : [];

  return {
    inviteeName:
      clean(
        invitee?.name
      ),

    inviteeEmail:
      clean(
        invitee?.email
      ),

    inviteePhone:
      phone,

    organizationName,

    website,

    practiceAreas,

    timezone:
      clean(
        invitee?.timezone
      ) ||
      "America/New_York",

    eventName:
      clean(
        event?.name
      ),

    startAt:
      clean(
        event?.start_time
      ),

    endAt:
      clean(
        event?.end_time
      ),

    eventTypeUri:
      clean(
        event?.event_type
      ),
  };
}`;

const newExtract =
`function answerByQuestionPriority(
  invitee: any,
  exactPatterns: RegExp[],
  fallbackKeywords: string[] = []
) {
  const rows =
    questionAnswerMap(
      invitee
    );

  for (
    const pattern of
    exactPatterns
  ) {
    const match =
      rows.find(
        (row: any) =>
          pattern.test(
            clean(
              row.question
            )
          )
      );

    if (
      clean(
        match?.answer
      )
    ) {
      return clean(
        match.answer
      );
    }
  }

  return fallbackKeywords.length
    ? answerByKeywords(
        invitee,
        fallbackKeywords
      )
    : "";
}

function extractInviteePhone(
  invitee: any,
  event: any
) {
  const directCandidates = [
    invitee?.text_reminder_number,
    invitee?.phone_number,
    invitee?.phone,
    invitee?.mobile_number,
    invitee?.mobile,
    invitee?.sms_reminder_number,
    invitee?.location?.location,
    event?.location?.location,
  ]
    .map(clean)
    .filter(Boolean);

  const obviousDirect =
    directCandidates.find(
      (value) =>
        /\\d{7,}/.test(
          value.replace(
            /\\D/g,
            ""
          )
        )
    );

  if (obviousDirect) {
    return obviousDirect;
  }

  const fromQuestions =
    answerByQuestionPriority(
      invitee,
      [
        /^(phone|phone number|mobile|mobile number|telephone|telephone number)$/i,
        /best.*(phone|number)/i,
        /(phone|mobile|telephone).*(reach|contact|call)/i,
        /(direct|cell).*(phone|number)/i,
      ],
      [
        "phone",
        "telephone",
        "mobile",
        "cell",
      ]
    );

  return clean(
    fromQuestions
  );
}

export function extractCalendlyMeetingFields(
  invitee: any,
  event: any
) {
  const questionsAndAnswers =
    questionAnswerMap(
      invitee
    );

  const organizationName =
    answerByQuestionPriority(
      invitee,
      [
        /^(law firm|law firm name|firm name|company|company name|organization|organization name)$/i,
        /(name of).*(firm|company|organization)/i,
        /(firm|company|organization).*name/i,
      ],
      [
        "law firm name",
        "firm name",
        "company name",
        "organization name",
      ]
    );

  const website =
    answerByQuestionPriority(
      invitee,
      [
        /^(website|website url|firm website|company website|organization website)$/i,
        /(firm|company|organization).*website/i,
      ],
      [
        "website",
        "url",
      ]
    );

  const practiceAreasRaw =
    answerByQuestionPriority(
      invitee,
      [
        /^(practice area|practice areas|primary practice area|primary practice areas)$/i,
        /what.*practice area/i,
        /(primary|main).*practice/i,
      ],
      [
        "practice area",
        "practice areas",
        "primary practice",
      ]
    );

  const phone =
    extractInviteePhone(
      invitee,
      event
    );

  const practiceAreas =
    practiceAreasRaw
      ? practiceAreasRaw
          .split(
            /[,;|]/g
          )
          .map(clean)
          .filter(Boolean)
      : [];

  return {
    inviteeName:
      clean(
        invitee?.name
      ),

    inviteeEmail:
      clean(
        invitee?.email
      ),

    inviteePhone:
      phone,

    organizationName,

    website,

    practiceAreas,

    questionsAndAnswers,

    timezone:
      clean(
        invitee?.timezone
      ) ||
      "America/New_York",

    eventName:
      clean(
        event?.name
      ),

    startAt:
      clean(
        event?.start_time
      ),

    endAt:
      clean(
        event?.end_time
      ),

    eventTypeUri:
      clean(
        event?.event_type
      ),
  };
}`;

lib =
  replaceOnce(
    lib,
    oldExtract,
    newExtract,
    "extractCalendlyMeetingFields"
  );

/*
|--------------------------------------------------------------------------
| 2. SAVE COMPLETE CALENDLY DETAIL INTO source_payload
|--------------------------------------------------------------------------
*/

const oldSource =
`      source_payload: {
        calendly:
          input.rawPayload,

        match: {
          matched_by:
            match.matchedBy,
          prospect_id:
            match
              .prospect
              ?.id ||
            null,
          contact_id:
            match
              .contact
              ?.id ||
            null,
        },

        calendar_error:
          calendarError,
      },`;

const newSource =
`      source_payload: {
        calendly:
          input.rawPayload,

        /*
        | Keep the complete API records, not only the webhook envelope.
        | The recovery sync payload contains mostly URIs, while these objects
        | contain the actual Calendly intake answers and phone information.
        */
        calendly_event:
          input.event,

        calendly_invitee:
          input.invitee,

        calendly_intake: {
          questions_and_answers:
            fields.questionsAndAnswers,

          phone:
            fields.inviteePhone,

          firm:
            fields.organizationName,

          website:
            fields.website,

          practice_areas:
            fields.practiceAreas,
        },

        match: {
          matched_by:
            match.matchedBy,
          prospect_id:
            match
              .prospect
              ?.id ||
            null,
          contact_id:
            match
              .contact
              ?.id ||
            null,
        },

        calendar_error:
          calendarError,
      },`;

lib =
  replaceOnce(
    lib,
    oldSource,
    newSource,
    "source_payload"
  );

/*
|--------------------------------------------------------------------------
| 3. SEND COMPLETE CALENDLY INTAKE TO THE OPTIONAL AI BRIEF
|--------------------------------------------------------------------------
*/

const oldMeetingPayload =
`            meeting:
              input.meeting,

            prospect:
              input.prospect,`;

const newMeetingPayload =
`            meeting:
              input.meeting,

            calendly_intake:
              asObject(
                input.meeting
                  ?.source_payload
              )
                ?.calendly_intake ||
              {},

            prospect:
              input.prospect,`;

lib =
  replaceOnce(
    lib,
    oldMeetingPayload,
    newMeetingPayload,
    "n8n calendly_intake"
  );

/*
|--------------------------------------------------------------------------
| 4. TITAN DESCRIPTION GETS ALL CALENDLY ANSWERS
|--------------------------------------------------------------------------
*/

const oldTitanDescription =
`                \`Practice Areas: \${
                  fields
                    .practiceAreas
                    .join(", ")
                }\`,
                "",
                \`PI Floor: \${input.appOrigin}/personal-injury\`,
              ].join("\\n"),`;

const newTitanDescription =
`                \`Practice Areas: \${
                  fields
                    .practiceAreas
                    .join(", ")
                }\`,
                "",
                ...(
                  fields
                    .questionsAndAnswers
                    .length
                    ? [
                        "Calendly Intake:",
                        ...fields
                          .questionsAndAnswers
                          .map(
                            (row: any) =>
                              \`\${clean(row.question)}: \${clean(row.answer)}\`
                          ),
                        "",
                      ]
                    : []
                ),
                \`PI Floor: \${input.appOrigin}/personal-injury\`,
              ].join("\\n"),`;

lib =
  replaceOnce(
    lib,
    oldTitanDescription,
    newTitanDescription,
    "Titan Calendly details"
  );

write(
  libRel,
  lib
);

/*
|--------------------------------------------------------------------------
| 5. ORBIT WORKSTATION — DISPLAY PHONE + EVERY CALENDLY ANSWER
|--------------------------------------------------------------------------
*/

const uiRel =
  "app/personal-injury/ReferralMeetingWorkstation.tsx";

let ui =
  read(uiRel);

ui =
  replaceOnce(
    ui,
`  brief: Record<string, any>;
};`,
`  brief: Record<string, any>;
  source_payload?: Record<string, any>;
};`,
    "Meeting source_payload type"
  );

ui =
  replaceOnce(
    ui,
`  FileText,
  Mail,`,
`  FileText,
  Mail,
  Phone,
  Globe2,
  ClipboardList,`,
    "lucide detail icons"
  );

const selectedAnchor =
`  const selected =
    useMemo(
      () =>
        data?.meetings?.find(
          (meeting) =>
            meeting.id ===
            selectedId
        ) ||
        data?.meetings?.[0] ||
        null,
      [
        data,
        selectedId,
      ]
    );`;

const selectedReplacement =
`  const selected =
    useMemo(
      () =>
        data?.meetings?.find(
          (meeting) =>
            meeting.id ===
            selectedId
        ) ||
        data?.meetings?.[0] ||
        null,
      [
        data,
        selectedId,
      ]
    );

  const calendlyIntake =
    useMemo(
      () => {
        const source =
          selected
            ?.source_payload &&
          typeof selected
            .source_payload ===
            "object"
            ? selected
                .source_payload
            : {};

        const intake =
          source
            ?.calendly_intake &&
          typeof source
            .calendly_intake ===
            "object"
            ? source
                .calendly_intake
            : {};

        const invitee =
          source
            ?.calendly_invitee &&
          typeof source
            .calendly_invitee ===
            "object"
            ? source
                .calendly_invitee
            : {};

        const questions =
          Array.isArray(
            intake
              ?.questions_and_answers
          )
            ? intake
                .questions_and_answers
            : Array.isArray(
                invitee
                  ?.questions_and_answers
              )
            ? invitee
                .questions_and_answers
            : [];

        return {
          phone:
            clean(
              selected
                ?.invitee_phone
            ) ||
            clean(
              intake?.phone
            ) ||
            clean(
              invitee
                ?.text_reminder_number
            ) ||
            clean(
              invitee
                ?.phone_number
            ) ||
            clean(
              invitee?.phone
            ),

          questions:
            questions
              .map(
                (row: any) => ({
                  question:
                    clean(
                      row?.question
                    ),
                  answer:
                    clean(
                      row?.answer
                    ),
                })
              )
              .filter(
                (row: any) =>
                  row.question &&
                  row.answer
              ),
        };
      },
      [
        selected,
      ]
    );`;

ui =
  replaceOnce(
    ui,
    selectedAnchor,
    selectedReplacement,
    "selected useMemo"
  );

/*
| Add PHONE to snapshot grid after contact card.
*/
const oldContactCard =
`                  <div>
                    <span>
                      CONTACT
                    </span>
                    <strong>
                      {snapshot.contact ||
                        selected.invitee_name}
                    </strong>
                    <small>
                      {snapshot.contact_title ||
                        selected.invitee_email}
                    </small>
                  </div>`;

const newContactCard =
`                  <div>
                    <span>
                      CONTACT
                    </span>
                    <strong>
                      {snapshot.contact ||
                        selected.invitee_name}
                    </strong>
                    <small>
                      {snapshot.contact_title ||
                        selected.invitee_email}
                    </small>
                  </div>

                  <div>
                    <span>
                      PHONE
                    </span>
                    <strong>
                      {calendlyIntake.phone ||
                        "Not provided"}
                    </strong>
                    {calendlyIntake.phone ? (
                      <a
                        className={
                          styles.inlineContactLink
                        }
                        href={\`tel:\${calendlyIntake.phone}\`}
                      >
                        <Phone
                          size={12}
                        />
                        Call
                      </a>
                    ) : null}
                  </div>`;

ui =
  replaceOnce(
    ui,
    oldContactCard,
    newContactCard,
    "phone snapshot card"
  );

/*
| Insert Calendly intake section after snapshot.
*/
const afterSnapshot =
`              {brief?.why_this_meeting ? (`;

const intakeBlock =
`              {calendlyIntake.questions.length ? (
                <section
                  className={
                    styles.calendlyIntake
                  }
                >
                  <div
                    className={
                      styles.sectionTitle
                    }
                  >
                    <ClipboardList
                      size={15}
                    />
                    Calendly Intake
                  </div>

                  <div
                    className={
                      styles.intakeGrid
                    }
                  >
                    {calendlyIntake.questions.map(
                      (
                        row: any,
                        index: number
                      ) => (
                        <div
                          key={\`calendly-intake-\${index}\`}
                          className={
                            styles.intakeCard
                          }
                        >
                          <span>
                            {row.question}
                          </span>
                          <strong>
                            {row.answer}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </section>
              ) : (
                <section
                  className={
                    styles.calendlyIntake
                  }
                >
                  <div
                    className={
                      styles.sectionTitle
                    }
                  >
                    <ClipboardList
                      size={15}
                    />
                    Calendly Intake
                  </div>

                  <p
                    className={
                      styles.intakeEmpty
                    }
                  >
                    No custom Calendly answers are stored on this meeting yet. Click Sync Calendly to refresh the complete invitee record.
                  </p>
                </section>
              )}

              {brief?.why_this_meeting ? (`;

ui =
  replaceOnce(
    ui,
    afterSnapshot,
    intakeBlock,
    "Calendly intake section"
  );

write(
  uiRel,
  ui
);

/*
|--------------------------------------------------------------------------
| 6. CSS
|--------------------------------------------------------------------------
*/

const cssRel =
  "app/personal-injury/ReferralMeetingWorkstation.module.css";

let css =
  read(cssRel);

if (
  !css.includes(
    ".calendlyIntake{"
  )
) {
  css += `

.calendlyIntake{
  margin-top:10px;
  padding:13px;
  border:1px solid rgba(128,151,171,.11);
  border-radius:9px;
  background:rgba(255,255,255,.012)
}

.intakeGrid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:8px;
  margin-top:10px
}

.intakeCard{
  min-width:0;
  padding:10px 11px;
  border:1px solid rgba(128,151,171,.09);
  border-radius:8px;
  background:rgba(5,15,25,.36)
}

.intakeCard span{
  display:block;
  color:#71869a;
  font-size:9px;
  font-weight:900;
  letter-spacing:.055em;
  text-transform:uppercase;
  line-height:1.35
}

.intakeCard strong{
  display:block;
  margin-top:5px;
  color:#dce7ed;
  font-size:12px;
  font-weight:600;
  line-height:1.45;
  overflow-wrap:anywhere
}

.intakeEmpty{
  margin:9px 0 0;
  color:#8191a3;
  font-size:11px;
  line-height:1.5
}

.inlineContactLink{
  display:inline-flex!important;
  align-items:center;
  gap:5px;
  margin-top:5px!important;
  color:#73c8ee!important;
  font-size:10px!important;
  text-decoration:none!important
}

@media(max-width:720px){
  .intakeGrid{
    grid-template-columns:1fr
  }
}
`;
}

write(
  cssRel,
  css
);

console.log(
  "Applied Orbit Calendly full-details patch: robust phone parsing, complete intake persistence, Titan detail sync, and Orbit intake UI."
);

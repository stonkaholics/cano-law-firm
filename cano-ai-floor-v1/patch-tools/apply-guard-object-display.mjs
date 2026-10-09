import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, value) {
  fs.writeFileSync(path.join(root, rel), value, "utf8");
}

/*
|--------------------------------------------------------------------------
| GUARD STRUCTURED OUTPUT DISPLAY FIX
|--------------------------------------------------------------------------
|
| Guard's n8n output can legitimately return arrays of objects for:
| - flags
| - findings
| - required_edits
| - warnings
| - issues
|
| The UI previously did String(flag), which converts any object to:
| [object Object]
|
| This patch normalizes structured Guard findings into readable title/detail/
| severity/action cards without changing the actual stored Guard output.
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/personal-injury/GuardWorkstation.tsx";

  let source = read(rel);

  const helperAnchor = `function reviewForDraft(
  reviews: GuardReview[],
  draftId: string
) {
  return (
    reviews.find(
      (review) =>
        review.subject_id === draftId &&
        clean(review.metadata?.agent).toLowerCase() === "guard"
    ) || null
  );
}`;

  const helpers = `${helperAnchor}

type GuardDisplayItem = {
  title: string;
  detail: string;
  severity: string;
  action: string;
};

function readableGuardValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        readableGuardValue(item)
      )
      .filter(Boolean)
      .join("; ");
  }

  if (typeof value === "object") {
    const record =
      value as Record<
        string,
        unknown
      >;

    const preferredKeys = [
      "message",
      "detail",
      "description",
      "reason",
      "finding",
      "issue",
      "text",
      "summary",
      "required_edit",
      "requiredEdit",
      "recommendation",
      "action",
    ];

    for (
      const key
      of preferredKeys
    ) {
      const readable =
        readableGuardValue(
          record[key]
        );

      if (readable) {
        return readable;
      }
    }

    return Object.entries(
      record
    )
      .map(
        ([key, item]) => {
          const readable =
            readableGuardValue(
              item
            );

          if (!readable) {
            return "";
          }

          const label =
            key
              .replace(
                /_/g,
                " "
              )
              .replace(
                /\\b\\w/g,
                (letter) =>
                  letter.toUpperCase()
              );

          return \`\${label}: \${readable}\`;
        }
      )
      .filter(Boolean)
      .join(" · ");
  }

  return "";
}

function normalizeGuardItem(
  value: unknown,
  index: number
): GuardDisplayItem {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {
      title:
        \`Review item \${index + 1}\`,
      detail:
        readableGuardValue(
          value
        ) ||
        "Guard returned an empty review item.",
      severity: "",
      action: "",
    };
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  const title =
    readableGuardValue(
      record.title ||
      record.label ||
      record.category ||
      record.type ||
      record.rule ||
      record.name
    ) ||
    \`Review item \${index + 1}\`;

  const detail =
    readableGuardValue(
      record.message ||
      record.detail ||
      record.description ||
      record.reason ||
      record.finding ||
      record.issue ||
      record.text ||
      record.summary
    ) ||
    readableGuardValue(
      record
    ) ||
    "Guard returned a structured review item.";

  const severity =
    readableGuardValue(
      record.severity ||
      record.level ||
      record.risk ||
      record.priority
    );

  const action =
    readableGuardValue(
      record.required_edit ||
      record.requiredEdit ||
      record.action ||
      record.fix ||
      record.recommendation
    );

  return {
    title,
    detail,
    severity,
    action,
  };
}

function guardReviewItems(
  review?: GuardReview | null
): GuardDisplayItem[] {
  if (!review) {
    return [];
  }

  const metadata =
    review.metadata || {};

  const candidates = [
    metadata.flags,
    metadata.findings,
    metadata.issues,
    metadata.warnings,
    metadata.required_edits,
    metadata.requiredEdits,
  ];

  const firstArray =
    candidates.find(
      (value) =>
        Array.isArray(value) &&
        value.length
    );

  if (!Array.isArray(firstArray)) {
    return [];
  }

  return firstArray.map(
    (item, index) =>
      normalizeGuardItem(
        item,
        index
      )
  );
}`;

  if (
    !source.includes(
      "function readableGuardValue("
    )
  ) {
    if (
      !source.includes(
        helperAnchor
      )
    ) {
      throw new Error(
        "Guard object display patch: reviewForDraft anchor not found."
      );
    }

    source =
      source.replace(
        helperAnchor,
        helpers
      );
  }

  const oldSummary = `                      <div className={styles.reviewSummary}>
                        {selectedReview.notes ||
                          clean(selectedReview.metadata?.summary) ||
                          "Guard did not return review notes."}
                      </div>`;

  const newSummary = `                      <div className={styles.reviewSummary}>
                        {readableGuardValue(
                          selectedReview.notes ||
                          selectedReview.metadata?.summary
                        ) ||
                          "Guard did not return review notes."}
                      </div>`;

  if (
    source.includes(
      oldSummary
    )
  ) {
    source =
      source.replace(
        oldSummary,
        newSummary
      );
  }

  const oldFlags = `                      <div className={styles.flags}>
                        {(Array.isArray(selectedReview.metadata?.flags)
                          ? selectedReview.metadata?.flags
                          : []
                        ).map((flag: any, index: number) => (
                          <div key={\`\${String(flag)}-\${index}\`}>
                            <span>{index + 1}</span>
                            <p>{String(flag)}</p>
                          </div>
                        ))}
                      </div>`;

  const newFlags = `                      <div className={styles.flags}>
                        {guardReviewItems(
                          selectedReview
                        ).map(
                          (
                            item,
                            index
                          ) => (
                            <div
                              key={\`\${item.title}-\${index}\`}
                              className={
                                styles.flagCard
                              }
                            >
                              <span
                                className={
                                  styles.flagNumber
                                }
                              >
                                {index + 1}
                              </span>

                              <div
                                className={
                                  styles.flagContent
                                }
                              >
                                <div
                                  className={
                                    styles.flagTopline
                                  }
                                >
                                  <strong>
                                    {
                                      item.title
                                    }
                                  </strong>

                                  {item.severity ? (
                                    <em>
                                      {
                                        item.severity
                                      }
                                    </em>
                                  ) : null}
                                </div>

                                <p>
                                  {
                                    item.detail
                                  }
                                </p>

                                {item.action ? (
                                  <div
                                    className={
                                      styles.flagAction
                                    }
                                  >
                                    <b>
                                      GUARD EDIT
                                    </b>
                                    <span>
                                      {
                                        item.action
                                      }
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          )
                        )}
                      </div>`;

  if (
    source.includes(
      oldFlags
    )
  ) {
    source =
      source.replace(
        oldFlags,
        newFlags
      );
  } else if (
    !source.includes(
      "guardReviewItems("
    )
  ) {
    throw new Error(
      "Guard object display patch: flags render block not found."
    );
  }

  write(
    rel,
    source
  );

  console.log(
    `${rel}: structured Guard review rendering patched`
  );
}

/*
|--------------------------------------------------------------------------
| CSS
|--------------------------------------------------------------------------
*/

{
  const rel =
    "app/personal-injury/GuardWorkstation.module.css";

  let source = read(rel);

  if (
    !source.includes(
      ".flagCard {"
    )
  ) {
    source += `

/* Guard structured findings */
.flagCard {
  display: grid !important;
  grid-template-columns: 24px minmax(0, 1fr) !important;
  gap: 9px !important;
  align-items: start !important;
  padding: 9px 10px;
  border: 1px solid rgba(173,194,206,.08);
  border-radius: 8px;
  background: rgba(255,255,255,.008);
}

.flagNumber {
  width: 22px !important;
  height: 22px !important;
  border: 1px solid rgba(224,191,133,.14) !important;
  border-radius: 50% !important;
  color: #d7b77d !important;
  background: rgba(224,191,133,.025);
  display: grid !important;
  place-items: center !important;
  font-size: 7px !important;
  font-weight: 800;
}

.flagContent {
  min-width: 0;
}

.flagTopline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.flagTopline strong {
  color: #dbe5ea;
  font-size: 8px;
  font-weight: 800;
}

.flagTopline em {
  flex: 0 0 auto;
  padding: 3px 6px;
  border: 1px solid rgba(224,191,133,.12);
  border-radius: 999px;
  color: #d7b77d;
  background: rgba(224,191,133,.02);
  font-size: 5px;
  font-style: normal;
  font-weight: 900;
  text-transform: uppercase;
}

.flagContent p {
  margin: 5px 0 0 !important;
  color: #8299a4 !important;
  font-size: 7.5px !important;
  line-height: 1.55;
  white-space: normal;
}

.flagAction {
  margin-top: 7px;
  padding: 7px 8px;
  border-left: 2px solid rgba(107,184,255,.28);
  border-radius: 0 6px 6px 0;
  background: rgba(107,184,255,.025);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.flagAction b {
  color: #82b5d2;
  font-size: 5px;
  letter-spacing: .08em;
}

.flagAction span {
  color: #94aab4;
  font-size: 7px;
  line-height: 1.5;
}
`;
  }

  write(
    rel,
    source
  );

  console.log(
    `${rel}: Guard structured finding styles patched`
  );
}

console.log(
  "Applied Guard structured object display full patch."
);

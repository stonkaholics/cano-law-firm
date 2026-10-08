const CONTACT_EMAIL =
  "contact@canolawfirm.com";

const BOOKING_URL =
  "https://canolawfirm.com/book/";

const FIRM_WEBSITE =
  "https://www.canolawfirm.com/";

const FIRM_PHONE =
  "(786) 673-0958";

const FIRM_PHONE_HREF =
  "+17866730958";

const FIRM_ADDRESS =
  "9100 Coral Way, Suite 1, Miami, FL 33165";

function escapeHtml(
  value: unknown
) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clean(
  value: unknown
) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/*
|--------------------------------------------------------------------------
| REMOVE THE REVIEW-SCREEN SIGNATURE
|--------------------------------------------------------------------------
|
| Reach drafts can contain a plain-text footer for review. The actual outgoing
| email receives the standard Cano signature below so it is never duplicated.
|--------------------------------------------------------------------------
*/

function stripDraftSignature(
  value: string
) {
  const normalized =
    clean(value);

  const markers = [
    /\n\s*Best regards,?/i,
    /\n\s*Best Regards,?/i,
    /\n\s*Erik Quisenberry\s*\n/i,
    /\n\s*CANO LAW FIRM,?\s*P\.?A\.?/i,
  ];

  let end =
    normalized.length;

  for (const marker of markers) {
    const match =
      marker.exec(normalized);

    if (
      match &&
      match.index < end
    ) {
      end =
        match.index;
    }
  }

  return normalized
    .slice(0, end)
    .trim();
}

/*
|--------------------------------------------------------------------------
| SAFE PLAIN-EMAIL LINKING
|--------------------------------------------------------------------------
|
| This renders URLs exactly like a normal manually typed email:
| visible URL + standard underlined hyperlink.
|--------------------------------------------------------------------------
*/

function renderInlineText(
  value: string
) {
  const raw =
    String(value || "");

  const tokenPattern =
    /(https:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

  let html = "";
  let lastIndex = 0;

  for (
    const match of raw.matchAll(
      tokenPattern
    )
  ) {
    const index =
      match.index ?? 0;

    html += escapeHtml(
      raw.slice(
        lastIndex,
        index
      )
    );

    const token =
      match[0];

    if (
      token.includes("@") &&
      !token.startsWith("http")
    ) {
      html += `<a href="mailto:${escapeHtml(token)}" style="color:#1155cc;text-decoration:underline;">${escapeHtml(token)}</a>`;
    } else {
      html += `<a href="${escapeHtml(token)}" target="_blank" style="color:#1155cc;text-decoration:underline;">${escapeHtml(token)}</a>`;
    }

    lastIndex =
      index + token.length;
  }

  html += escapeHtml(
    raw.slice(lastIndex)
  );

  return html;
}

function renderBody(
  body: string
) {
  return stripDraftSignature(body)
    .split(/\n{2,}/)
    .map((item) =>
      item.trim()
    )
    .filter(Boolean)
    .map(
      (paragraph) => `
        <p
          style="
            margin:0 0 18px 0;
            font-family:Arial,Helvetica,sans-serif;
            font-size:15px;
            line-height:1.6;
            color:#202124;
          "
        >
          ${renderInlineText(
            paragraph
          ).replace(
            /\n/g,
            "<br>"
          )}
        </p>
      `
    )
    .join("");
}

function plainTextFooter() {
  return [
    "",
    "Best regards,",
    "",
    "Erik Quisenberry",
    "Chief Operating Officer",
    "Cano Law Firm, P.A.",
    "",
    "Personal Injury | Immigration",
    `A: ${FIRM_ADDRESS}`,
    `P: ${FIRM_PHONE}`,
    `E: ${CONTACT_EMAIL}`,
    "W: www.canolawfirm.com",
    "",
    "NOTICE: The information in this e-mail is confidential and may contain information that is attorney-client privileged or exempt from disclosure. It is intended only for the use of the individual(s) or entity(ies) to whom it is addressed. If you are not an intended recipient, you are hereby notified that any use, dissemination, distribution or copying of this communication is strictly prohibited. Anyone who receives this message in error should notify the sender immediately by telephone or by return e-mail and delete the entire message (and any attachments) from their computer. Any opinions or advice contained in this email shall be subject to the terms and conditions set forth in the Cano Law Firm client engagement agreement.",
    "",
    'IRS Circular 230 Disclosure: Please note that the views expressed herein or in any attachments hereto are not intended to constitute a "reliance opinion" under applicable Treasury Regulations, and accordingly are not intended or written to be used, and may not be used or relied upon, for the purpose of (i) avoiding tax-related penalties that may be imposed by the Internal Revenue Service, or (ii) promoting, marketing or recommending to another party any tax-related matters addressed herein.',
  ].join("\n");
}

export function buildCanoReferralEmail({
  subject,
  body,
}: {
  subject: string;
  body: string;
}) {
  const cleanedBody =
    stripDraftSignature(
      body
    );

  const htmlBody =
    renderBody(
      cleanedBody
    );

  /*
  |--------------------------------------------------------------------------
  | ORGANIC OUTREACH EMAIL
  |--------------------------------------------------------------------------
  |
  | Deliberately designed to look like a normal one-to-one email:
  | - white background
  | - no branded hero/header
  | - no cards
  | - no CTA button
  | - no marketing callout
  | - visible normal booking URL
  | - restrained human signature
  |--------------------------------------------------------------------------
  */

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="x-apple-disable-message-reformatting"
  >

  <title>
    ${escapeHtml(subject)}
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#ffffff;
    font-family:Arial,Helvetica,sans-serif;
    color:#202124;
    -webkit-text-size-adjust:100%;
    -ms-text-size-adjust:100%;
  "
>

<table
  role="presentation"
  width="100%"
  cellspacing="0"
  cellpadding="0"
  border="0"
  style="
    width:100%;
    border-collapse:collapse;
    background:#ffffff;
  "
>
  <tr>
    <td
      style="
        padding:22px 24px 30px 24px;
      "
    >

      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          width:100%;
          max-width:760px;
          border-collapse:collapse;
        "
      >

        <!-- EMAIL BODY -->
        <tr>
          <td>
            ${htmlBody}
          </td>
        </tr>

        <!-- HUMAN SIGNATURE -->
        <tr>
          <td
            style="
              padding-top:4px;
              font-family:Arial,Helvetica,sans-serif;
              color:#202124;
            "
          >

            <p
              style="
                margin:0 0 18px 0;
                font-size:15px;
                line-height:1.5;
              "
            >
              Best regards,
            </p>

            <table
              role="presentation"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="
                border-collapse:collapse;
              "
            >
              <tr>
                <td
                  style="
                    padding:0;
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:13px;
                    line-height:1.48;
                    color:#202124;
                  "
                >
                  <strong
                    style="
                      color:#245447;
                      font-size:14px;
                    "
                  >
                    Erik Quisenberry
                  </strong>

                  <br>

                  Chief Operating Officer

                  <br>

                  <strong>
                    CANO LAW FIRM, P.A.
                  </strong>

                  <br><br>

                  <span
                    style="
                      color:#245447;
                      font-size:12px;
                    "
                  >
                    PERSONAL INJURY | IMMIGRATION
                  </span>

                  <br>

                  <strong>
                    A:
                  </strong>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=9100+Coral+Way+Suite+1+Miami+FL+33165"
                    target="_blank"
                    style="
                      color:#1155cc;
                      text-decoration:underline;
                    "
                  >
                    ${escapeHtml(FIRM_ADDRESS)}
                  </a>

                  <br>

                  <strong>
                    P:
                  </strong>
                  <a
                    href="tel:${FIRM_PHONE_HREF}"
                    style="
                      color:#1155cc;
                      text-decoration:underline;
                    "
                  >
                    ${FIRM_PHONE}
                  </a>

                  <br>

                  <strong>
                    E:
                  </strong>
                  <a
                    href="mailto:${CONTACT_EMAIL}"
                    style="
                      color:#1155cc;
                      text-decoration:underline;
                    "
                  >
                    ${CONTACT_EMAIL}
                  </a>

                  &nbsp;&nbsp;

                  <strong>
                    W:
                  </strong>
                  <a
                    href="${FIRM_WEBSITE}"
                    target="_blank"
                    style="
                      color:#1155cc;
                      text-decoration:underline;
                    "
                  >
                    www.canolawfirm.com
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- LEGAL FOOTER -->
        <tr>
          <td
            style="
              padding-top:20px;
            "
          >
            <div
              style="
                border-top:1px solid #c9c9c9;
                padding-top:12px;
                font-family:Arial,Helvetica,sans-serif;
                font-size:9px;
                line-height:1.45;
                color:#4d5156;
              "
            >
              <strong>
                NOTICE:
              </strong>

              The information in this e-mail is confidential and may contain information
              that is attorney-client privileged or exempt from disclosure. It is intended
              only for the use of the individual(s) or entity(ies) to whom it is addressed.
              If you are not an intended recipient, you are hereby notified that any use,
              dissemination, distribution or copying of this communication is strictly
              prohibited. Anyone who receives this message in error should notify the sender
              immediately by telephone or by return e-mail and delete the entire message
              (and any attachments) from their computer. Any opinions or advice contained
              in this email shall be subject to the terms and conditions set forth in the
              Cano Law Firm client engagement agreement.
            </div>

            <div
              style="
                border-top:1px solid #c9c9c9;
                margin-top:12px;
                padding-top:12px;
                font-family:Arial,Helvetica,sans-serif;
                font-size:9px;
                line-height:1.45;
                color:#4d5156;
              "
            >
              <strong>
                IRS Circular 230 Disclosure:
              </strong>

              Please note that the views expressed herein or in any attachments hereto are
              not intended to constitute a "reliance opinion" under applicable Treasury
              Regulations, and accordingly are not intended or written to be used, and may
              not be used or relied upon, for the purpose of (i) avoiding tax-related
              penalties that may be imposed by the Internal Revenue Service, or
              (ii) promoting, marketing or recommending to another party any tax-related
              matters addressed herein.
            </div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
`.trim();

  return {
    subject:
      clean(subject),

    html,

    text:
      `${cleanedBody}${plainTextFooter()}`,

    bookingUrl:
      BOOKING_URL,
  };
}

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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/*
|--------------------------------------------------------------------------
| REMOVE ANY DRAFT-SIDE SIGNATURE
|--------------------------------------------------------------------------
|
| Reach drafts can contain a plain-text signature/footer for review.
| The actual outgoing email uses the branded HTML signature below.
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
| SAFE INLINE LINK RENDERER
|--------------------------------------------------------------------------
|
| This intentionally does NOT run regex replacement over already-built HTML.
| That was what caused the prior malformed booking link to display HTML
| attributes as visible text in Gmail.
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
      html += `
        <a
          href="mailto:${escapeHtml(token)}"
          style="
            color:#234a47;
            text-decoration:underline;
          "
        >
          ${escapeHtml(token)}
        </a>
      `;
    } else {
      html += `
        <a
          href="${escapeHtml(token)}"
          target="_blank"
          style="
            color:#234a47;
            text-decoration:underline;
          "
        >
          ${escapeHtml(token)}
        </a>
      `;
    }

    lastIndex =
      index + token.length;
  }

  html += escapeHtml(
    raw.slice(lastIndex)
  );

  return html;
}

function normalizeBookingParagraph(
  paragraph: string
) {
  if (
    !paragraph
      .toLowerCase()
      .includes(
        BOOKING_URL.toLowerCase()
      )
  ) {
    return {
      isBooking:
        false,
      text:
        paragraph,
    };
  }

  const withoutUrl =
    paragraph
      .replace(
        /https:\/\/canolawfirm\.com\/book\/?/gi,
        ""
      )
      .replace(
        /\s+([,.!?])/g,
        "$1"
      )
      .replace(
        /:\s*$/g,
        "."
      )
      .replace(
        /\s{2,}/g,
        " "
      )
      .trim();

  return {
    isBooking:
      true,
    text:
      withoutUrl,
  };
}

function renderBody(
  body: string
) {
  const paragraphs =
    stripDraftSignature(body)
      .split(/\n{2,}/)
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);

  return paragraphs
    .map((paragraph) => {
      const booking =
        normalizeBookingParagraph(
          paragraph
        );

      const paragraphHtml = `
        <p
          style="
            margin:0 0 ${booking.isBooking ? "16px" : "21px"} 0;
            font-family:Arial,Helvetica,sans-serif;
            font-size:15px;
            line-height:1.72;
            color:#374151;
          "
        >
          ${renderInlineText(
            booking.text
          ).replace(
            /\n/g,
            "<br>"
          )}
        </p>
      `;

      if (!booking.isBooking) {
        return paragraphHtml;
      }

      return `
        ${paragraphHtml}

        <table
          role="presentation"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            margin:0 0 24px 0;
          "
        >
          <tr>
            <td
              bgcolor="#234a47"
              style="
                border-radius:8px;
              "
            >
              <a
                href="${BOOKING_URL}"
                target="_blank"
                style="
                  display:inline-block;
                  padding:13px 20px;
                  font-family:Arial,Helvetica,sans-serif;
                  font-size:14px;
                  line-height:1;
                  font-weight:700;
                  color:#ffffff;
                  text-decoration:none;
                  border-radius:8px;
                "
              >
                Book a 15-Minute Call
              </a>
            </td>
          </tr>
        </table>
      `;
    })
    .join("");
}

function plainTextFooter() {
  return [
    "",
    "Best Regards,",
    "",
    "Erik Quisenberry",
    "Chief Operating Officer",
    "",
    "CANO LAW FIRM, P.A.",
    "PERSONAL INJURY | IMMIGRATION",
    "",
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
  | CANO BRANDED EMAIL
  |--------------------------------------------------------------------------
  |
  | This mirrors the firm's existing payment-email design language:
  | - light gray page background
  | - centered 640px white card
  | - dark Cano green header
  | - generous 34px content padding
  | - clean branded signature
  | - restrained legal footer
  |
  | It intentionally avoids an inline image dependency so Gmail/Titan cannot
  | show a broken CID logo.
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
    background:#f4f5f4;
    font-family:Arial,Helvetica,sans-serif;
    color:#1f2937;
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
    background:#f4f5f4;
    margin:0;
    padding:0;
    border-collapse:collapse;
  "
>
  <tr>
    <td
      align="center"
      style="
        padding:32px 14px;
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
          max-width:640px;
          background:#ffffff;
          border-radius:14px;
          overflow:hidden;
          border:1px solid #e5e7eb;
          border-collapse:separate;
        "
      >

        <!-- CANO HEADER -->
        <tr>
          <td
            bgcolor="#234a47"
            style="
              background:#234a47;
              padding:25px 34px 24px 34px;
            "
          >

            <div
              style="
                font-family:Arial,Helvetica,sans-serif;
                font-size:22px;
                line-height:1.2;
                font-weight:700;
                color:#ffffff;
                letter-spacing:.01em;
              "
            >
              CANO LAW FIRM, P.A.
            </div>

            <div
              style="
                margin-top:6px;
                font-family:Arial,Helvetica,sans-serif;
                font-size:11px;
                line-height:1.4;
                font-weight:600;
                letter-spacing:.10em;
                text-transform:uppercase;
                color:#d9e7e4;
              "
            >
              Personal Injury&nbsp;&nbsp;·&nbsp;&nbsp;Immigration
            </div>

          </td>
        </tr>

        <!-- PERSONAL OUTREACH BODY -->
        <tr>
          <td
            style="
              padding:34px 38px 8px 38px;
            "
          >
            ${htmlBody}
          </td>
        </tr>

        <!-- SUBTLE OPPORTUNITY STRIP -->
        <tr>
          <td
            style="
              padding:0 38px 4px 38px;
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
                border-collapse:separate;
              "
            >
              <tr>
                <td
                  style="
                    background:#f8faf9;
                    border:1px solid #e0e8e6;
                    border-radius:9px;
                    padding:14px 16px;
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:12px;
                    line-height:1.55;
                    color:#5f6b69;
                  "
                >
                  <strong
                    style="
                      color:#234a47;
                    "
                  >
                    Attorney-to-attorney outreach
                  </strong>
                  <br>
                  This note is intended to explore potential professional referral
                  opportunities where our firms may be able to help one another's clients.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SIGNATURE -->
        <tr>
          <td
            style="
              padding:26px 38px 0 38px;
            "
          >

            <div
              style="
                padding-top:22px;
                border-top:1px solid #e1e7e5;
                font-family:Arial,Helvetica,sans-serif;
              "
            >

              <div
                style="
                  margin-bottom:16px;
                  font-size:15px;
                  line-height:1.5;
                  color:#1f2937;
                "
              >
                <strong>
                  Best Regards,
                </strong>
              </div>

              <div
                style="
                  font-size:14px;
                  line-height:1.62;
                  color:#1f2937;
                "
              >

                <strong
                  style="
                    font-size:16px;
                    color:#234a47;
                  "
                >
                  Erik Quisenberry
                </strong>

                <br>

                <span
                  style="
                    color:#596562;
                  "
                >
                  Chief Operating Officer
                </span>

                <br><br>

                <strong
                  style="
                    font-size:16px;
                    color:#234a47;
                  "
                >
                  CANO LAW FIRM, P.A.
                </strong>

                <br>

                <span
                  style="
                    font-size:12px;
                    font-weight:600;
                    color:#52605d;
                    letter-spacing:.03em;
                  "
                >
                  PERSONAL INJURY | IMMIGRATION
                </span>

                <br><br>

                <strong>
                  A:
                </strong>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=9100+Coral+Way+Suite+1+Miami+FL+33165"
                  target="_blank"
                  style="
                    color:#234a47;
                    text-decoration:none;
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
                    color:#234a47;
                    text-decoration:none;
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
                    color:#234a47;
                    text-decoration:none;
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
                    color:#234a47;
                    text-decoration:none;
                  "
                >
                  www.canolawfirm.com
                </a>

              </div>
            </div>
          </td>
        </tr>

        <!-- LEGAL -->
        <tr>
          <td
            style="
              padding:22px 38px 32px 38px;
            "
          >

            <div
              style="
                padding-top:18px;
                border-top:1px solid #e5e9e8;
                font-family:Arial,Helvetica,sans-serif;
                font-size:10px;
                line-height:1.6;
                color:#6b7472;
              "
            >
              <strong
                style="
                  color:#4b5553;
                "
              >
                NOTICE:
              </strong>

              The information in this e-mail is confidential and may contain
              information that is attorney-client privileged or exempt from disclosure.
              It is intended only for the use of the individual(s) or entity(ies) to
              whom it is addressed. If you are not an intended recipient, you are
              hereby notified that any use, dissemination, distribution or copying of
              this communication is strictly prohibited. Anyone who receives this
              message in error should notify the sender immediately by telephone or by
              return e-mail and delete the entire message (and any attachments) from
              their computer. Any opinions or advice contained in this email shall be
              subject to the terms and conditions set forth in the Cano Law Firm client
              engagement agreement.
            </div>

            <div
              style="
                margin-top:15px;
                font-family:Arial,Helvetica,sans-serif;
                font-size:10px;
                line-height:1.6;
                color:#6b7472;
              "
            >
              <strong
                style="
                  color:#4b5553;
                "
              >
                IRS Circular 230 Disclosure:
              </strong>

              Please note that the views expressed herein or in any attachments hereto
              are not intended to constitute a "reliance opinion" under applicable
              Treasury Regulations, and accordingly are not intended or written to be
              used, and may not be used or relied upon, for the purpose of
              (i) avoiding tax-related penalties that may be imposed by the Internal
              Revenue Service, or (ii) promoting, marketing or recommending to another
              party any tax-related matters addressed herein.
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

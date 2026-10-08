const CONTACT_EMAIL =
  "contact@canolawfirm.com";

const BOOKING_URL =
  "https://canolawfirm.com/book/";

export const CANO_EMAIL_LOGO_BASE64 =
  "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";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripDraftSignature(value: string) {
  const normalized =
    String(value || "")
      .replace(/\r\n/g, "\n")
      .trim();

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

function renderInlineText(value: string) {
  let html =
    escapeHtml(value);

  /*
  |--------------------------------------------------------------------------
  | BOOKING LINK
  |--------------------------------------------------------------------------
  |
  | Replace the raw Calendly-style URL with a human label. This keeps the
  | email feeling like a real attorney-to-attorney introduction rather than
  | marketing automation.
  |--------------------------------------------------------------------------
  */

  html = html.replace(
    /https:\/\/canolawfirm\.com\/book\/?/gi,
    `<a href="${BOOKING_URL}" style="color:#0b5f73;text-decoration:underline;font-weight:600;">book a 15-minute call</a>`
  );

  /*
  |--------------------------------------------------------------------------
  | OTHER URLS + EMAILS
  |--------------------------------------------------------------------------
  */

  html = html.replace(
    /(https:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#0b5f73;text-decoration:underline;">$1</a>'
  );

  html = html.replace(
    /(^|\s)([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
    '$1<a href="mailto:$2" style="color:#0b5f73;text-decoration:underline;">$2</a>'
  );

  return html;
}

function renderBody(body: string) {
  const paragraphs =
    stripDraftSignature(body)
      .split(/\n{2,}/)
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);

  return paragraphs
    .map((paragraph) => {
      const content =
        renderInlineText(
          paragraph
        ).replace(
          /\n/g,
          "<br>"
        );

      return `
        <p style="
          margin:0 0 20px 0;
          font-family:Arial,Helvetica,sans-serif;
          font-size:16px;
          line-height:1.62;
          color:#1c2830;
          mso-line-height-rule:exactly;
        ">${content}</p>
      `;
    })
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
    "9100 Coral Way, Suite 1, Miami, FL 33165",
    "(786) 673-0958",
    CONTACT_EMAIL,
    "www.canolawfirm.com",
    "",
    "NOTICE: The information in this e-mail is confidential and may contain information that is attorney-client privileged or exempt from disclosure. It is intended only for the use of the individual(s) or entity(ies) to whom it is addressed. If you are not an intended recipient, you are hereby notified that any use, dissemination, distribution or copying of this communication is strictly prohibited. Anyone who receives this message in error should notify the sender immediately by telephone or by return e-mail and delete the entire message (and any attachments) from their computer. Any opinions or advice contained in this e-mail shall be subject to the terms and conditions set forth in the Cano Law Firm client engagement agreement.",
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
    stripDraftSignature(body);

  const htmlBody =
    renderBody(
      cleanedBody
    );

  /*
  |--------------------------------------------------------------------------
  | EMAIL DESIGN PRINCIPLES
  |--------------------------------------------------------------------------
  |
  | Keep the message itself intentionally simple and human.
  |
  | The polished design lives in:
  | - consistent 640px reading width
  | - professional spacing
  | - compact Cano signature
  | - restrained Cano teal accents
  | - Gmail / Outlook-safe table layout
  |
  | This should look like a well-composed personal email, not a newsletter.
  |--------------------------------------------------------------------------
  */

  const html = `
<!doctype html>
<html>
  <head>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <meta
      name="x-apple-disable-message-reformatting"
    />
  </head>

  <body
    style="
      margin:0;
      padding:0;
      background:#ffffff;
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
          align="center"
          style="
            padding:34px 18px 40px 18px;
          "
        >
          <table
            role="presentation"
            width="640"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width:100%;
              max-width:640px;
              border-collapse:collapse;
              background:#ffffff;
            "
          >
            <!-- MESSAGE -->
            <tr>
              <td
                style="
                  padding:0 2px 14px 2px;
                "
              >
                ${htmlBody}
              </td>
            </tr>

            <!-- SIGNATURE DIVIDER -->
            <tr>
              <td
                style="
                  padding:5px 0 0 0;
                "
              >
                <div
                  style="
                    height:1px;
                    line-height:1px;
                    font-size:1px;
                    background:#dfe5e8;
                  "
                >&nbsp;</div>
              </td>
            </tr>

            <!-- SIGNATURE -->
            <tr>
              <td
                style="
                  padding:22px 0 4px 0;
                "
              >
                <p
                  style="
                    margin:0 0 14px 0;
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:15px;
                    line-height:1.45;
                    font-weight:700;
                    color:#18262d;
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
                    width:100%;
                    border-collapse:collapse;
                  "
                >
                  <tr>
                    <td
                      valign="top"
                      width="178"
                      style="
                        width:178px;
                        padding:0 22px 0 0;
                      "
                    >
                      <img
                        src="cid:cano-law-logo"
                        width="155"
                        alt="Cano Law Firm"
                        style="
                          display:block;
                          width:155px;
                          max-width:155px;
                          height:auto;
                          border:0;
                          outline:none;
                          text-decoration:none;
                        "
                      />
                    </td>

                    <td
                      valign="top"
                      style="
                        padding:0;
                      "
                    >
                      <p
                        style="
                          margin:0 0 3px 0;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:16px;
                          line-height:1.35;
                          font-weight:700;
                          color:#0d5362;
                        "
                      >
                        Erik Quisenberry
                      </p>

                      <p
                        style="
                          margin:0 0 10px 0;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:13px;
                          line-height:1.4;
                          color:#46545b;
                        "
                      >
                        Chief Operating Officer
                      </p>

                      <p
                        style="
                          margin:0 0 2px 0;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:13px;
                          line-height:1.45;
                          font-weight:700;
                          letter-spacing:.01em;
                          color:#203038;
                        "
                      >
                        CANO LAW FIRM, P.A.
                      </p>

                      <p
                        style="
                          margin:0;
                          font-family:Arial,Helvetica,sans-serif;
                          font-size:12px;
                          line-height:1.45;
                          color:#5c6870;
                        "
                      >
                        PERSONAL INJURY&nbsp;&nbsp;|&nbsp;&nbsp;IMMIGRATION
                      </p>
                    </td>
                  </tr>
                </table>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    width:100%;
                    margin-top:16px;
                    border-collapse:collapse;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:0 0 5px 0;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:13px;
                        line-height:1.45;
                        color:#3a474e;
                      "
                    >
                      <strong style="color:#1e3038;">A:</strong>
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=9100+Coral+Way+Suite+1+Miami+FL+33165"
                        style="
                          color:#0d5362;
                          text-decoration:none;
                        "
                      >
                        9100 Coral Way, Suite 1, Miami, FL 33165
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:0 0 5px 0;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:13px;
                        line-height:1.45;
                        color:#3a474e;
                      "
                    >
                      <strong style="color:#1e3038;">P:</strong>
                      <a
                        href="tel:+17866730958"
                        style="
                          color:#3a474e;
                          text-decoration:none;
                        "
                      >
                        (786) 673-0958
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:0;
                        font-family:Arial,Helvetica,sans-serif;
                        font-size:13px;
                        line-height:1.45;
                        color:#3a474e;
                      "
                    >
                      <strong style="color:#1e3038;">E:</strong>
                      <a
                        href="mailto:${CONTACT_EMAIL}"
                        style="
                          color:#0d5362;
                          text-decoration:none;
                        "
                      >
                        ${CONTACT_EMAIL}
                      </a>

                      <span
                        style="
                          color:#a3adb2;
                        "
                      >
                        &nbsp;&nbsp;•&nbsp;&nbsp;
                      </span>

                      <strong style="color:#1e3038;">W:</strong>
                      <a
                        href="https://www.canolawfirm.com"
                        style="
                          color:#0d5362;
                          text-decoration:none;
                        "
                      >
                        canolawfirm.com
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- LEGAL DIVIDER -->
            <tr>
              <td
                style="
                  padding:20px 0 0 0;
                "
              >
                <div
                  style="
                    height:1px;
                    line-height:1px;
                    font-size:1px;
                    background:#e3e8ea;
                  "
                >&nbsp;</div>
              </td>
            </tr>

            <!-- LEGAL -->
            <tr>
              <td
                style="
                  padding:15px 0 0 0;
                "
              >
                <p
                  style="
                    margin:0 0 11px 0;
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:9.5px;
                    line-height:1.55;
                    color:#647178;
                  "
                >
                  <strong
                    style="
                      color:#46545b;
                    "
                  >
                    NOTICE:
                  </strong>
                  The information in this e-mail is confidential and may contain information that is attorney-client privileged or exempt from disclosure. It is intended only for the use of the individual(s) or entity(ies) to whom it is addressed. If you are not an intended recipient, you are hereby notified that any use, dissemination, distribution or copying of this communication is strictly prohibited. Anyone who receives this message in error should notify the sender immediately by telephone or by return e-mail and delete the entire message (and any attachments) from their computer. Any opinions or advice contained in this e-mail shall be subject to the terms and conditions set forth in the Cano Law Firm client engagement agreement.
                </p>

                <p
                  style="
                    margin:0;
                    font-family:Arial,Helvetica,sans-serif;
                    font-size:9.5px;
                    line-height:1.55;
                    color:#647178;
                  "
                >
                  <strong
                    style="
                      color:#46545b;
                    "
                  >
                    IRS Circular 230 Disclosure:
                  </strong>
                  Please note that the views expressed herein or in any attachments hereto are not intended to constitute a "reliance opinion" under applicable Treasury Regulations, and accordingly are not intended or written to be used, and may not be used or relied upon, for the purpose of (i) avoiding tax-related penalties that may be imposed by the Internal Revenue Service, or (ii) promoting, marketing or recommending to another party any tax-related matters addressed herein.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject:
      String(subject || "")
        .trim(),

    html,

    text:
      `${cleanedBody}${plainTextFooter()}`,

    bookingUrl:
      BOOKING_URL,
  };
}

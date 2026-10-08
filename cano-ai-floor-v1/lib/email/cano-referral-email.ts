const CONTACT_EMAIL =
  "contact@canolawfirm.com";

const BOOKING_URL =
  "https://canolawfirm.com/book/";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function linkify(value: string) {
  return escapeHtml(value)
    .replace(
      /(https:\/\/[^\s<]+)/g,
      '<a href="$1" style="color:#0b63ce;text-decoration:underline;">$1</a>'
    )
    .replace(
      /(^|\s)([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
      '$1<a href="mailto:$2" style="color:#0b63ce;text-decoration:underline;">$2</a>'
    );
}

function stripDraftSignature(
  value: string
) {
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
      marker.exec(
        normalized
      );

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

function renderBody(
  body: string
) {
  const cleaned =
    stripDraftSignature(
      body
    );

  const paragraphs =
    cleaned
      .split(/\n{2,}/)
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);

  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.62;color:#1e2b33;">${linkify(
          paragraph
        ).replace(
          /\n/g,
          "<br>"
        )}</p>`
    )
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
    "A: 9100 Coral Way, Suite 1, Miami, FL 33165",
    "P: (786) 673-0958",
    `E: ${CONTACT_EMAIL}    W: www.canolawfirm.com`,
    "",
    "NOTICE: The information in this e-mail is confidential and may contain information that is attorney-client privileged or exempt from disclosure. It is intended only for the use of the individual(s) or entity(ies) to whom it is addressed. If you are not an intended recipient, you are hereby notified that any use, dissemination, distribution or copying of this communication is strictly prohibited. Anyone who receives this message in error should notify the sender immediately by telephone or by return e-mail and delete the entire message (and any attachments) from their computer. Any opinions or advice contained in this e-mail shall be subject to the terms and conditions set forth in the Cano Law Firm client engagement agreement.",
    "",
    "IRS Circular 230 Disclosure: Please note that the views expressed herein or in any attachments hereto are not intended to constitute a \"reliance opinion\" under applicable Treasury Regulations, and accordingly are not intended or written to be used, and may not be used or relied upon, for the purpose of (i) avoiding tax-related penalties that may be imposed by the Internal Revenue Service, or (ii) promoting, marketing or recommending to another party any tax-related matters addressed herein.",
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

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="720" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:720px;background:#ffffff;">
            <tr>
              <td style="padding:0 0 8px 0;">
                ${htmlBody}
              </td>
            </tr>

            <tr>
              <td style="padding:20px 0 0 0;border-top:1px solid #d9dee2;">
                <p style="margin:0 0 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#17242b;">
                  Best Regards,
                </p>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px 0;">
                  <tr>
                    <td style="vertical-align:middle;padding-right:14px;">
                      <div style="width:48px;height:48px;border:2px solid #111111;border-radius:2px;text-align:center;line-height:44px;font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#111111;">
                        C
                      </div>
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:2px;color:#111111;line-height:1;">
                        CANO
                      </div>
                      <div style="margin-top:5px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:5px;color:#111111;">
                        LAW FIRM
                      </div>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0d4d5a;">
                  Erik Quisenberry
                </p>
                <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d2b32;">
                  Chief Operating Officer
                </p>

                <p style="margin:0 0 3px 0;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#0d4d5a;">
                  CANO LAW FIRM, P.A.
                </p>
                <p style="margin:0 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d2b32;">
                  PERSONAL INJURY | IMMIGRATION
                </p>

                <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d2b32;">
                  <strong>A:</strong>
                  <a href="https://www.google.com/maps/search/?api=1&query=9100+Coral+Way+Suite+1+Miami+FL+33165" style="color:#0b63ce;text-decoration:underline;">
                    9100 Coral Way, Suite 1, Miami, FL 33165
                  </a>
                </p>

                <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d2b32;">
                  <strong>P:</strong>
                  <a href="tel:+17866730958" style="color:#1d2b32;text-decoration:none;">(786) 673-0958</a>
                </p>

                <p style="margin:0 0 22px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d2b32;">
                  <strong>E:</strong>
                  <a href="mailto:${CONTACT_EMAIL}" style="color:#1d2b32;text-decoration:none;">${CONTACT_EMAIL}</a>
                  &nbsp;&nbsp;
                  <strong>W:</strong>
                  <a href="https://www.canolawfirm.com" style="color:#1d2b32;text-decoration:none;">www.canolawfirm.com</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 0 0 0;border-top:1px solid #d9dee2;">
                <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.58;color:#394a52;">
                  <strong>NOTICE:</strong> The information in this e-mail is confidential and may contain information that is attorney-client privileged or exempt from disclosure. It is intended only for the use of the individual(s) or entity(ies) to whom it is addressed. If you are not an intended recipient, you are hereby notified that any use, dissemination, distribution or copying of this communication is strictly prohibited. Anyone who receives this message in error should notify the sender immediately by telephone or by return e-mail and delete the entire message (and any attachments) from their computer. Any opinions or advice contained in this e-mail shall be subject to the terms and conditions set forth in the Cano Law Firm client engagement agreement.
                </p>

                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.58;color:#394a52;">
                  <strong>IRS Circular 230 Disclosure:</strong> Please note that the views expressed herein or in any attachments hereto are not intended to constitute a "reliance opinion" under applicable Treasury Regulations, and accordingly are not intended or written to be used, and may not be used or relied upon, for the purpose of (i) avoiding tax-related penalties that may be imposed by the Internal Revenue Service, or (ii) promoting, marketing or recommending to another party any tax-related matters addressed herein.
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

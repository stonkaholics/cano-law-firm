import nodemailer from "nodemailer";

export const runtime = "nodejs";

export type TitanSendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    cid?: string;
    contentType?: string;
  }>;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function getTitanConfig() {
  const host =
    clean(process.env.TITAN_SMTP_HOST) ||
    "smtp.titan.email";

  const port =
    Number(
      process.env.TITAN_SMTP_PORT ||
      465
    ) || 465;

  const user =
    clean(
      process.env.TITAN_SMTP_USER ||
      process.env.TITAN_FROM_EMAIL
    ) ||
    "contact@canolawfirm.com";

  const password =
    clean(
      process.env.TITAN_SMTP_PASSWORD
    );

  const fromName =
    clean(
      process.env.TITAN_FROM_NAME
    ) ||
    "Erik Quisenberry | Cano Law Firm";

  const replyTo =
    clean(
      process.env.TITAN_REPLY_TO
    ) ||
    "contact@canolawfirm.com";

  if (!password) {
    throw new Error(
      "Titan Mail is not configured. Add TITAN_SMTP_PASSWORD in Vercel Environment Variables."
    );
  }

  return {
    host,
    port,
    user,
    password,
    fromName,
    replyTo,
  };
}

export async function sendTitanMail(
  input: TitanSendInput
) {
  const config =
    getTitanConfig();

  const secure =
    config.port === 465;

  const transporter =
    nodemailer.createTransport({
      host:
        config.host,

      port:
        config.port,

      secure,

      requireTLS:
        !secure,

      auth: {
        user:
          config.user,

        pass:
          config.password,
      },

      tls: {
        minVersion:
          "TLSv1.2",
      },
    });

  const info =
    await transporter.sendMail({
      from: {
        name:
          config.fromName,

        address:
          config.user,
      },

      to:
        input.to,

      replyTo:
        input.replyTo ||
        config.replyTo,

      subject:
        input.subject,

      text:
        input.text,

      html:
        input.html,

      attachments:
        input.attachments || [],
    });

  return {
    messageId:
      clean(info.messageId),

    accepted:
      Array.isArray(
        info.accepted
      )
        ? info.accepted.map(String)
        : [],

    rejected:
      Array.isArray(
        info.rejected
      )
        ? info.rejected.map(String)
        : [],

    response:
      clean(info.response),

    envelope:
      info.envelope || null,

    sender:
      config.user,
  };
}

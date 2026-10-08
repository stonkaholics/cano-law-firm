import nodemailer from "nodemailer";

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

type TitanConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  fromName: string;
  replyTo: string;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

export function getTitanPublicStatus() {
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

  const hasPassword =
    Boolean(
      clean(
        process.env.TITAN_SMTP_PASSWORD
      )
    );

  return {
    provider: "titan_mail",
    configured: hasPassword,
    host,
    port,
    secure: port === 465,
    user,
    fromName,
    replyTo,
    passwordConfigured: hasPassword,
  };
}

function getTitanConfig(): TitanConfig {
  const status =
    getTitanPublicStatus();

  const password =
    clean(
      process.env.TITAN_SMTP_PASSWORD
    );

  if (!password) {
    throw new Error(
      "Titan Mail is not configured. Add TITAN_SMTP_PASSWORD in Vercel Environment Variables and redeploy."
    );
  }

  return {
    host: status.host,
    port: status.port,
    user: status.user,
    password,
    fromName: status.fromName,
    replyTo: status.replyTo,
  };
}

function createTitanTransporter(
  config: TitanConfig
) {
  const secure =
    config.port === 465;

  return nodemailer.createTransport({
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

    connectionTimeout:
      15000,

    greetingTimeout:
      15000,

    socketTimeout:
      30000,
  });
}

function friendlyTitanError(
  error: unknown
) {
  const raw =
    error instanceof Error
      ? error.message
      : String(error || "");

  const lower =
    raw.toLowerCase();

  if (
    lower.includes("invalid login") ||
    lower.includes("authentication") ||
    lower.includes("535") ||
    lower.includes("ea uth")
  ) {
    return (
      "Titan rejected the SMTP login. Confirm TITAN_SMTP_USER is the full mailbox address, " +
      "TITAN_SMTP_PASSWORD is the correct mailbox/app password, and third-party email access is enabled in Titan."
    );
  }

  if (
    lower.includes("timeout") ||
    lower.includes("etimedout") ||
    lower.includes("econnrefused") ||
    lower.includes("socket")
  ) {
    return (
      "The app could not connect to Titan SMTP. Confirm smtp.titan.email with port 465 (SSL) or try port 587 (STARTTLS)."
    );
  }

  return raw ||
    "Titan Mail returned an unknown SMTP error.";
}

export async function verifyTitanMailConnection() {
  try {
    const config =
      getTitanConfig();

    const transporter =
      createTitanTransporter(
        config
      );

    await transporter.verify();

    return {
      ok: true,
      provider:
        "titan_mail",
      sender:
        config.user,
      host:
        config.host,
      port:
        config.port,
      secure:
        config.port === 465,
    };
  } catch (error) {
    return {
      ok: false,
      provider:
        "titan_mail",
      error:
        friendlyTitanError(
          error
        ),
    };
  }
}

export async function sendTitanMail(
  input: TitanSendInput
) {
  const config =
    getTitanConfig();

  const transporter =
    createTitanTransporter(
      config
    );

  try {
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
  } catch (error) {
    throw new Error(
      friendlyTitanError(
        error
      )
    );
  }
}

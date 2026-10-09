import {
  ImapFlow,
} from "imapflow";

import {
  simpleParser,
} from "mailparser";

function clean(
  value: unknown
) {
  return String(
    value || ""
  ).trim();
}

function numberValue(
  value: unknown,
  fallback: number
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}

export function getTitanInboxStatus() {
  const host =
    clean(
      process.env
        .TITAN_IMAP_HOST
    ) ||
    "imap.titan.email";

  const port =
    numberValue(
      process.env
        .TITAN_IMAP_PORT,
      993
    );

  const user =
    clean(
      process.env
        .TITAN_IMAP_USER
    ) ||
    clean(
      process.env
        .TITAN_SMTP_USER
    ) ||
    clean(
      process.env
        .TITAN_FROM_EMAIL
    ) ||
    "contact@canolawfirm.com";

  const password =
    clean(
      process.env
        .TITAN_IMAP_PASSWORD
    ) ||
    clean(
      process.env
        .TITAN_SMTP_PASSWORD
    );

  return {
    provider:
      "titan_mail",
    configured:
      Boolean(
        user &&
        password
      ),
    host,
    port,
    secure:
      port === 993,
    user,
    passwordConfigured:
      Boolean(
        password
      ),
  };
}

function getConfig() {
  const status =
    getTitanInboxStatus();

  const password =
    clean(
      process.env
        .TITAN_IMAP_PASSWORD
    ) ||
    clean(
      process.env
        .TITAN_SMTP_PASSWORD
    );

  if (
    !status.configured ||
    !password
  ) {
    throw new Error(
      "Titan inbox tracking is not configured. Add TITAN_IMAP_HOST=imap.titan.email, TITAN_IMAP_PORT=993, TITAN_IMAP_USER=contact@canolawfirm.com, and TITAN_IMAP_PASSWORD. TITAN_IMAP_PASSWORD may use the same mailbox/app password as TITAN_SMTP_PASSWORD."
    );
  }

  return {
    host:
      status.host,
    port:
      status.port,
    secure:
      status.secure,
    user:
      status.user,
    password,
  };
}

function normalizeMessageId(
  value: unknown
) {
  return clean(value)
    .replace(
      /^<|>$/g,
      ""
    )
    .toLowerCase();
}

function uniqueStrings(
  values: unknown[]
) {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            normalizeMessageId(
              value
            )
        )
        .filter(
          Boolean
        )
    )
  );
}

function addressList(
  input: any
) {
  const value =
    input?.value;

  return Array.isArray(
    value
  )
    ? value
        .map(
          (row: any) => ({
            name:
              clean(
                row?.name
              ),
            address:
              clean(
                row?.address
              )
                .toLowerCase(),
          })
        )
        .filter(
          (row) =>
            row.address
        )
    : [];
}

function plainText(
  parsed: any
) {
  const text =
    clean(
      parsed?.text
    );

  if (text) {
    return text;
  }

  const html =
    clean(
      parsed?.html
    );

  if (!html) {
    return "";
  }

  return html
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<br\s*\/?>/gi,
      "\n"
    )
    .replace(
      /<\/p>/gi,
      "\n"
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .replace(
      /[ \t]{2,}/g,
      " "
    )
    .trim();
}

function trimQuotedReply(
  value: string
) {
  const markers = [
    /\nOn .+wrote:\s*$/im,
    /\nFrom:\s.+$/im,
    /\n-----Original Message-----/im,
    /\n_{5,}/m,
  ];

  let result =
    value;

  for (
    const marker of
    markers
  ) {
    const match =
      result.match(
        marker
      );

    if (
      match &&
      typeof match.index ===
        "number" &&
      match.index > 20
    ) {
      result =
        result.slice(
          0,
          match.index
        );
    }
  }

  return result
    .trim()
    .slice(
      0,
      20000
    );
}

export type TitanInboxMessage = {
  uid: number;
  messageId: string;
  inReplyTo: string;
  references: string[];
  subject: string;
  date: string;
  from: Array<{
    name: string;
    address: string;
  }>;
  to: Array<{
    name: string;
    address: string;
  }>;
  cc: Array<{
    name: string;
    address: string;
  }>;
  replyTo: Array<{
    name: string;
    address: string;
  }>;
  text: string;
};

export async function fetchRecentTitanInbox(input?: {
  days?: number;
  limit?: number;
}) {
  const config =
    getConfig();

  const client =
    new ImapFlow({
      host:
        config.host,
      port:
        config.port,
      secure:
        config.secure,
      auth: {
        user:
          config.user,
        pass:
          config.password,
      },
      logger:
        false,
      tls: {
        rejectUnauthorized:
          true,
      },
    });

  const days =
    Math.max(
      1,
      Math.min(
        30,
        Number(
          input?.days ||
          14
        )
      )
    );

  const limit =
    Math.max(
      10,
      Math.min(
        250,
        Number(
          input?.limit ||
          100
        )
      )
    );

  const since =
    new Date(
      Date.now() -
      days *
        24 *
        60 *
        60 *
        1000
    );

  const messages:
    TitanInboxMessage[] =
    [];

  try {
    await client.connect();

    const lock =
      await client.getMailboxLock(
        "INBOX"
      );

    try {
      const uids =
        await client.search({
          since,
        });

      const selected =
        uids
          .slice(
            -limit
          );

      for await (
        const row of
        client.fetch(
          selected,
          {
            uid:
              true,
            source:
              true,
          },
          {
            uid:
              true,
          }
        )
      ) {
        if (!row.source) {
          continue;
        }

        const parsed =
          await simpleParser(
            row.source
          );

        const referencesRaw =
          Array.isArray(
            parsed.references
          )
            ? parsed.references
            : parsed.references
            ? [
                parsed.references,
              ]
            : [];

        messages.push({
          uid:
            Number(
              row.uid
            ),

          messageId:
            normalizeMessageId(
              parsed.messageId
            ),

          inReplyTo:
            normalizeMessageId(
              parsed.inReplyTo
            ),

          references:
            uniqueStrings(
              referencesRaw
            ),

          subject:
            clean(
              parsed.subject
            ),

          date:
            (
              parsed.date ||
              new Date()
            ).toISOString(),

          from:
            addressList(
              parsed.from
            ),

          to:
            addressList(
              parsed.to
            ),

          cc:
            addressList(
              parsed.cc
            ),

          replyTo:
            addressList(
              parsed.replyTo
            ),

          text:
            trimQuotedReply(
              plainText(
                parsed
              )
            ),
        });
      }
    } finally {
      lock.release();
    }

    return messages.sort(
      (
        a,
        b
      ) =>
        new Date(
          a.date
        ).getTime() -
        new Date(
          b.date
        ).getTime()
    );
  } finally {
    await client.logout()
      .catch(
        () => undefined
      );
  }
}

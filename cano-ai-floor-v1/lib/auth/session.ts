const SESSION_COOKIE = "cano_session";
const SESSION_DAYS = 7;

export type CanoSessionPayload = {
  v: 1;
  sub: string;
  email: string;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.CANO_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "Missing CANO_SESSION_SECRET or it is too short. Use at least 32 random characters."
    );
  }

  return secret;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized =
    value.replace(/-/g, "+").replace(/_/g, "/");

  const padding =
    normalized.length % 4
      ? "=".repeat(4 - (normalized.length % 4))
      : "";

  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function importHmacKey() {
  const secret = getSessionSecret();

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

async function signValue(value: string) {
  const key = await importHmacKey();

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return encodeBase64Url(
    new Uint8Array(signature)
  );
}

export async function createCanoSessionToken(input: {
  sub: string;
  email: string;
}) {
  const payload: CanoSessionPayload = {
    v: 1,
    sub: input.sub,
    email: input.email.trim().toLowerCase(),
    exp:
      Math.floor(Date.now() / 1000) +
      SESSION_DAYS * 24 * 60 * 60,
  };

  const payloadPart = encodeBase64Url(
    new TextEncoder().encode(
      JSON.stringify(payload)
    )
  );

  const signaturePart =
    await signValue(payloadPart);

  return `${payloadPart}.${signaturePart}`;
}

export async function verifyCanoSessionToken(
  token?: string | null
): Promise<CanoSessionPayload | null> {
  if (!token) return null;

  try {
    const [payloadPart, signaturePart] =
      token.split(".");

    if (!payloadPart || !signaturePart) {
      return null;
    }

    const key = await importHmacKey();

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signaturePart),
      new TextEncoder().encode(payloadPart)
    );

    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(
        decodeBase64Url(payloadPart)
      )
    ) as CanoSessionPayload;

    if (
      payload?.v !== 1 ||
      !payload?.sub ||
      !payload?.email ||
      !payload?.exp
    ) {
      return null;
    }

    if (
      payload.exp <=
      Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export const CANO_SESSION_COOKIE =
  SESSION_COOKIE;

export const CANO_SESSION_MAX_AGE =
  SESSION_DAYS * 24 * 60 * 60;

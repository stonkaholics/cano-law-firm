"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import styles from "./login.module.css";

import {
  createAuthBrowserClient,
} from "../../lib/supabase/auth-browser";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default function LoginPage() {
  const [nextPath, setNextPath] = useState("/");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    setNextPath(
      safeNextPath(params.get("next"))
    );

    setError(
      params.get("error") || ""
    );
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const supabase = createAuthBrowserClient();

      /*
      | Fail with a useful message instead of leaving the button spinning
      | forever if the Auth endpoint stalls.
      */
      const loginPromise =
        supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      const timeoutPromise =
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(
              new Error(
                "Login timed out while contacting Supabase Auth. Please try again."
              )
            );
          }, 15000);
        });

      const {
        data,
        error: signInError,
      } = await Promise.race([
        loginPromise,
        timeoutPromise,
      ]);

      if (signInError) {
        throw signInError;
      }

      if (!data?.session) {
        throw new Error(
          "Supabase did not return an authenticated session."
        );
      }

      /*
      | createBrowserClient writes the Supabase SSR auth cookies.
      | Use a full navigation so middleware receives those cookies on the
      | protected request.
      */
      window.location.assign(nextPath);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in."
      );

      setSubmitting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.glow} />

      <section className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.mark}>C</div>

          <div>
            <span>CANO LAW FIRM</span>
            <strong>AI Legal Operations</strong>
          </div>
        </div>

        <div className={styles.security}>
          <ShieldCheck size={17} />
          <span>Secure internal access</span>
        </div>

        <div className={styles.heading}>
          <div className={styles.icon}>
            <LockKeyhole size={22} />
          </div>

          <div>
            <span>AUTHENTICATION REQUIRED</span>
            <h1>Sign in to Cano AI</h1>
            <p>
              Access is limited to authorized Cano Law Firm personnel.
            </p>
          </div>
        </div>

        {error ? (
          <div className={styles.error}>
            {error}
          </div>
        ) : null}

        <form
          className={styles.form}
          onSubmit={handleSubmit}
        >
          <label>
            <span>Email</span>

            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              disabled={submitting}
              placeholder="name@canolawfirm.com"
            />
          </label>

          <label>
            <span>Password</span>

            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              disabled={submitting}
              placeholder="••••••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2
                  size={15}
                  className="spin"
                />
                Signing In...
              </>
            ) : (
              <>
                <LockKeyhole size={15} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className={styles.notice}>
          <strong>Confidential system</strong>

          <p>
            Client and matter information may be privileged or otherwise
            confidential. Do not share account credentials or leave an
            authenticated session unattended.
          </p>
        </div>
      </section>
    </main>
  );
}

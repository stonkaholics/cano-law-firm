"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import styles from "./login.module.css";

import {
  createAuthBrowserClient,
} from "../../lib/supabase/auth-browser";

function safeNextPath(
  value: string | null
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}

export default function LoginPage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const next =
    useMemo(
      () =>
        safeNextPath(
          searchParams.get("next")
        ),
      [searchParams]
    );

  const initialError =
    searchParams.get("error") ||
    "";

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState(initialError);

  const [submitting, setSubmitting] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const supabase =
        createAuthBrowserClient();

      const {
        data,
        error:
          signInError,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              email
                .trim()
                .toLowerCase(),

            password,
          });

      if (signInError) {
        throw signInError;
      }

      if (!data?.session) {
        throw new Error(
          "Supabase did not return a login session."
        );
      }

      /*
      | @supabase/ssr writes the auth cookies in the browser.
      | Refreshing after router replacement makes middleware validate the
      | freshly-created session on the protected destination.
      */
      router.replace(next);
      router.refresh();
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in.";

      setError(
        message ||
          "Unable to sign in."
      );

      setSubmitting(false);
    }
  }

  return (
    <main
      className={
        styles.shell
      }
    >
      <div
        className={
          styles.glow
        }
      />

      <section
        className={
          styles.card
        }
      >
        <div
          className={
            styles.brand
          }
        >
          <div
            className={
              styles.mark
            }
          >
            C
          </div>

          <div>
            <span>
              CANO LAW FIRM
            </span>

            <strong>
              AI Legal Operations
            </strong>
          </div>
        </div>

        <div
          className={
            styles.security
          }
        >
          <ShieldCheck
            size={17}
          />

          <span>
            Secure internal access
          </span>
        </div>

        <div
          className={
            styles.heading
          }
        >
          <div
            className={
              styles.icon
            }
          >
            <LockKeyhole
              size={22}
            />
          </div>

          <div>
            <span>
              AUTHENTICATION REQUIRED
            </span>

            <h1>
              Sign in to Cano AI
            </h1>

            <p>
              Access is limited to
              authorized Cano Law Firm
              personnel.
            </p>
          </div>
        </div>

        {error ? (
          <div
            className={
              styles.error
            }
          >
            {error}
          </div>
        ) : null}

        <form
          className={
            styles.form
          }
          onSubmit={
            handleSubmit
          }
        >
          <label>
            <span>
              Email
            </span>

            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              disabled={
                submitting
              }
              placeholder="name@canolawfirm.com"
            />
          </label>

          <label>
            <span>
              Password
            </span>

            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              disabled={
                submitting
              }
              placeholder="••••••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={
              submitting
            }
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
                <LockKeyhole
                  size={15}
                />
                Sign In
              </>
            )}
          </button>
        </form>

        <div
          className={
            styles.notice
          }
        >
          <strong>
            Confidential system
          </strong>

          <p>
            Client and matter information
            may be privileged or otherwise
            confidential. Do not share
            account credentials or leave
            an authenticated session
            unattended.
          </p>
        </div>
      </section>
    </main>
  );
}

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
  const [nextPath, setNextPath] =
    useState("/");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    setNextPath(
      safeNextPath(
        params.get("next")
      )
    );

    setError(
      params.get("error") ||
        ""
    );
  }, []);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/auth/login",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email,
                password,
                next:
                  nextPath,
              }),

            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        data?.ok === false
      ) {
        throw new Error(
          data?.error ||
            "Unable to sign in."
        );
      }

      /*
      | The server has already set Cano's signed HttpOnly cookie.
      | No Supabase browser SDK or auth round-trip is needed here.
      */
      window.location.replace(
        safeNextPath(
          data?.next ||
            nextPath
        )
      );
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

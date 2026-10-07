import { LockKeyhole, ShieldCheck } from "lucide-react";
import styles from "./login.module.css";

function safeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params?.next);

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

        {params?.error ? (
          <div className={styles.error}>{params.error}</div>
        ) : null}

        <form
          className={styles.form}
          action="/api/auth/login"
          method="post"
        >
          <input
            type="hidden"
            name="next"
            value={next}
          />

          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
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
              placeholder="••••••••••••"
            />
          </label>

          <button type="submit">
            <LockKeyhole size={15} />
            Sign In
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

import {
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import styles from "./AuthUserMenu.module.css";

export default function AuthUserMenu({
  email,
}: {
  email: string;
}) {
  return (
    <aside
      className={
        styles.menu
      }
      aria-label="Authenticated Cano AI session"
    >
      <div
        className={
          styles.secure
        }
        title="Authenticated Cano AI session"
      >
        <ShieldCheck
          size={13}
        />

        <span>
          Secure Session
        </span>
      </div>

      <div
        className={
          styles.identity
        }
        title={email}
      >
        <UserRound
          size={14}
        />

        <span>
          {email}
        </span>
      </div>

      <form
        action="/api/auth/logout"
        method="post"
      >
        <button
          className={
            styles.logout
          }
          type="submit"
          title="Sign out of Cano AI"
        >
          <LogOut
            size={14}
          />

          <span>
            Sign Out
          </span>
        </button>
      </form>
    </aside>
  );
}

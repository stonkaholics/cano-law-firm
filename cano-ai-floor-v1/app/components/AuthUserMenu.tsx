import { LogOut, ShieldCheck, UserRound } from "lucide-react";

export default function AuthUserMenu({
  email,
}: {
  email: string;
}) {
  return (
    <div className="cano-auth-user">
      <div
        className="cano-auth-user-status"
        title="Authenticated Cano AI session"
      >
        <ShieldCheck size={13} />
        <span>SECURE SESSION</span>
      </div>

      <div className="cano-auth-user-identity">
        <UserRound size={14} />
        <span>{email}</span>
      </div>

      <form action="/api/auth/logout" method="post">
        <button type="submit" title="Sign out">
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </form>
    </div>
  );
}

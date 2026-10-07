import type { Metadata } from "next";
import "./globals.css";
import FloorSwitcher from "./components/FloorSwitcher";
import AuthUserMenu from "./components/AuthUserMenu";
import { createAuthServerClient } from "../lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "Cano Law Firm | AI Legal Operations Floor",
  description: "Cano Law Firm AI legal operations command center",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let userEmail = "";

  try {
    const supabase = await createAuthServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    userEmail = user?.email || "";
  } catch {
    // Middleware handles missing/incomplete auth configuration.
  }

  return (
    <html lang="en">
      <body>
        {userEmail ? (
          <>
            <FloorSwitcher />
            <AuthUserMenu email={userEmail} />
          </>
        ) : null}

        {children}
      </body>
    </html>
  );
}

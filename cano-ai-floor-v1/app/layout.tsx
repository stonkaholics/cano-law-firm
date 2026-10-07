import type {
  Metadata,
} from "next";

import {
  headers,
} from "next/headers";

import "./globals.css";

import FloorSwitcher from "./components/FloorSwitcher";

import AuthUserMenu from "./components/AuthUserMenu";

export const metadata: Metadata = {
  title:
    "Cano Law Firm | AI Legal Operations Floor",

  description:
    "Cano Law Firm AI legal operations command center",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
  | Middleware already validated the Supabase session.
  | Read the verified identity it forwarded instead of calling
  | supabase.auth.getUser() a second time.
  */
  const requestHeaders =
    await headers();

  const userEmail =
    requestHeaders.get(
      "x-cano-user-email"
    ) || "";

  return (
    <html lang="en">
      <body>
        {userEmail ? (
          <>
            <FloorSwitcher />

            <AuthUserMenu
              email={
                userEmail
              }
            />
          </>
        ) : null}

        {children}
      </body>
    </html>
  );
}

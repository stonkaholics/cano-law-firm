import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cano Law Firm | AI Legal Operations Floor",
  description: "Cano Law Firm AI legal operations command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { ReactNode } from "react";
import ReachWorkstationBridge from "./ReachWorkstation";

export default function PersonalInjuryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <ReachWorkstationBridge />
    </>
  );
}

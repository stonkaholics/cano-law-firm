import type { ReactNode } from "react";
import ReachWorkstationBridge from "./ReachWorkstation";
import GuardWorkstationBridge from "./GuardWorkstation";

export default function PersonalInjuryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <ReachWorkstationBridge />
      <GuardWorkstationBridge />
    </>
  );
}

import type { ReactNode } from "react";
import ReachWorkstationBridge from "./ReachWorkstation";
import GuardWorkstationBridge from "./GuardWorkstation";
import ScoutDiscoveryEnhancer from "./ScoutDiscoveryEnhancer";

export default function PersonalInjuryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}

      {/*
        PI-only client bridges.
        Nothing here changes the Immigration floor.
      */}
      <ScoutDiscoveryEnhancer />
      <ReachWorkstationBridge />
      <GuardWorkstationBridge />
    </>
  );
}

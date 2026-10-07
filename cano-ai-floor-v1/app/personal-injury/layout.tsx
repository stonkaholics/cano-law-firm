import type { ReactNode } from "react";
import ReferralOutreachEnhancer from "./ReferralOutreachEnhancer";

export default function PersonalInjuryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <ReferralOutreachEnhancer />
    </>
  );
}

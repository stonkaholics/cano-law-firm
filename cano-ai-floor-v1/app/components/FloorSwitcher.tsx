"use client";

import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import styles from "./FloorSwitcher.module.css";

export default function FloorSwitcher() {
  const pathname = usePathname();

  // Floor 01 remains the main/default floor.
  // Floor 02 already has its own "Immigration Floor" button,
  // so this global switcher only renders on the Immigration home page.
  if (pathname !== "/") {
    return null;
  }

  return (
    <a
      className={styles.switcher}
      href="/personal-injury"
      aria-label="Open Personal Injury Growth Floor"
    >
      <span className={styles.liveDot} />
      <Activity size={14} strokeWidth={1.9} />
      <span>Personal Injury</span>
      <strong>Floor 02</strong>
    </a>
  );
}

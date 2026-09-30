"use client";

import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import styles from "./FloorSwitcher.module.css";

export default function FloorSwitcher() {
  const pathname = usePathname();

  // Immigration remains the main/default floor.
  // Only show the PI switch on the Immigration home page.
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
      <span className={styles.label}>Personal Injury</span>
      <strong>Floor 02</strong>
    </a>
  );
}

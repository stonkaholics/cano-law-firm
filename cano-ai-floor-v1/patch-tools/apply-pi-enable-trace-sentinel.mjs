import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(
  process.cwd(),
  "app",
  "personal-injury",
  "page.tsx"
);

if (!fs.existsSync(pagePath)) {
  throw new Error(
    "Pulse Trace/Sentinel enable patch: page.tsx not found."
  );
}

let source =
  fs.readFileSync(
    pagePath,
    "utf8"
  );

const MARKER =
  "PULSE_ENABLE_TRACE_SENTINEL_V1";

if (
  !source.includes(
    `/* ${MARKER} */`
  )
) {
  const oldTrace =
`          <button
            onClick={() => onRunTrace?.(incident.id)}
            disabled={
              Boolean(runningAgent) ||
              !onRunTrace ||
              !(identityKnown || reportAccessible || caseNumber || reportNumber)
            }
            title="Resolve verified party identity and source-traceable contact candidates."
          >`;

  const newTrace =
`          {/* ${MARKER} */}
          <button
            onClick={() => onRunTrace?.(incident.id)}
            disabled={
              Boolean(runningAgent) ||
              !onRunTrace
            }
            title={
              identityKnown || reportAccessible || caseNumber || reportNumber
                ? "Run Trace against the current incident and available Records context."
                : "Run Trace now. If a verified identity-bearing source is missing, Trace will hand the incident back to Records automatically."
            }
          >`;

  const oldSentinel =
`          <button
            onClick={() => onRunSentinel?.(incident.id)}
            disabled={
              Boolean(runningAgent) ||
              !onRunSentinel ||
              !contactKnown
            }
            title="Review provenance, identity/contact confidence, representation, and timing gates."
          >`;

  const newSentinel =
`          <button
            onClick={() => onRunSentinel?.(incident.id)}
            disabled={
              Boolean(runningAgent) ||
              !onRunSentinel
            }
            title={
              contactKnown
                ? "Run Sentinel final review on the current identity/contact package."
                : "Run Sentinel now to review provenance, missing-data blockers, timing gates, and whether the incident should return to Records or Trace."
            }
          >`;

  if (!source.includes(oldTrace)) {
    throw new Error(
      "Pulse Trace/Sentinel enable patch: Trace button anchor not found."
    );
  }

  if (!source.includes(oldSentinel)) {
    throw new Error(
      "Pulse Trace/Sentinel enable patch: Sentinel button anchor not found."
    );
  }

  source =
    source.replace(
      oldTrace,
      newTrace
    );

  source =
    source.replace(
      oldSentinel,
      newSentinel
    );
}

fs.writeFileSync(
  pagePath,
  source,
  "utf8"
);

console.log(
  "Enabled Pulse Run Trace and Run Sentinel controls for all incidents."
);

import fs from "node:fs";
import crypto from "node:crypto";

const files = {
  reach: "app/personal-injury/ReachWorkstation.tsx",
  guard: "app/personal-injury/GuardWorkstation.tsx",
};

const expected = {
  reach: "f0408e725700705530527778a65013e12111369d",
  guard: "d98d99d2e43c360ee7b3d675bf96ddd2a288f8c3",
};

function gitBlobSha(text) {
  const data = Buffer.from(text, "utf8");
  return crypto
    .createHash("sha1")
    .update(Buffer.concat([
      Buffer.from(`blob ${data.length}\0`),
      data,
    ]))
    .digest("hex");
}

function replaceOnce(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) {
    throw new Error(`PI Outreach V2 patch target not found: ${label}`);
  }
  return source.replace(oldValue, newValue);
}

function readAndGuard(path, expectedSha, marker) {
  const source = fs.readFileSync(path, "utf8");

  if (source.includes(marker)) {
    return { source, alreadyPatched: true };
  }

  const sha = gitBlobSha(source);

  if (sha !== expectedSha) {
    throw new Error(
      `PI Outreach V2 ABORT: ${path} changed since this patch was built. ` +
      `Expected ${expectedSha}, found ${sha}. Nothing was written to that file.`
    );
  }

  return { source, alreadyPatched: false };
}

function patchReach(source) {
  let next = source;

  next = replaceOnce(
    next,
    '  Sparkles,\n  UserRoundCheck,',
    '  Sparkles,\n  TestTube2,\n  Trash2,\n  UserRoundCheck,',
    "Reach imports"
  );

  next = replaceOnce(
    next,
    '  const [notice, setNotice] = useState("");\n  const [error, setError] = useState("");',
    '  const [notice, setNotice] = useState("");\n  const [error, setError] = useState("");\n  const [sendingId, setSendingId] = useState<string | null>(null);\n  const [deletingId, setDeletingId] = useState<string | null>(null);',
    "Reach state"
  );

  const insertionPoint =
    '  const findDraftForTarget = useCallback(\n';

  const actions = `  const deleteDraft = useCallback(
    async (draft: OutreachEvent) => {
      if (
        clean(draft.status).toLowerCase() === "sent" ||
        clean(draft.metadata?.send_status).toLowerCase() === "sent"
      ) {
        setError(
          "Sent outreach is kept for audit history and cannot be deleted."
        );
        return;
      }

      const confirmed =
        window.confirm(
          "Delete this Reach draft and its Guard review records? This is intended for test/unused drafts."
        );

      if (!confirmed) return;

      setDeletingId(draft.id);
      setError("");
      setNotice("Deleting Reach draft…");

      try {
        const response = await fetch(
          "/api/pi/outreach/delete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              outreachEventId: draft.id,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || data?.ok === false) {
          throw new Error(
            data?.error || "Unable to delete Reach draft."
          );
        }

        setSelectedDraft(null);
        await loadWorkspace();
        setNotice("Reach draft deleted.");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to delete Reach draft."
        );
      } finally {
        setDeletingId(null);
      }
    },
    [loadWorkspace]
  );

  const sendDraft = useCallback(
    async (
      draft: OutreachEvent,
      mode: "test" | "send"
    ) => {
      if (
        clean(draft.status).toLowerCase() !== "approved"
      ) {
        setError(
          "Guard and a human reviewer must approve this draft before Titan Mail can send it."
        );
        return;
      }

      let testTo = "";

      if (mode === "test") {
        testTo =
          clean(
            window.prompt(
              "Send the exact formatted test email to:",
              "contact@canolawfirm.com"
            )
          );

        if (!testTo) return;
      } else {
        const recipient =
          clean(
            draft.metadata?.recipient_email
          );

        const confirmed =
          window.confirm(
            \`Send this approved email through Titan Mail from contact@canolawfirm.com to \${recipient}?\`
          );

        if (!confirmed) return;
      }

      setSendingId(draft.id);
      setError("");
      setNotice(
        mode === "test"
          ? "Sending Titan Mail test…"
          : "Sending approved outreach through Titan Mail…"
      );

      try {
        const response = await fetch(
          "/api/pi/outreach/send",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              outreachEventId: draft.id,
              mode,
              ...(mode === "test"
                ? { testTo }
                : {}),
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || data?.ok === false) {
          throw new Error(
            data?.error || "Titan Mail send failed."
          );
        }

        if (mode === "test") {
          setNotice(
            \`Test email sent through Titan Mail to \${data.recipient}. Check the inbox formatting before sending officially.\`
          );
        } else {
          setSelectedDraft(null);
          await loadWorkspace();
          setNotice(
            \`Email sent through Titan Mail to \${data.recipient}. The referral is now Contacted and ready for Orbit follow-up.\`
          );
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Titan Mail send failed."
        );
      } finally {
        setSendingId(null);
      }
    },
    [loadWorkspace]
  );

`;

  next = replaceOnce(
    next,
    insertionPoint,
    actions + insertionPoint,
    "Reach action functions"
  );

  next = replaceOnce(
    next,
`  const pendingDrafts =
    reachDrafts.filter(
      (item) =>
        clean(
          item.status
        ).toLowerCase() ===
        "draft"
    );
`,
`  const pendingDrafts =
    reachDrafts.filter(
      (item) =>
        clean(
          item.status
        ).toLowerCase() ===
        "draft"
    );

  const activeReachDrafts =
    reachDrafts.filter(
      (item) =>
        [
          "draft",
          "approved",
        ].includes(
          clean(
            item.status
          ).toLowerCase()
        )
    );

  const readyToSend =
    activeReachDrafts.filter(
      (item) =>
        clean(
          item.status
        ).toLowerCase() ===
        "approved"
    );
`,
    "Reach active queue"
  );

  next = replaceOnce(
    next,
`                {
                  pendingDrafts.length
                }`,
`                {
                  activeReachDrafts.length
                }`,
    "Reach queue count"
  );

  next = replaceOnce(
    next,
`              {reachDrafts.length ? (
                reachDrafts`,
`              {activeReachDrafts.length ? (
                activeReachDrafts`,
    "Reach queue source"
  );

  next = replaceOnce(
    next,
`                DRAFT SAVED · SEND NOT ENABLED`,
`                {clean(
                  selectedDraft.status
                ).toLowerCase() ===
                "approved"
                  ? "HUMAN APPROVED · READY TO SEND VIA TITAN"
                  : "DRAFT SAVED · WAITING FOR GUARD + HUMAN APPROVAL"}`,
    "Reach send status"
  );

  const oldClose =
`                <button
                  onClick={() =>
                    setSelectedDraft(
                      null
                    )
                  }
                >
                  <X
                    size={17}
                  />
                </button>`;

  const newClose =
`                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    title="Delete test / unused draft"
                    aria-label="Delete draft"
                    disabled={
                      deletingId === selectedDraft.id ||
                      clean(selectedDraft.status).toLowerCase() === "sent"
                    }
                    onClick={() =>
                      void deleteDraft(
                        selectedDraft
                      )
                    }
                    style={{
                      opacity:
                        deletingId === selectedDraft.id
                          ? 0.45
                          : 1,
                    }}
                  >
                    <Trash2 size={16} />
                  </button>

                  <button
                    onClick={() =>
                      setSelectedDraft(
                        null
                      )
                    }
                  >
                    <X
                      size={17}
                    />
                  </button>
                </div>`;

  next = replaceOnce(
    next,
    oldClose,
    newClose,
    "Reach review header"
  );

  const oldFooter =
`              <div
                className={
                  styles.reviewFooter
                }
              >
                <ShieldCheck
                  size={15}
                />

                <span>
                  Sending is intentionally disabled in this build. The next PI-only patch connects Guard approval, Gmail sending, and Orbit follow-up.
                </span>
              </div>`;

  const newFooter =
`              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  disabled={
                    clean(selectedDraft.status).toLowerCase() !== "approved" ||
                    sendingId === selectedDraft.id
                  }
                  onClick={() =>
                    void sendDraft(
                      selectedDraft,
                      "test"
                    )
                  }
                  style={{
                    minHeight: 40,
                    border: "1px solid rgba(107,184,255,.2)",
                    borderRadius: 8,
                    background: "rgba(107,184,255,.04)",
                    color: "#8bc2df",
                    cursor:
                      clean(selectedDraft.status).toLowerCase() === "approved"
                        ? "pointer"
                        : "not-allowed",
                    opacity:
                      clean(selectedDraft.status).toLowerCase() === "approved"
                        ? 1
                        : 0.4,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    fontSize: 8,
                    fontWeight: 900,
                  }}
                >
                  <TestTube2 size={14} />
                  Send Test Email
                </button>

                <button
                  type="button"
                  disabled={
                    clean(selectedDraft.status).toLowerCase() !== "approved" ||
                    sendingId === selectedDraft.id
                  }
                  onClick={() =>
                    void sendDraft(
                      selectedDraft,
                      "send"
                    )
                  }
                  style={{
                    minHeight: 40,
                    border: "1px solid rgba(100,215,160,.2)",
                    borderRadius: 8,
                    background: "rgba(100,215,160,.04)",
                    color: "#7dd1a7",
                    cursor:
                      clean(selectedDraft.status).toLowerCase() === "approved"
                        ? "pointer"
                        : "not-allowed",
                    opacity:
                      clean(selectedDraft.status).toLowerCase() === "approved"
                        ? 1
                        : 0.4,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    fontSize: 8,
                    fontWeight: 900,
                  }}
                >
                  <Send size={14} />
                  {sendingId === selectedDraft.id
                    ? "Sending…"
                    : "Send Email"}
                </button>
              </div>

              <div
                className={
                  styles.reviewFooter
                }
              >
                <ShieldCheck
                  size={15}
                />

                <span>
                  Titan Mail sends from contact@canolawfirm.com only after Guard review + explicit human approval. Send Test does not change the prospect or draft status.
                </span>
              </div>`;

  next = replaceOnce(
    next,
    oldFooter,
    newFooter,
    "Reach Titan action panel"
  );

  return `/* PI_OUTREACH_V2_TITAN_PATCH */\n${next}`;
}

function patchGuard(source) {
  let next = source;

  next = replaceOnce(
    next,
    '  Sparkles,\n  WandSparkles,',
    '  Sparkles,\n  Trash2,\n  WandSparkles,',
    "Guard imports"
  );

  next = replaceOnce(
    next,
    '  const [notice, setNotice] = useState("");\n  const [error, setError] = useState("");',
    '  const [notice, setNotice] = useState("");\n  const [error, setError] = useState("");\n  const [deletingId, setDeletingId] = useState<string | null>(null);',
    "Guard state"
  );

  const insertionPoint =
    '  const humanDecision = useCallback(\n';

  const deleteAction =
`  const deleteDraft = useCallback(
    async (draftId: string) => {
      const confirmed =
        window.confirm(
          "Delete this unused/test Reach draft and its Guard review records?"
        );

      if (!confirmed) return;

      setDeletingId(draftId);
      setError("");
      setNotice("Deleting test draft…");

      try {
        const response = await fetch(
          "/api/pi/outreach/delete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              outreachEventId: draftId,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || data?.ok === false) {
          throw new Error(
            data?.error || "Unable to delete draft."
          );
        }

        setSelectedId(null);
        await loadState();
        setNotice("Draft deleted from Reach and Guard.");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to delete draft."
        );
      } finally {
        setDeletingId(null);
      }
    },
    [loadState]
  );

`;

  next = replaceOnce(
    next,
    insertionPoint,
    deleteAction + insertionPoint,
    "Guard delete action"
  );

  next = replaceOnce(
    next,
    '? "Approved by human reviewer. Email sending remains disabled until the next PI-only send patch."',
    '? "Approved by human reviewer. This draft is now Ready to Send from Reach through Titan Mail."',
    "Guard approval notice"
  );

  next = replaceOnce(
    next,
`  const selected =
    state.drafts.find(
      (draft) => draft.id === selectedId
    ) || pending[0] || approved[0] || rejected[0] || null;`,
`  const selected =
    state.drafts.find(
      (draft) => draft.id === selectedId
    ) || pending[0] || null;`,
    "Guard selection"
  );

  next = replaceOnce(
    next,
`              {state.drafts.length ? (
                state.drafts.map((draft) => {`,
`              {pending.length ? (
                pending.map((draft) => {`,
    "Guard queue"
  );

  const oldBadges =
`                  <div className={styles.reviewHeadBadges}>
                    {selected.metadata?.revision_of ? (
                      <div className={styles.revisionPill}>
                        REVISED
                      </div>
                    ) : null}

                    <div className={styles.statusPill}>
                      {clean(selected.status) || "draft"}
                    </div>
                  </div>`;

  const newBadges =
`                  <div className={styles.reviewHeadBadges}>
                    <button
                      type="button"
                      title="Delete test / unused draft"
                      aria-label="Delete draft"
                      disabled={
                        deletingId === selected.id
                      }
                      onClick={() =>
                        void deleteDraft(
                          selected.id
                        )
                      }
                      style={{
                        width: 32,
                        height: 32,
                        border: "1px solid rgba(224,111,98,.16)",
                        borderRadius: 7,
                        background: "rgba(224,111,98,.025)",
                        color: "#dc968b",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        opacity:
                          deletingId === selected.id
                            ? 0.4
                            : 1,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>

                    {selected.metadata?.revision_of ? (
                      <div className={styles.revisionPill}>
                        REVISED
                      </div>
                    ) : null}

                    <div className={styles.statusPill}>
                      {clean(selected.status) || "draft"}
                    </div>
                  </div>`;

  next = replaceOnce(
    next,
    oldBadges,
    newBadges,
    "Guard header delete button"
  );

  next = replaceOnce(
    next,
    "Guard can now send required edits back to Reach for a revised draft. Approval is still stored separately, and email sending remains disabled until the next PI-only send patch.",
    "Guard can send required edits back to Reach for revision. Human approval moves the draft to Ready to Send; the final Send Email action happens in Reach through Titan Mail.",
    "Guard send copy"
  );

  return `/* PI_OUTREACH_V2_TITAN_PATCH */\n${next}`;
}

for (const [key, path] of Object.entries(files)) {
  const marker = "PI_OUTREACH_V2_TITAN_PATCH";
  const { source, alreadyPatched } =
    readAndGuard(
      path,
      expected[key],
      marker
    );

  if (alreadyPatched) {
    console.log(`${path}: already patched`);
    continue;
  }

  const patched =
    key === "reach"
      ? patchReach(source)
      : patchGuard(source);

  fs.writeFileSync(
    path,
    patched,
    "utf8"
  );

  console.log(`${path}: patched`);
}

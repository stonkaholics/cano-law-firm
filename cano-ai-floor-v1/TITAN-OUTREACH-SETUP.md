# Cano PI Outreach V2 — Titan Mail

This build uses **Titan Mail**, not Google/Gmail.

## What changes

- Guard human approval now means **Ready to Send**
- Reach shows **Send Test Email** and **Send Email**
- Send Test uses the exact production HTML but does not change status
- Official Send uses Titan SMTP from `contact@canolawfirm.com`
- Official Send changes the referral to `contacted`
- Official Send stores Titan message ID + Orbit handoff metadata
- Unsent/test drafts can be deleted
- Sent outreach is protected from deletion
- Guard's active queue shows pending drafts only, so approved/rejected history no longer clutters active work

## Vercel environment variables

Add:

```text
TITAN_SMTP_HOST=smtp.titan.email
TITAN_SMTP_PORT=465
TITAN_SMTP_USER=contact@canolawfirm.com
TITAN_SMTP_PASSWORD=YOUR_TITAN_MAILBOX_OR_APP_PASSWORD
TITAN_FROM_NAME=Erik Quisenberry | Cano Law Firm
TITAN_REPLY_TO=contact@canolawfirm.com
```

If the Titan mailbox has 2FA enabled, use a Titan application password.
Third-party email access must be enabled in Titan.

After adding or changing Vercel environment variables, redeploy.

## First test

1. Open Reach.
2. Open the Hayworth approved draft.
3. It should say **HUMAN APPROVED · READY TO SEND VIA TITAN**.
4. Click **Send Test Email**.
5. Enter the email address where you want to inspect the delivered message.
6. Check desktop + mobile formatting.
7. If correct, return to Reach and click **Send Email**.

The official Send Email button asks for confirmation before sending.

## Signature / format

The HTML deliberately follows the visual hierarchy from the example email:

- body copy
- thin divider
- `Best Regards,`
- Cano-style logo treatment
- Erik Quisenberry
- Chief Operating Officer
- CANO LAW FIRM, P.A.
- PERSONAL INJURY | IMMIGRATION
- address / phone / contact email / website
- divider
- confidentiality notice
- IRS Circular 230 disclosure

The existing AI-generated text signature is stripped before rendering the official HTML footer so the signature is not duplicated.

Property Damage remains excluded from the practice-area footer, matching the latest Reach requirement.

## Why there is a build patcher

Only two large current PI UI files need small edits:

- `app/personal-injury/ReachWorkstation.tsx`
- `app/personal-injury/GuardWorkstation.tsx`

The patcher runs automatically during `npm run build`; you do not run it manually.

It is SHA-locked to the current GitHub files:
- Reach: `f0408e725700705530527778a65013e12111369d`
- Guard: `d98d99d2e43c360ee7b3d675bf96ddd2a288f8c3`

If either file changes before you deploy this patch, the build aborts instead of overwriting newer PI work.

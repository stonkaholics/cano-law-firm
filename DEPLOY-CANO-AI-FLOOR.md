# Cano AI Floor — Vercel deployment

The Next.js app lives in:

```
cano-ai-floor-v1
```

## Preferred Vercel setup

Connect this GitHub repository to Vercel and set:

```
Root Directory: cano-ai-floor-v1
Framework: Next.js
Install Command: npm install
Build Command: npm run build
```

If the Vercel project is left at the repository root, the root `package.json`
and `vercel.json` on this branch build the nested workspace instead.

Do not upload the individual `route.ts` files through a browser file uploader.
The project contains many files named `route.ts` in different folders. Flattening
them into one directory creates names such as `route (11).ts` and breaks all
relative imports.

## Case Brain recovery already present

The current app includes:

- `Start Workflow` / `Retry / Start Workflow` beside Auto Routing.
- `POST /api/pipeline` with `action: "start_workflow"`.
- async Case Brain callback handling at `/api/case-brain/complete`.
- automatic Case Brain -> Lex pipeline handoff after a completed snapshot.

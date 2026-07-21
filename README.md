This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the explanation page in `src/app/pages/search/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Running locally

1. Install dependencies (if you haven't):

```bash
npm install
# or
yarn
# or
pnpm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the app in your browser at:

```
http://localhost:3000
```

4. Load a specific persona, dataset, task, and pair directly through the `/pages/search` route.
Example:

```
/pages/search?persona=neutral_evaluator&dataset=hetionet&task=drug_repurposing&source=Compound__DB00175&target=Disease__DOID_1936&modality=hybrid
```

Notes:
- `task` corresponds to a folder under `public/data` (e.g. `drug_repurposing` or `drug_target`).
- `source` and `target` should match the JSON filenames; the page will look for `public/data/<task>/<source>__<target>.json`.
- Example file used above: `public/data/drug_repurposing/Compound__DB00175__Disease__DOID_1936.json`.
- `modality` supports `hybrid`, `graph`, `text`, and `sumarize`. The `sumarize` modality displays only the full-screen verbalization menu.

The root route renders the same study interface as `/pages/search`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploy on GitHub Pages

This project is configured as a static Next.js export. Pushing to the `main`
branch runs `.github/workflows/deploy-pages.yml`, builds the site, and deploys
the generated `out` directory.

In the GitHub repository, open **Settings > Pages** and set **Source** to
**GitHub Actions**. The deployed project URL will be:

```text
https://<username>.github.io/<repository-name>/
```

The workflow reads the correct Pages base path from GitHub, so application
assets and public study data work for project sites, account sites, and custom
domains.

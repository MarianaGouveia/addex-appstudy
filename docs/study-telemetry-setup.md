# Study telemetry setup

The GitHub Pages client sends pseudonymous interaction events to Supabase. It
keeps unsent events in the browser's `localStorage` and retries when the browser
is online, focused, or during the ten-second flush interval.

## 1. Create the database

1. Create a Supabase project in the institution-approved EU region.
2. Open **SQL Editor** in that project.
3. Run `supabase/migrations/001_create_interaction_logs.sql`.
4. In **Table Editor**, verify that `interaction_logs` exists.

The migration permits the anonymous website role to insert rows only. It does
not allow that role to read, update, or delete study logs.

## 2. Configure the static build

Copy `.env.example` to `.env.local` and replace the placeholders with the
project URL and the Supabase **publishable** key:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Never use a secret or legacy `service_role` key in this application. Values prefixed with
`NEXT_PUBLIC_` are intentionally visible in the built website.

For GitHub Pages, add `NEXT_PUBLIC_SUPABASE_URL` as a GitHub Actions repository
variable and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as another repository
variable. Publishable keys are designed to be used by browser applications;
database Row Level Security provides the access control. The deploy workflow
already exposes these values to the build job. Local `.env.local` values do not
automatically exist in GitHub Actions.

## 3. Enable study flags

In `src/app/config/featureFlags.ts`:

```ts
logs: true,
forms: true,
```

Keep `logs: false` until the database and environment variables are ready.
With `forms: false`, every event deliberately uses `Form0`.

## 4. Create study links

When form logging is enabled, include a validated form code in each URL:

```text
&form=Form1
```

The form value must be `Form1`, `Form2`, and so on. Missing or invalid values
fall back to `Form0`. The pair code is derived from `task`, `source`, `target`,
and `modality`; it is not accepted directly from the URL.

Example result:

```text
DR1_DB00175_DOID1936_hybrid
```

## 5. Verify before collecting participants

1. Run a production build.
2. Open one complete study link.
3. Confirm rows appear in Supabase's `interaction_logs` table.
4. Confirm an unauthenticated REST request cannot select rows.
5. Export a test CSV, then delete the test rows from the authenticated dashboard.

## Data handling

- Do not put names, email addresses, IP addresses, full URLs, or clipboard
  contents into event data.
- Inform participants about telemetry in the consent process.
- Export and back up the database regularly during collection.
- Store exports outside the public Git repository.

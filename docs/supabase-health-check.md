# Daily Supabase database health check

This workflow calls a small database function daily at **08:23 UTC** and can
also run manually. It uses the existing publishable key, accesses no participant
data, and creates no fake study events. No npm install or website build is needed.
Network failures, HTTP 429, and server errors are retried up to three attempts;
configuration errors fail the workflow with a diagnostic message.

This is a best-effort way to generate database activity, not a guarantee against
[Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
A passing check confirms the function is reachable, not that participant uploads
or the whole website work. It cannot restore an already paused project.

## Activate once

1. Open the project's [Supabase SQL Editor](https://supabase.com/dashboard/project/sowwpajnhrcdfombkoon/sql/new).
   Run the contents of `supabase/migrations/005_add_study_health_check.sql`.
   The migration can be rerun safely and does not change permissions on study logs.
2. In GitHub **Settings > Secrets and variables > Actions > Variables**, confirm
   the same repository variables used by the Pages deployment exist:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://sowwpajnhrcdfombkoon.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key.
   No service-role key or database password is needed.
3. Commit and push the workflow and script to the repository's **default branch**.
   Scheduled workflows only run from that branch.
4. Open **Actions > Supabase daily health check > Run workflow** and confirm a
   green run with the message `Supabase database health check passed`.

## Monitor during the study

- Check Actions at least weekly for a recent successful run, and enable email
  notifications for failed Actions workflows in your GitHub notification settings.
  A disabled schedule produces no failed run, so notifications alone are insufficient.
- Set a separate monthly calendar reminder to check that the schedule remains
  enabled. GitHub disables schedules in public repositories after **60 days
  without repository activity**. Daily scheduled runs should not be relied on
  to reset that inactivity period. If disabled, open the workflow's Actions page,
  choose **Enable workflow**, then run it manually and verify the next daily run.
- GitHub can delay or drop scheduled runs. See the
  [GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
- If a check fails, inspect the run: HTTP 404 may mean migration 005 is missing;
  401/403 may indicate a key or permission problem. Check the Supabase dashboard
  for a paused or unavailable project and restore it there if necessary.
- Continue exporting study logs regularly and verify a real study upload before
  collecting participants after a long break.

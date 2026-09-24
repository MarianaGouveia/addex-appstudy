import { pathToFileURL } from "node:url";

export async function checkSupabaseHealth({
  env = process.env,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in GitHub Actions repository variables.");
  }

  const base = new URL(url);
  if (base.protocol !== "https:" || base.username || base.password ||
      base.pathname !== "/" || base.search || base.hash) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS project origin.");
  }
  const endpoint = new URL("/rest/v1/rpc/study_health_check", base);

  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: "{}",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      if (attempt === 3) throw new Error("Supabase health check failed after 3 network attempts. Check project availability.");
      await sleep(5_000 * attempt);
      continue;
    }

    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await sleep(5_000 * attempt);
        continue;
      }
      // Do not print response bodies: failures may contain internal details.
      throw new Error(`Supabase health check returned HTTP ${response.status}. Check project status, repository variables, and migration 005_add_study_health_check.sql.`);
    }

    let healthy;
    try {
      healthy = await response.json();
    } catch {
      throw new Error("Supabase health check returned invalid JSON.");
    }
    if (healthy !== true) throw new Error("Supabase health check did not return true.");
    return;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkSupabaseHealth().then(
    () => console.log("Supabase database health check passed. No study logs were read or written."),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}

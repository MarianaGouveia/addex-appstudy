import test from "node:test";
import assert from "node:assert/strict";
import { checkSupabaseHealth } from "./check-supabase-health.mjs";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};
const sleep = async () => {};

test("calls only the health RPC using the publishable key", async () => {
  await checkSupabaseHealth({ env, fetchImpl: async (url, options) => {
    assert.equal(url.href, "https://example.supabase.co/rest/v1/rpc/study_health_check");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.apikey, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    assert.equal(options.body, "{}");
    assert.equal(options.redirect, "error");
    return new Response("true");
  } });
});

test("missing configuration fails before sending a request", async () => {
  await assert.rejects(checkSupabaseHealth({ env: {}, fetchImpl: () => assert.fail() }), /repository variables/);
});

test("rejects unsafe project URLs before sending a key", async () => {
  for (const url of ["http://example.com", "https://user:pass@example.com", "https://example.com/path"]) {
    await assert.rejects(checkSupabaseHealth({ env: { ...env, NEXT_PUBLIC_SUPABASE_URL: url }, fetchImpl: () => assert.fail() }), /HTTPS project origin/);
  }
});

test("retries network and transient server failures", async () => {
  let calls = 0;
  await checkSupabaseHealth({ env, sleep, fetchImpl: async () => {
    calls++;
    if (calls === 1) throw new Error("network details");
    return calls === 2 ? new Response("unavailable", { status: 503 }) : new Response("true");
  } });
  assert.equal(calls, 3);
});

test("persistent rate limiting fails after three attempts", async () => {
  let calls = 0;
  await assert.rejects(checkSupabaseHealth({ env, sleep, fetchImpl: async () => {
    calls++;
    return new Response("private error body", { status: 429 });
  } }), /HTTP 429/);
  assert.equal(calls, 3);
});

test("configuration failures are not retried or printed verbatim", async () => {
  for (const status of [401, 403, 404]) {
    let calls = 0;
    await assert.rejects(checkSupabaseHealth({ env, sleep, fetchImpl: async () => {
      calls++;
      return new Response("private error body", { status });
    } }), (error) => error.message.includes(`HTTP ${status}`) && !error.message.includes("private error body"));
    assert.equal(calls, 1);
  }
});

test("unexpected success responses fail the check", async () => {
  for (const body of ["false", "{}", "<html>not the database</html>"]) {
    await assert.rejects(checkSupabaseHealth({ env, fetchImpl: async () => new Response(body) }));
  }
});

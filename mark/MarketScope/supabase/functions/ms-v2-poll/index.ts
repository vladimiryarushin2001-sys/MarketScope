// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-JWT",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errToMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function toStringSafe(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const msV2Url = (Deno.env.get("MS_V2_URL") ?? "").replace(/\/+$/, "");
    if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    if (!msV2Url) return json(500, { error: "Missing MS_V2_URL env" });

    // Use service role for DB writes; do not forward incoming Authorization header,
    // otherwise it may override auth.getUser(jwt) and cause "Invalid user token".
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    // Authorization is used to satisfy the gateway (anon JWT). The actual user token comes via X-User-JWT.
    const userJwt = (req.headers.get("X-User-JWT") ?? "").trim() || bearer;
    if (!userJwt) return json(401, { error: "Missing user JWT (Authorization Bearer or X-User-JWT)" });
    const u = await supabase.auth.getUser(userJwt);
    if (u.error || !u.data.user) return json(401, { error: "Invalid user token" });
    const userId = u.data.user.id;

    const body = await req.json().catch(() => ({}));
    const runId = Number(body.run_id);
    if (!Number.isFinite(runId) || runId <= 0) return json(400, { error: "run_id is required" });

    const { data: runRow, error: runErr } = await supabase
      .from("analysis_runs")
      .select("id,request_id,report_type,status,progress,job_id,finished_at")
      .eq("id", runId)
      .maybeSingle();
    if (runErr) return json(500, { error: errToMessage(runErr) });
    if (!runRow) return json(404, { error: "Run not found" });

    const dbStatusEarly = toStringSafe(runRow.status);
    if ((dbStatusEarly === "done" || dbStatusEarly === "done_partial") && runRow.finished_at) {
      return json(200, {
        ok: true,
        status: dbStatusEarly,
        progress: toStringSafe(runRow.progress),
        ingested: false,
        skipped: "already_finalized",
      });
    }

    // Ownership check via client_requests
    const { data: reqRow, error: reqErr } = await supabase
      .from("client_requests")
      .select("id,user_id")
      .eq("id", runRow.request_id)
      .maybeSingle();
    if (reqErr) return json(500, { error: errToMessage(reqErr) });
    if (!reqRow) return json(404, { error: "Request not found" });
    if (String(reqRow.user_id) !== String(userId)) return json(403, { error: "Forbidden" });

    const jobId = toStringSafe(runRow.job_id);
    if (!jobId) return json(400, { error: "Run has no job_id yet" });

    const msRes = await fetch(`${msV2Url}/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
    const msJson = await msRes.json().catch(() => ({}));
    if (!msRes.ok) return json(502, { error: `ms-v2 /jobs failed (${msRes.status})`, details: msJson });

    const status = toStringSafe(msJson.status);
    const progress = toStringSafe(msJson.progress);
    const warnings = msJson.warnings ?? {};
    const errorText = toStringSafe(msJson.error);
    const outputs = msJson.outputs ?? {};

    // Persist status/progress early
    await supabase
      .from("analysis_runs")
      .update({
        status: status || runRow.status,
        progress: progress || runRow.progress || "",
        warnings: warnings && typeof warnings === "object" ? warnings : {},
        error: errorText || "",
      })
      .eq("id", runId);

    // If finished — ingest into domain tables using existing run_id
    if (status === "done" || status === "done_partial") {
      const ingestRes = await fetch(`${supabaseUrl}/functions/v1/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Шлюз Supabase ожидает apikey вместе с Authorization (как у клиента).
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          user_id: userId,
          blocks: outputs,
          request: { request_id: runRow.request_id, run_id: runId, query_text: "" },
        }),
      });
      const ingestJson = await ingestRes.json().catch(() => ({}));
      if (!ingestRes.ok) {
        await supabase
          .from("analysis_runs")
          .update({ status: "error", error: `ingest failed: ${ingestRes.status}`, finished_at: new Date().toISOString() })
          .eq("id", runId);
        return json(502, { error: "Ingest failed", details: ingestJson });
      }

      await supabase
        .from("analysis_runs")
        .update({
          status,
          progress: progress || "6/6",
          outputs: outputs && typeof outputs === "object" ? outputs : {},
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);

      return json(200, { ok: true, status, progress, ingested: true, ingest: ingestJson });
    }

    if (status === "error") {
      await supabase
        .from("analysis_runs")
        .update({ status: "error", error: errorText || "Unknown ms-v2 error", finished_at: new Date().toISOString() })
        .eq("id", runId);
    }

    return json(200, { ok: true, status, progress, ingested: false });
  } catch (e) {
    return json(500, { error: errToMessage(e) });
  }
});


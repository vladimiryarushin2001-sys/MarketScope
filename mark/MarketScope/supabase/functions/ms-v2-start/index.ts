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

function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function hasActiveSubscription(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("is_active,is_lifetime,expires_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  if (!data.is_active) return false;
  if (data.is_lifetime) return true;
  if (!data.expires_at) return true;
  // expires_at is a date; treat as inclusive for the whole day
  try {
    const exp = new Date(`${String(data.expires_at)}T23:59:59Z`).getTime();
    return exp >= Date.now();
  } catch {
    return false;
  }
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

    // Enforce subscription before starting expensive pipeline
    const allowed = await hasActiveSubscription(supabase, userId);
    if (!allowed) return json(402, { error: "Subscription required" });

    const body = await req.json().catch(() => ({}));
    const requestId = Number(body.request_id);
    if (!Number.isFinite(requestId) || requestId <= 0) return json(400, { error: "request_id is required" });

    const { data: requestRow, error: reqErr } = await supabase
      .from("client_requests")
      .select("id,user_id,query_text,params,request_type")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr) return json(500, { error: errToMessage(reqErr) });
    if (!requestRow) return json(404, { error: "Request not found" });
    if (String(requestRow.user_id) !== String(userId)) return json(403, { error: "Forbidden" });

    const requestType = toStringSafe(requestRow.request_type) || "market_overview";
    const queryText = toStringSafe(requestRow.query_text) || "";
    const params = (requestRow.params && typeof requestRow.params === "object") ? requestRow.params : {};

    // Map UI request -> ms-v2 AnalyzeRequest
    let analyzeBody: Record<string, unknown>;
    let reportType: string;

    if (requestType === "competitive_analysis") {
      reportType = "competitive";
      const myRestaurant = (params && typeof params === "object" && (params as any).my_restaurant && typeof (params as any).my_restaurant === "object")
        ? (params as any).my_restaurant
        : null;
      analyzeBody = {
        report_type: "competitive",
        mode: "free_form",
        top_n: Number(body.top_n ?? 5) || 5,
        free_form_text: queryText,
        reference_place: {
          name: toStringSafe(myRestaurant?.name ?? (params as any).my_name ?? (params as any).name ?? ""),
          address: toStringSafe(myRestaurant?.address ?? (params as any).my_address ?? (params as any).address ?? ""),
          website: toStringSafe(myRestaurant?.site ?? myRestaurant?.website ?? (params as any).my_site ?? (params as any).my_website ?? (params as any).website ?? ""),
          yandex_maps_link: toStringSafe(myRestaurant?.yandex_maps_link ?? (params as any).my_yandex_maps_link ?? (params as any).yandex_maps_link ?? ""),
          menu_url: toStringSafe(myRestaurant?.menu_url ?? (params as any).my_menu_url ?? (params as any).menu_url ?? ""),
        },
      };
      if (!toStringSafe((analyzeBody.reference_place as any).name)) {
        return json(400, { error: "Для конкурентного анализа нужно указать название заведения" });
      }
    } else {
      reportType = "market";
      const placeType = toStringSafe(params.place_type ?? params.type ?? "");
      const cuisine = toStringSafe(params.cuisine ?? "");
      const priceMin = toNumberOrNull(params.avg_check_min ?? params.price_min);
      const priceMax = toNumberOrNull(params.avg_check_max ?? params.price_max);
      analyzeBody = {
        report_type: "market",
        mode: "template",
        top_n: Number(body.top_n ?? 10) || 10,
        template: {
          types: placeType ? [placeType] : ["ресторан"],
          cuisines: cuisine ? [cuisine] : null,
          price_min: priceMin,
          price_max: priceMax,
          особенности: toStringSafe(params.features ?? params.особенности ?? ""),
        },
      };
    }

    // Create run first
    const insertedRun = await supabase
      .from("analysis_runs")
      .insert({
        request_id: requestId,
        report_type: reportType,
        status: "pending",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertedRun.error) return json(500, { error: errToMessage(insertedRun.error) });
    const runId = Number(insertedRun.data.id);

    // Start ms-v2 job
    const msRes = await fetch(`${msV2Url}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyzeBody),
    });
    const msJson = await msRes.json().catch(() => ({}));
    if (!msRes.ok) {
      await supabase.from("analysis_runs").update({ status: "error", error: `ms-v2 /analyze: ${msRes.status}`, finished_at: new Date().toISOString() }).eq("id", runId);
      return json(502, { error: "ms-v2 start failed", details: msJson });
    }
    const jobId = toStringSafe(msJson.job_id ?? msJson.id);
    if (!jobId) {
      await supabase.from("analysis_runs").update({ status: "error", error: "ms-v2 did not return job_id", finished_at: new Date().toISOString() }).eq("id", runId);
      return json(502, { error: "ms-v2 did not return job_id", details: msJson });
    }

    const upd = await supabase
      .from("analysis_runs")
      .update({ status: "running", job_id: jobId, progress: "0/6" })
      .eq("id", runId);
    if (upd.error) return json(500, { error: errToMessage(upd.error) });

    return json(200, { ok: true, requestId, runId, jobId, reportType });
  } catch (e) {
    return json(500, { error: errToMessage(e) });
  }
});


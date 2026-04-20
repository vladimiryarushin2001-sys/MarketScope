// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const msV2UrlRaw = Deno.env.get("MS_V2_URL") ?? "";
  const msV2Url = msV2UrlRaw.replace(/\/+$/, "");
  if (!msV2Url) return json(500, { ok: false, error: "MS_V2_URL is not set" });

  const healthUrl = `${msV2Url}/health`;
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(healthUrl, { method: "GET", signal: controller.signal });
    clearTimeout(t);
    const text = await res.text().catch(() => "");
    return json(200, {
      ok: res.ok,
      ms_v2_url: msV2Url,
      health_url: healthUrl,
      status: res.status,
      elapsed_ms: Date.now() - startedAt,
      body: text.slice(0, 1000),
      note:
        "This response is fetched from Supabase Edge runtime. If this fails, ms-v2-start/poll won't be able to reach your Beget service either.",
    });
  } catch (e) {
    return json(200, {
      ok: false,
      ms_v2_url: msV2Url,
      health_url: healthUrl,
      elapsed_ms: Date.now() - startedAt,
      error: errToMessage(e),
      hint:
        "If error mentions TLS/https, use a domain + HTTPS (Caddy) and set MS_V2_URL=https://<domain>. If timeout/connection refused, check firewall/provider and that port 80/443 is reachable from the internet.",
    });
  }
});


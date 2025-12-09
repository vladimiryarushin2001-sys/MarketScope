import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Metric {
  id?: string;
  competitor_id: string;
  metric_type: string;
  value: number;
  date: string;
  user_id?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === "/functions/v1/metrics" && req.method === "GET") {
      const competitorId = url.searchParams.get("competitor_id");

      let query = supabase.from("metrics").select("*");

      if (competitorId) {
        query = query.eq("competitor_id", competitorId);
      }

      const { data, error } = await query.order("date", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (pathname === "/functions/v1/metrics" && req.method === "POST") {
      const body: Metric = await req.json();

      const { data, error } = await supabase
        .from("metrics")
        .insert([
          {
            competitor_id: body.competitor_id,
            metric_type: body.metric_type,
            value: body.value,
            date: body.date,
            user_id: body.user_id || null,
          },
        ])
        .select();

      if (error) throw error;

      return new Response(JSON.stringify(data[0]), {
        status: 201,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

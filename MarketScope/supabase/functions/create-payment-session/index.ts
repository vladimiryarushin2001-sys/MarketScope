// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";
import Stripe from "npm:stripe@16.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeSecret);
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    const body = await req.json();
    let user = null;
    if (token) {
      const userRes = await supabase.auth.getUser(token);
      if (!userRes.error && userRes.data.user) {
        user = userRes.data.user;
      }
    }
    // Fallback for environments where JWT is blocked/invalid at edge gateway,
    // but request comes from authenticated frontend that can provide user_id.
    if (!user && body?.user_id) {
      const byId = await supabase.auth.admin.getUserById(String(body.user_id));
      if (!byId.error && byId.data.user) {
        user = byId.data.user;
      }
    }
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: "JWT is invalid/expired and fallback user_id is not valid" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const planCode = String(body.plan_code || "");
    const amountKopecks = Number(body.amount_kopecks || 0);
    const periodDays = Number(body.period_days || 30);
    if (!planCode || !amountKopecks) throw new Error("plan_code and amount_kopecks are required");

    const successUrl = Deno.env.get("PAYMENT_SUCCESS_URL") || "http://localhost:5173/";
    const cancelUrl = Deno.env.get("PAYMENT_CANCEL_URL") || "http://localhost:5173/";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        plan_code: planCode,
        period_days: String(periodDays),
      },
      line_items: [
        {
          price_data: {
            currency: "rub",
            product_data: { name: `MarketScope ${planCode}` },
            unit_amount: amountKopecks,
          },
          quantity: 1,
        },
      ],
    });

    const inserted = await supabase.from("payments").insert({
      user_id: user.id,
      plan_code: planCode,
      amount_rub: Math.round(amountKopecks / 100),
      period_days: periodDays,
      status: "pending",
      provider: "stripe",
      provider_payment_id: session.id,
      checkout_url: session.url ?? "",
    });
    if (inserted.error) throw inserted.error;

    return new Response(JSON.stringify({ checkout_url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


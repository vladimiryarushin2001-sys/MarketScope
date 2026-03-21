// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";
import Stripe from "npm:stripe@16.8.0";

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const stripe = new Stripe(stripeSecret);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, stripeWebhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const planCode = session.metadata?.plan_code ?? "starter";
    const periodDays = Number(session.metadata?.period_days ?? 30);
    if (userId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + periodDays);

      await supabase
        .from("payments")
        .update({ status: "paid", paid_at: now.toISOString() })
        .eq("provider_payment_id", session.id);

      await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          plan_name: planCode === "business" ? "Бизнес" : "Стартовый",
          is_active: true,
          is_lifetime: false,
          started_at: now.toISOString().slice(0, 10),
          expires_at: end.toISOString().slice(0, 10),
          payment_provider: "stripe",
          external_payment_id: session.id,
        });
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});


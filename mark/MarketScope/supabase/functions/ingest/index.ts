// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function errToMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = typeof e.message === "string" ? e.message : "";
    const details = typeof e.details === "string" ? e.details : "";
    const hint = typeof e.hint === "string" ? e.hint : "";
    const code = typeof e.code === "string" ? e.code : "";
    const parts = [msg, details, hint].filter(Boolean);
    if (parts.length) return `${parts.join(" | ")}${code ? ` (code: ${code})` : ""}`;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

interface JsonDataset {
  restaurants?: Array<Record<string, unknown>>;
  menus?: Array<Record<string, unknown>>;
  menuItems?: Array<Record<string, unknown>>;
  reviews?: Array<Record<string, unknown>>;
  marketing?: Array<Record<string, unknown>>;
  marketingSocials?: Array<Record<string, unknown>>;
  marketingLoyalty?: Array<Record<string, unknown>>;
  technicalAnalysis?: Array<Record<string, unknown>>;
  strategicReport?: Array<Record<string, unknown>>;
  // v2: новый формат (temp2) — набор блоков block1..block6
  blocks?: Record<string, unknown>;
  // История/мультизапуски
  request?: { query_text?: string; request_id?: number; run_id?: number; params?: Record<string, unknown> };
  user_id?: string; // fallback для server-side импорта (когда нет user JWT)
}

function omitId<T extends Record<string, unknown>>(row: T): Omit<T, "id"> {
  const { id: _, ...rest } = row;
  return rest as Omit<T, "id">;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function toStringSafe(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function toNumberSafe(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

/** JWT от service_role нельзя передавать в auth.getUser — берём user_id из тела (доверенный server-to-server вызов). */
function jwtRole(bearer: string): string | null {
  const parts = bearer.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const payload = JSON.parse(json) as { role?: string };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function v2DatasetFromBlocks(blocks: Record<string, unknown>): JsonDataset {
  const b1 = asObject(blocks.block1 ?? blocks.block1_output ?? blocks["block1_output.json"] ?? blocks["block1"]);
  const b2 = asObject(blocks.block2 ?? blocks.block2_output ?? blocks["block2_output.json"] ?? blocks["block2"]);
  const b3 = asObject(blocks.block3 ?? blocks.block3_output ?? blocks["block3_output.json"] ?? blocks["block3"]);
  const b4 = asObject(blocks.block4 ?? blocks.block4_output ?? blocks["block4_output.json"] ?? blocks["block4"]);
  const b5 = asObject(blocks.block5 ?? blocks.block5_output ?? blocks["block5_output.json"] ?? blocks["block5"]);
  const b6 = asObject(blocks.block6 ?? blocks.block6_output ?? blocks["block6_output.json"] ?? blocks["block6"]);
  const b3Enriched = asArray(
    blocks.block3_reviews_enriched ??
      blocks["block3_reviews_enriched.json"] ??
      blocks.block3_reviews_enriched_output
  ).map((x) => asObject(x));

  const selectedPlaces = asArray(b1.selected_places);
  const restaurants = selectedPlaces.map((p, idx) => {
    const o = asObject(p);
    return {
      id: idx + 1,
      name: toStringSafe(o["название"] ?? o.name),
      address: toStringSafe(o["адрес"] ?? o.address),
      type: toStringSafe(o["тип_заведения"] ?? o.type),
      cuisine: toStringSafe(o["кухня"] ?? o.cuisine),
      avg_check: toNumberSafe(o["средний_чек"] ?? o.avg_check),
      description: toStringSafe(o["описание"] ?? o.description),
      link: toStringSafe(o["ссылка"] ?? o.link),
      cosine_score: toNumberSafe(o.cosine_score),
      site: toStringSafe(o["сайт"] ?? o.site),
      delivery: Boolean(o["доставка"] ?? o.delivery),
      working_hours: toStringSafe(o["время_работы"] ?? o.working_hours),
      yandex_maps_link: toStringSafe(o.yandex_maps_link),
      menu_url: toStringSafe(o.menu_url),
      menu_files: asArray(o.menu_files).map((x) => toStringSafe(x)),
      is_reference_place: Boolean(o.is_reference_place),
      conclusion: toStringSafe(o["вывод"] ?? o.conclusion),
    };
  });

  const restaurantIdByName = new Map<string, number>();
  restaurants.forEach((r) => {
    if (typeof r.name === "string" && r.name) restaurantIdByName.set(r.name, Number(r.id));
  });

  const menuByPlace = asObject(b2.menu_by_place);
  const menus: Array<Record<string, unknown>> = [];
  const menuItems: Array<Record<string, unknown>> = [];
  let menuId = 1;
  let menuItemId = 1;
  for (const [placeName, menuObj] of Object.entries(menuByPlace)) {
    const restId = restaurantIdByName.get(placeName);
    if (!restId) continue;
    const m = asObject(menuObj);
    const items = asArray(m.items).map((it) => asObject(it));
    const categories = asArray(m.categories).map((c) => toStringSafe(c));
    const menuRow = {
      id: menuId,
      restaurant_id: restId,
      status: toStringSafe(m.status),
      menu_urls: asArray(m.menu_urls).map((u) => toStringSafe(u)),
      items_count: toNumberSafe(m.items_count) || items.length,
      has_kids_menu: Boolean(m.has_kids_menu),
      categories,
      conclusion: toStringSafe(m["вывод"] ?? m.conclusion),
      reference_conclusion: "",
    };
    menus.push(menuRow);
    items.forEach((it) => {
      menuItems.push({
        id: menuItemId++,
        menu_id: menuId,
        category: toStringSafe(it.category),
        name: toStringSafe(it.name),
        price: toNumberSafe(it.price),
      });
    });
    menuId++;
  }

  const summaries = asArray(b3.summaries).map((s) => asObject(s));
  const reviews: Array<Record<string, unknown>> = summaries
    .map((s, idx) => {
      const placeName = toStringSafe(s["заведение"] ?? s.place ?? s.name);
      const restId = restaurantIdByName.get(placeName);
      if (!restId) return null;
      const pos = asArray(s["положительное"]).map((x) => toStringSafe(x)).filter(Boolean);
      const neg = asArray(s["отрицательное"]).map((x) => toStringSafe(x)).filter(Boolean);
      return {
        id: idx + 1,
        restaurant_id: restId,
        summary_mode: toStringSafe(b3.summary_mode),
        reviews_count: toNumberSafe(s["количество_отзывов"]),
        general_info: toStringSafe(s["общая_информация"]),
        positive: pos.join("\n"),
        negative: neg.join("\n"),
        conclusion: toStringSafe(s["вывод"] ?? s.conclusion),
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  // enrich reviews with rating/count_rating and detailed positive/negative samples
  const summaryByRest = new Map<number, Record<string, unknown>>();
  reviews.forEach((r) => summaryByRest.set(Number(r.restaurant_id), r));
  b3Enriched.forEach((entry) => {
    const placeName = toStringSafe(entry.place_name ?? entry["заведение"] ?? entry.name);
    const restId = restaurantIdByName.get(placeName);
    if (!restId) return;
    const ci = asObject(entry.company_info);
    const rawReviews = asArray(entry.reviews).map((rv) => asObject(rv));
    const positive = rawReviews
      .filter((rv) => Number(rv.sentiment) > 0)
      .map((rv) => toStringSafe(rv.text))
      .filter(Boolean)
      .slice(0, 120);
    const negative = rawReviews
      .filter((rv) => Number(rv.sentiment) < 0)
      .map((rv) => toStringSafe(rv.text))
      .filter(Boolean)
      .slice(0, 120);
    const row = summaryByRest.get(restId);
    if (!row) return;
    row.rating = toNumberSafe(ci.rating);
    row.count_rating = toNumberSafe(ci.count_rating);
    row.positive_reviews = positive;
    row.negative_reviews = negative;
  });
  const referenceConclusion = toStringSafe(b3["вывод_по_опорному"] ?? b3.reference_conclusion);
  if (referenceConclusion) {
    reviews.forEach((r) => {
      r.reference_conclusion = referenceConclusion;
    });
  }

  const marketingByPlace = asObject(b4.marketing_by_place);
  const marketing: Array<Record<string, unknown>> = [];
  const marketingSocials: Array<Record<string, unknown>> = [];
  const marketingLoyalty: Array<Record<string, unknown>> = [];
  let marketingId = 1;
  let socialId = 1;
  let loyaltyId = 1;
  for (const [placeName, mObj] of Object.entries(marketingByPlace)) {
    const restId = restaurantIdByName.get(placeName);
    if (!restId) continue;
    const m = asObject(mObj);
    marketing.push({
      id: marketingId,
      restaurant_id: restId,
      site: toStringSafe(m["сайт"] ?? m.site),
      reference_conclusion: toStringSafe(b4["вывод_по_опорному"] ?? b4.reference_conclusion),
      conclusion: toStringSafe(m["вывод"] ?? m.conclusion),
    });
    const socials = asArray(m["соцсети"]).map((x) => asObject(x));
    socials.forEach((s) => {
      marketingSocials.push({
        id: socialId++,
        marketing_id: marketingId,
        network: toStringSafe(s.network),
        url: toStringSafe(s.url),
        activity: toStringSafe(s.activity),
      });
    });
    const lp = asObject(m["программа_лояльности"]);
    const formatsRaw = lp.loyalty_format ?? lp["loyalty_format"] ?? lp["формат"];
    const formats = Array.isArray(formatsRaw)
      ? formatsRaw.map((x) => toStringSafe(x)).filter(Boolean)
      : typeof formatsRaw === "string" && formatsRaw
        ? [formatsRaw]
        : [];
    marketingLoyalty.push({
      id: loyaltyId++,
      marketing_id: marketingId,
      has_loyalty: Boolean(lp.has_loyalty),
      loyalty_name: toStringSafe(lp.loyalty_name),
      loyalty_format: formats,
      loyalty_cost_per_point: lp.loyalty_cost_per_point == null ? "" : String(lp.loyalty_cost_per_point),
      loyalty_how_to_earn: toStringSafe(lp.loyalty_how_to_earn),
    });
    marketingId++;
  }

  const techByPlace = asObject(b5.tech_by_place);
  const technicalAnalysis: Array<Record<string, unknown>> = [];
  let techId = 1;
  for (const [placeName, tObj] of Object.entries(techByPlace)) {
    const restId = restaurantIdByName.get(placeName);
    if (!restId) continue;
    const t = asObject(tObj);
    technicalAnalysis.push({
      id: techId++,
      restaurant_id: restId,
      url: toStringSafe(t.url),
      status_code: toNumberSafe(t.status_code),
      load_time_sec: toNumberSafe(t.load_time_sec),
      mobile_load_time_sec: toNumberSafe(t.mobile_load_time_sec),
      page_size_kb: toNumberSafe(t.page_size_kb),
      title: toStringSafe(t.title),
      meta_description: toStringSafe(t.meta_description),
      https: Boolean(t.https),
      has_viewport: Boolean(t.has_viewport),
      error: toStringSafe(t.error),
      reference_conclusion: toStringSafe(b5["вывод_по_опорному"] ?? b5.reference_conclusion),
      conclusion: toStringSafe(t["вывод"] ?? t.conclusion),
    });
  }

  // Per current UI requirements, menu conclusions are displayed from block5 tech выводs
  if (menus.length > 0) {
    const menuByRestaurant = new Map<number, Record<string, unknown>>();
    menus.forEach((m) => menuByRestaurant.set(Number(m.restaurant_id), m));
    for (const [placeName, tObj] of Object.entries(techByPlace)) {
      const restId = restaurantIdByName.get(placeName);
      if (!restId) continue;
      const menu = menuByRestaurant.get(restId);
      if (!menu) continue;
      const t = asObject(tObj);
      menu.conclusion = toStringSafe(t["вывод"] ?? t.conclusion);
      menu.reference_conclusion = toStringSafe(b5["вывод_по_опорному"] ?? b5.reference_conclusion);
    }
  }

  const sections = asObject(b6.sections);
  const reportMd = toStringSafe(b6.report_md);
  const referencePlace = asObject(b1.reference_place);
  const referenceName = toStringSafe(referencePlace.name);
  const reportRestaurantId = (referenceName && restaurantIdByName.get(referenceName)) || restaurants[0]?.id || 1;
  const getSection = (keys: string[]): string => {
    for (const k of keys) {
      const v = sections[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  const strategicReport: Array<Record<string, unknown>> = [
    {
      id: 1,
      restaurant_id: reportRestaurantId,
      block1: toStringSafe(b1["вывод_по_опорному"] ?? b1["общий_вывод"]),
      block2: toStringSafe(b2["вывод_по_опорному"] ?? b2["общий_вывод"]),
      block3: toStringSafe(b3["вывод_по_опорному"] ?? b3["общий_вывод"]),
      block4: toStringSafe(b4["вывод_по_опорному"] ?? b4["общий_вывод"]),
      block5: toStringSafe(b5["вывод_по_опорному"] ?? b5["общий_вывод"]),
      report_md: reportMd,
      positioning: getSection(["позиционирование", "анализ рынка"]),
      menu: getSection(["меню", "анализ меню"]),
      reviews: getSection(["отзывы", "анализ отзывов"]),
      marketing: getSection(["маркетинг", "анализ маркетинга"]),
      technical_part: getSection(["техническая часть", "анализ сайтов"]),
      business_recommendations: getSection(["бизнес-рекомендации", "рекомендации по нише"]),
      reference_info: getSection(["справочная информация"]),
    },
  ];

  return {
    restaurants,
    menus,
    menuItems,
    reviews,
    marketing,
    marketingSocials,
    marketingLoyalty,
    technicalAnalysis,
    strategicReport,
    request: { query_text: toStringSafe(b1["query_context"] ?? b1["report_type"] ?? "") },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    // Вставки в БД выполняем сервисным ключом (RLS bypass).
    // JWT пользователя используем только для определения userId (auth.getUser).
    const supabase = createClient(supabaseUrl, serviceKey);

    let body = (await req.json()) as JsonDataset;

    // Сохраняем метаданные запроса ДО преобразования v2 blocks (иначе они потеряются)
    const incomingUserId = body.user_id ? String(body.user_id) : null;
    const incomingRequest = body.request ? body.request : undefined;
    const incomingBlocks = body.blocks && typeof body.blocks === "object" ? (body.blocks as Record<string, unknown>) : null;

    // v2: если пришли blocks — преобразуем в старый dataset-формат
    if (incomingBlocks) {
      body = v2DatasetFromBlocks(incomingBlocks);
      // возвращаем метаданные назад
      body.user_id = incomingUserId ?? undefined;
      body.request = incomingRequest;
      body.blocks = incomingBlocks;
    }

    // Определяем пользователя для истории
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    const role = bearer ? jwtRole(bearer) : null;
    if (bearer && role !== "service_role") {
      const u = await supabase.auth.getUser(bearer);
      if (!u.error && u.data.user) userId = u.data.user.id;
    }
    if (!userId && body.user_id) userId = String(body.user_id);

    if (!userId) {
      return new Response(JSON.stringify({ error: "User is required (Authorization Bearer user JWT or user_id in body)" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // report_type: пробуем взять из block1/blocks, иначе пусто
    const reportType =
      incomingBlocks && typeof incomingBlocks.block1 === "object"
        ? toStringSafe(asObject(incomingBlocks.block1).report_type)
        : "";

    // request + run (можно привязать к существующему request_id)
    const queryText = toStringSafe(body.request?.query_text) || "";
    const incomingRequestId = body.request?.request_id ? Number(body.request.request_id) : null;
    const incomingRunId = body.request?.run_id ? Number(body.request.run_id) : null;
    const requestType = reportType === "competitive" ? "competitive_analysis" : "market_overview";

    let requestId: number;
    if (incomingRequestId) {
      // validate ownership
      const existing = await supabase.from("client_requests").select("id,user_id").eq("id", incomingRequestId).maybeSingle();
      if (existing.error) throw new Error(errToMessage(existing.error));
      if (!existing.data) throw new Error("client_requests: request_id not found");
      if (String((existing.data as { user_id: string }).user_id) !== String(userId)) {
        throw new Error("client_requests: request_id does not belong to user");
      }
      requestId = incomingRequestId;
      // optionally update query_text/params if provided
      if (queryText || body.request?.params) {
        const upd = await supabase
          .from("client_requests")
          .update({
            ...(queryText ? { query_text: queryText } : {}),
            ...(body.request?.params ? { params: body.request.params } : {}),
            request_type: requestType,
          })
          .eq("id", requestId);
        if (upd.error) throw new Error(errToMessage(upd.error));
      }
    } else {
      const insertedRequest = await supabase
        .from("client_requests")
        .insert({
          user_id: userId,
          query_text: queryText,
          request_type: requestType,
          params: body.request?.params ?? {},
        })
        .select("id")
        .single();
      if (insertedRequest.error) throw new Error(errToMessage(insertedRequest.error));
      requestId = Number((insertedRequest.data as { id: number }).id);
    }

    let runId: number;
    if (incomingRunId) {
      const runRow = await supabase
        .from("analysis_runs")
        .select("id,request_id")
        .eq("id", incomingRunId)
        .maybeSingle();
      if (runRow.error) throw new Error(errToMessage(runRow.error));
      if (!runRow.data) throw new Error("analysis_runs: run_id not found");
      if (Number((runRow.data as { request_id: number }).request_id) !== Number(requestId)) {
        throw new Error("analysis_runs: run_id does not belong to request_id");
      }
      runId = incomingRunId;
    } else {
      const insertedRun = await supabase
        .from("analysis_runs")
        .insert({ request_id: requestId, report_type: reportType })
        .select("id")
        .single();
      if (insertedRun.error) throw new Error(errToMessage(insertedRun.error));
      runId = Number((insertedRun.data as { id: number }).id);
    }

    const restaurants = body.restaurants ?? [];
    if (restaurants.length === 0) {
      return new Response(JSON.stringify({ error: "restaurants array is required and must not be empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const restIdMap = new Map<number, number>();
    const insertedRestaurants = await supabase
      .from("restaurants")
      .insert(restaurants.map((r) => ({ ...omitId(r), run_id: runId })))
      .select("id");
    if (insertedRestaurants.error) throw new Error(errToMessage(insertedRestaurants.error));
    const newRestIds = (insertedRestaurants.data ?? []).map((r) => Number((r as { id: number }).id));
    restaurants.forEach((r, i) => {
      const oldId = typeof r.id === "number" ? r.id : Number(r.id);
      if (newRestIds[i] != null) restIdMap.set(oldId, newRestIds[i]);
    });

    const menus = (body.menus ?? []).map((m) => ({
      ...omitId(m),
      restaurant_id: restIdMap.get(Number(m.restaurant_id)) ?? m.restaurant_id,
      run_id: runId,
    }));
    const menuIdMap = new Map<number, number>();
    if (menus.length > 0) {
      const bodyMenus = body.menus ?? [];
      const insertedMenus = await supabase.from("menus").insert(menus).select("id");
      if (insertedMenus.error) throw new Error(errToMessage(insertedMenus.error));
      const newMenuIds = (insertedMenus.data ?? []).map((m) => Number((m as { id: number }).id));
      bodyMenus.forEach((m, i) => {
        const oldId = typeof m.id === "number" ? m.id : Number(m.id);
        if (newMenuIds[i] != null) menuIdMap.set(oldId, newMenuIds[i]);
      });
    }

    const menuItems = (body.menuItems ?? []).map((mi) => ({
      ...omitId(mi),
      menu_id: menuIdMap.get(Number(mi.menu_id)) ?? mi.menu_id,
      run_id: runId,
    }));
    if (menuItems.length > 0) {
      const { error } = await supabase.from("menu_items").insert(menuItems);
      if (error) throw new Error(errToMessage(error));
    }

    const reviews = (body.reviews ?? []).map((r) => ({
      ...omitId(r),
      restaurant_id: restIdMap.get(Number(r.restaurant_id)) ?? r.restaurant_id,
      run_id: runId,
    }));
    if (reviews.length > 0) {
      const { error } = await supabase.from("reviews").insert(reviews);
      if (error) throw new Error(errToMessage(error));
    }

    const marketingRows = (body.marketing ?? []).map((m) => ({
      ...omitId(m),
      restaurant_id: restIdMap.get(Number(m.restaurant_id)) ?? m.restaurant_id,
      run_id: runId,
    }));
    const marketingIdMap = new Map<number, number>();
    if (marketingRows.length > 0) {
      const bodyMarketing = body.marketing ?? [];
      const insertedMarketing = await supabase.from("marketing").insert(marketingRows).select("id");
      if (insertedMarketing.error) throw new Error(errToMessage(insertedMarketing.error));
      const newIds = (insertedMarketing.data ?? []).map((m) => Number((m as { id: number }).id));
      bodyMarketing.forEach((m, i) => {
        const oldId = typeof m.id === "number" ? m.id : Number(m.id);
        if (newIds[i] != null) marketingIdMap.set(oldId, newIds[i]);
      });
    }

    const marketingSocials = (body.marketingSocials ?? []).map((s) => ({
      ...omitId(s),
      marketing_id: marketingIdMap.get(Number(s.marketing_id)) ?? s.marketing_id,
      run_id: runId,
    }));
    if (marketingSocials.length > 0) {
      const { error } = await supabase.from("marketing_socials").insert(marketingSocials);
      if (error) throw new Error(errToMessage(error));
    }

    const marketingLoyalty = (body.marketingLoyalty ?? []).map((l) => ({
      ...omitId(l),
      marketing_id: marketingIdMap.get(Number(l.marketing_id)) ?? l.marketing_id,
      run_id: runId,
    }));
    if (marketingLoyalty.length > 0) {
      const { error } = await supabase.from("marketing_loyalty").insert(marketingLoyalty);
      if (error) throw new Error(errToMessage(error));
    }

    const technicalAnalysis = (body.technicalAnalysis ?? []).map((t) => ({
      ...omitId(t),
      restaurant_id: restIdMap.get(Number(t.restaurant_id)) ?? t.restaurant_id,
      run_id: runId,
    }));
    if (technicalAnalysis.length > 0) {
      const { error } = await supabase.from("technical_analysis").insert(technicalAnalysis);
      if (error) throw new Error(errToMessage(error));
    }

    const strategicReport = (body.strategicReport ?? []).map((s) => ({
      ...omitId(s),
      restaurant_id: restIdMap.get(Number(s.restaurant_id)) ?? s.restaurant_id,
      run_id: runId,
    }));
    if (strategicReport.length > 0) {
      const { error } = await supabase.from("strategic_report").insert(strategicReport);
      if (error) throw new Error(errToMessage(error));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        requestId,
        runId,
        restaurants: insertedRestaurants.data?.length ?? 0,
        menus: menus.length,
        menuItems: menuItems.length,
        reviews: reviews.length,
        marketing: marketingRows.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = errToMessage(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

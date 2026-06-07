import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const getDhakaTodayAndTomorrow = () => {
  const now = new Date();
  const dhakaNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const today = dhakaNow.toISOString().split("T")[0];
  const tomorrow = new Date(dhakaNow.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { today, tomorrow };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { today, tomorrow } = getDhakaTodayAndTomorrow();

  let sourceDate = today;
  let targetDate = tomorrow;
  let triggeredBy = "cron";

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.source_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.source_date)) {
        sourceDate = body.source_date;
      }
      if (typeof body?.target_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.target_date)) {
        targetDate = body.target_date;
      }
      if (body?.triggered_by === "manual") {
        triggeredBy = "manual";
      }
    } catch {
      // keep defaults
    }
  }

  const { data: activeUsers, error: usersError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("is_active", true);

  if (usersError) {
    return new Response(JSON.stringify({ error: usersError.message }), { status: 500, headers: corsHeaders });
  }

  if (!activeUsers || activeUsers.length === 0) {
    return new Response(JSON.stringify({ message: "No active users" }), { status: 200, headers: corsHeaders });
  }

  const [existingTargetMealsRes, sourceMealsRes] = await Promise.all([
    supabase.from("daily_meals").select("id, user_id, lunch, dinner, lunch_extra_option, dinner_extra_option").eq("meal_date", targetDate),
    supabase
      .from("daily_meals")
      .select("user_id, lunch, dinner, lunch_extra_option, dinner_extra_option, lunch_off_today_only, dinner_off_today_only")
      .eq("meal_date", sourceDate),
  ]);

  if (existingTargetMealsRes.error) {
    return new Response(JSON.stringify({ error: existingTargetMealsRes.error.message }), { status: 500, headers: corsHeaders });
  }

  if (sourceMealsRes.error) {
    return new Response(JSON.stringify({ error: sourceMealsRes.error.message }), { status: 500, headers: corsHeaders });
  }

  const existingTargetMap = new Map(
    (existingTargetMealsRes.data || []).map((m) => [m.user_id, m])
  );
  const sourceMealMap = new Map(
    (sourceMealsRes.data || []).map((m) => [m.user_id, m])
  );

  const rowsToInsert: any[] = [];
  const rowsToUpdate: { id: string; data: any }[] = [];
  let skippedCount = 0;

  for (const u of activeUsers) {
    const sourceMeal = sourceMealMap.get(u.user_id);
    if (!sourceMeal) { skippedCount++; continue; }

    // If user marked "off today only", flip back ON for next day
    const carriedLunch = sourceMeal.lunch_off_today_only ? true : sourceMeal.lunch;
    const carriedDinner = sourceMeal.dinner_off_today_only ? true : sourceMeal.dinner;

    const existingTarget = existingTargetMap.get(u.user_id);

    if (!existingTarget) {
      rowsToInsert.push({
        user_id: u.user_id,
        meal_date: targetDate,
        lunch: carriedLunch,
        dinner: carriedDinner,
        lunch_extra_option: sourceMeal.lunch_extra_option,
        dinner_extra_option: sourceMeal.dinner_extra_option,
      });
    } else {
      skippedCount++;
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("daily_meals").insert(rowsToInsert);
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
    }
  }

  let updatedCount = 0;
  for (const row of rowsToUpdate) {
    const { error } = await supabase.from("daily_meals").update(row.data).eq("id", row.id);
    if (!error) updatedCount++;
  }

  // Auto-delete expired special day items (past dates)
  await supabase.from("special_day_responses")
    .delete()
    .lt("item_id", today) // will be handled by cascade or separate query
  // Delete special_day_items where item_date < today
  const { data: expiredItems } = await supabase
    .from("special_day_items")
    .select("id")
    .lt("item_date", today);
  if (expiredItems && expiredItems.length > 0) {
    const expiredIds = expiredItems.map((i: any) => i.id);
    await supabase.from("special_day_responses").delete().in("item_id", expiredIds);
    await supabase.from("special_day_items").delete().in("id", expiredIds);
  }

  // Log the carry result
  await supabase.from("carry_logs").insert({
    source_date: sourceDate,
    target_date: targetDate,
    total_active_users: activeUsers.length,
    inserted_count: rowsToInsert.length,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    triggered_by: triggeredBy,
  });

  return new Response(
    JSON.stringify({
      message: `Inserted ${rowsToInsert.length}, updated ${updatedCount}, skipped ${skippedCount}`,
      source_date: sourceDate,
      target_date: targetDate,
      active_users: activeUsers.length,
      source_rows_found: sourceMealMap.size,
      triggered_by: triggeredBy,
    }),
    { status: 200, headers: corsHeaders }
  );
});

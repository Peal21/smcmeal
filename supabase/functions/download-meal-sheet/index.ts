import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

function getDhakaDate(offset = 0) {
  const now = new Date();
  const dhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  dhaka.setDate(dhaka.getDate() + offset);
  return dhaka.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const gender = url.searchParams.get("gender") || "male";
    const date = url.searchParams.get("date") || getDhakaDate(1);
    const yearsParam = url.searchParams.get("years") || "1st,2nd,3rd,4th,5th,extra";
    const filterYears = yearsParam.split(",");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, year, roll_number")
      .eq("is_active", true)
      .eq("gender", gender)
      .in("year", filterYears)
      .order("roll_number");

    if (!profiles?.length) {
      return new Response(JSON.stringify({ error: "No data found" }), { status: 404, headers: corsHeaders });
    }

    const userIds = profiles.map((p: any) => p.user_id);
    const [{ data: meals }, { data: extraMeals }] = await Promise.all([
      supabase.from("daily_meals")
        .select("user_id, lunch, dinner, lunch_extra_option")
        .eq("meal_date", date)
        .in("user_id", userIds),
      supabase.from("extra_meals")
        .select("user_id, meal_type, quantity, meal_count_equivalent, is_feast_day, extra_option")
        .eq("meal_date", date)
        .in("user_id", userIds),
    ]);

    return new Response(JSON.stringify({ profiles, meals: meals || [], extraMeals: extraMeals || [], date }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

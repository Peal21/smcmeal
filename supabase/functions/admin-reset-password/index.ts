import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 1. Get calling user
    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseClient.auth.getUser();

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "অননুমোদিত অ্যাক্সেস (Unauthorized)" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Check if caller has admin or meal_manager role using service role (bypasses RLS)
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    if (rolesError) {
      console.error("Role lookup error:", rolesError);
    }

    const isAdmin = roles?.some(
      (r: any) => r.role === "meal_manager" || r.role === "super_admin"
    );

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "অনুমতি নেই — শুধু মিল ম্যানেজার বা সুপার অ্যাডমিন পাসওয়ার্ড পরিবর্তন করতে পারেন।" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await req.json();
    let targetUserId = body.target_user_id;
    const newPassword = body.new_password;

    if (!targetUserId && body.email) {
      // Find target user by email
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const found = userList?.users?.find((u: any) => u.email?.toLowerCase() === body.email?.toLowerCase().trim());
      if (found) targetUserId = found.id;
    }

    if (!targetUserId && body.profile_id) {
      const { data: p } = await supabaseAdmin.from("profiles").select("user_id").eq("id", body.profile_id).maybeSingle();
      if (p?.user_id) targetUserId = p.user_id;
    }

    if (!targetUserId || !newPassword) {
      return new Response(
        JSON.stringify({ error: "target_user_id এবং new_password আবশ্যক" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Update target user's password in auth.users
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error("updateUserById error:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message || "পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে" }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("admin-reset-password error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "সার্ভার সমস্যা হয়েছে" }),
      { status: 500, headers: corsHeaders }
    );
  }
});


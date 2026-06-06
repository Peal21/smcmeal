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
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the calling user
    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseClient.auth.getUser();

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if caller is admin/manager
    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isAdmin = roles?.some(
      (r: any) =>
        r.role === "meal_manager" || r.role === "super_admin"
    );

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Permission denied" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const { target_user_id, new_password } = await req.json();

    if (!target_user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: "target_user_id and new_password required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Use service role to update the target user's password
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        password: new_password,
      });

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ message: "Password updated successfully" }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // ─── GENERATE OTP ───
    if (action === "generate") {
      const email = (body.email || "").trim().toLowerCase();
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Check user exists via admin API (listUsers to avoid recovery link generation/rate limits)
      let userId: string;
      try {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000,
        });
        if (error || !data?.users) {
          return new Response(
            JSON.stringify({ error: "ইউজারদের তালিকা পেতে সমস্যা হয়েছে" }),
            { status: 500, headers: corsHeaders }
          );
        }
        const user = data.users.find(
          (u: any) => u.email?.toLowerCase() === email
        );
        if (!user) {
          return new Response(
            JSON.stringify({ error: "এই ইমেইলে কোনো অ্যাকাউন্ট নেই" }),
            { status: 404, headers: corsHeaders }
          );
        }
        userId = user.id;
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: "ইউজার যাচাই করতে সমস্যা হয়েছে" }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Invalidate any existing codes for this email
      await supabaseAdmin
        .from("password_reset_codes")
        .update({ used: true })
        .eq("email", email)
        .eq("used", false);

      // Generate new code
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      const { error: insertError } = await supabaseAdmin
        .from("password_reset_codes")
        .insert({
          user_id: userId,
          email,
          code,
          expires_at: expiresAt,
          used: false,
        });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "কোড তৈরি করতে সমস্যা হয়েছে" }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Return the code — this allows the frontend to show it directly.
      // The user can also check testmail.app for the standard recovery email.
      return new Response(
        JSON.stringify({
          success: true,
          code,
          message: "৬ সংখ্যার কোড তৈরি হয়েছে",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ─── VERIFY OTP & RESET PASSWORD ───
    if (action === "verify") {
      const email = (body.email || "").trim().toLowerCase();
      const code = (body.code || "").trim();
      const newPassword = body.new_password || "";

      if (!email || !code || !newPassword) {
        return new Response(
          JSON.stringify({ error: "email, code, এবং new_password দরকার" }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Look up the code
      const { data: codes, error: lookupError } = await supabaseAdmin
        .from("password_reset_codes")
        .select("*")
        .eq("email", email)
        .eq("code", code)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (lookupError || !codes || codes.length === 0) {
        return new Response(
          JSON.stringify({ error: "কোড ভুল অথবা মেয়াদ শেষ হয়ে গেছে" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const resetCode = codes[0];

      // Mark code as used
      await supabaseAdmin
        .from("password_reset_codes")
        .update({ used: true })
        .eq("id", resetCode.id);

      // Update user password
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(resetCode.user_id, {
          password: newPassword,
        });

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'generate' or 'verify'" }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

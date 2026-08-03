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

      // Send email via Resend if RESEND_API_KEY is configured
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      let emailSent = false;
      let emailError = "";

      if (resendApiKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "SMC Meal Mate <onboarding@resend.dev>",
              to: email,
              subject: "Password Reset OTP Code - SMC Meal Mate",
              html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #f9f9f9;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="color: #2563eb; margin: 0;">সাতক্ষীরা মেডিকেল কলেজ</h2>
    <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">মিল ম্যানেজমেন্ট সিস্টেম</p>
  </div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
  <div style="background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
    <p style="font-size: 16px; color: #333; line-height: 1.5;">প্রিয় সদস্য,</p>
    <p style="font-size: 15px; color: #555; line-height: 1.5;">আপনার অ্যাকাউন্ট পাসওয়ার্ড রিসেট করার জন্য একটি অনুরোধ পাওয়া গেছে। আপনার ৬ সংখ্যার ওটিপি (OTP) কোডটি নিচে দেওয়া হলো:</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background-color: #eff6ff; padding: 10px 20px; border-radius: 6px; border: 1px dashed #3b82f6;">${code}</span>
    </div>
    <p style="font-size: 13px; color: #ef4444; font-weight: 500;">কোডটি আগামী ৫ মিনিটের জন্য কার্যকর থাকবে।</p>
    <p style="font-size: 14px; color: #555; line-height: 1.5; margin-top: 25px;">আপনি যদি এই অনুরোধটি না করে থাকেন, তবে দয়া করে এই ইমেইলটি উপেক্ষা করুন এবং আপনার পাসওয়ার্ডটি নিরাপদ রাখুন।</p>
  </div>
  <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #999;">
    <p>© ২০২৬ সাতক্ষীরা মেডিকেল কলেজ মিল ম্যানেজমেন্ট সিস্টেম। সর্বস্বত্ব সংরক্ষিত।</p>
  </div>
</div>
              `,
            }),
          });
          
          if (res.ok) {
            emailSent = true;
          } else {
            const errData = await res.json();
            emailError = errData.message || "Failed to send email via Resend API";
          }
        } catch (e: any) {
          emailError = e.message || "Error calling Resend API";
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          code: resendApiKey ? undefined : code, // Return code in response for testing if Resend API Key is not set
          email_sent: emailSent,
          message: emailSent
            ? "আপনার ইমেইলে ৬ সংখ্যার ওটিপি কোড পাঠানো হয়েছে।"
            : (resendApiKey ? `ইমেইল পাঠানো ব্যর্থ হয়েছে: ${emailError}` : "কোড তৈরি হয়েছে (Resend API Key সেট করা নেই)"),
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

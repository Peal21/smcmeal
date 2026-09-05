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
      const rawInput = (body.email || body.identifier || "").trim();
      if (!rawInput) {
        return new Response(
          JSON.stringify({ error: "ইমেইল বা রোল নম্বর দিন" }),
          { status: 400, headers: corsHeaders }
        );
      }

      let userId: string | null = null;
      let userEmail: string | null = null;
      let userName: string = "";

      // 1. If contains '@', look up directly in auth users
      if (rawInput.includes("@")) {
        const inputEmail = rawInput.toLowerCase();
        try {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            perPage: 1000,
          });
          if (!error && data?.users) {
            const user = data.users.find(
              (u: any) => u.email?.toLowerCase().trim() === inputEmail
            );
            if (user) {
              userId = user.id;
              userEmail = user.email?.toLowerCase().trim() || inputEmail;
            }
          }
        } catch (e) {
          console.error("Auth listUsers lookup error:", e);
        }
      }

      // 2. If not found yet, check profiles table by email, roll_number, or phone
      if (!userId) {
        try {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("user_id, full_name, roll_number")
            .or(
              `roll_number.eq.${rawInput},full_name.ilike.%${rawInput}%`
            )
            .limit(1)
            .maybeSingle();

          if (profile?.user_id) {
            userId = profile.user_id;
            userName = profile.full_name || "";
            const { data: uData } = await supabaseAdmin.auth.admin.getUserById(
              profile.user_id
            );
            if (uData?.user?.email) {
              userEmail = uData.user.email.toLowerCase().trim();
            }
          }
        } catch (e) {
          console.error("Profile lookup error:", e);
        }
      }

      // 3. If still not found and has '@', attempt direct getUser by email if listUsers was paginated
      if (!userId && rawInput.includes("@")) {
        userEmail = rawInput.toLowerCase();
      }

      if (!userId || !userEmail) {
        return new Response(
          JSON.stringify({
            error: "এই ইমেইল বা রোল নম্বরে কোনো সক্রিয় অ্যাকাউন্ট পাওয়া যায়নি।",
          }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Fetch user profile name if not set
      if (!userName) {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .maybeSingle();
        userName = prof?.full_name || "সদস্য";
      }

      // Invalidate any previous unused codes for this email or user_id
      await supabaseAdmin
        .from("password_reset_codes")
        .update({ used: true })
        .or(`email.eq.${userEmail},user_id.eq.${userId}`)
        .eq("used", false);

      // Generate new 6-digit code with 10-minute validity
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertError } = await supabaseAdmin
        .from("password_reset_codes")
        .insert({
          user_id: userId,
          email: userEmail,
          code,
          expires_at: expiresAt,
          used: false,
        });

      if (insertError) {
        console.error("Error inserting password reset code:", insertError);
        return new Response(
          JSON.stringify({ error: "কোড তৈরি করতে সমস্যা হয়েছে" }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Try sending email via Resend if RESEND_API_KEY is configured
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      let emailSent = false;
      let emailError = "";

      if (resendApiKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "SMC Meal Mate <onboarding@resend.dev>",
              to: userEmail,
              subject: "Password Reset OTP Code - SMC Meal Mate",
              html: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #f9f9f9;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="color: #2563eb; margin: 0;">সাতক্ষীরা মেডিকেল কলেজ</h2>
    <p style="font-size: 13px; color: #666; margin: 5px 0 0 0;">মিল ম্যানেজমেন্ট সিস্টেম</p>
  </div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
  <div style="background-color: #fff; padding: 24px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
    <p style="font-size: 16px; color: #333; line-height: 1.5; margin-top: 0;">প্রিয় <strong>${userName}</strong>,</p>
    <p style="font-size: 14px; color: #555; line-height: 1.6;">আপনার অ্যাকাউন্ট পাসওয়ার্ড পরিবর্তন করার জন্য ওটিপি (OTP) কোড অনুরোধ করা হয়েছে। আপনার ৬ সংখ্যার ভেরিফিকেশন কোডটি নিচে দেওয়া হলো:</p>
    <div style="text-align: center; margin: 25px 0;">
      <span style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #2563eb; background-color: #eff6ff; padding: 12px 24px; border-radius: 8px; border: 2px dashed #3b82f6; display: inline-block;">${code}</span>
    </div>
    <p style="font-size: 13px; color: #ef4444; font-weight: 600; text-align: center;">⏱️ কোডটি আগামী ১০ মিনিটের জন্য কার্যকর থাকবে।</p>
    <p style="font-size: 13px; color: #666; line-height: 1.5; margin-top: 25px; border-top: 1px solid #f0f0f0; padding-top: 15px;">আপনি যদি এই অনুরোধটি না করে থাকেন, তবে দয়া করে এই ইমেইলটি উপেক্ষা করুন এবং আপনার পাসওয়ার্ড কাউকে শেয়ার করবেন না।</p>
  </div>
  <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #999;">
    <p>© ২০২৬ সাতক্ষীরা মেডিকেল কলেজ মিল ম্যানেজমেন্ট সিস্টেম। সর্বস্বত্ব সংরক্ষিত।</p>
  </div>
</div>
              `,
            }),
          });

          if (res.ok) {
            emailSent = true;
          } else {
            const errData = await res.json().catch(() => ({}));
            emailError = errData.message || "Failed to send email via Resend API";
            console.warn("Resend email send warning:", emailError);
          }
        } catch (e: any) {
          emailError = e.message || "Error calling Resend API";
          console.warn("Resend exception:", emailError);
        }
      }

      // ALWAYS return code in the response so no user is ever locked out!
      return new Response(
        JSON.stringify({
          success: true,
          code: code,
          email: userEmail,
          user_name: userName,
          email_sent: emailSent,
          message: emailSent
            ? "আপনার ইমেইলে ৬ সংখ্যার ওটিপি কোড পাঠানো হয়েছে।"
            : "আপনার জন্য ওটিপি কোড তৈরি করা হয়েছে। নিচে প্রদত্ত কোডটি দিয়ে পাসওয়ার্ড পরিবর্তন করুন।",
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
          JSON.stringify({ error: "ইমেইল, কোড এবং নতুন পাসওয়ার্ড প্রয়োজন" }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Look up valid active code
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
          JSON.stringify({ error: "কোড ভুল অথবা মেয়াদ শেষ হয়ে গেছে। নতুন কোড নিন।" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const resetCode = codes[0];

      // Mark code as used
      await supabaseAdmin
        .from("password_reset_codes")
        .update({ used: true })
        .eq("id", resetCode.id);

      // Update user password in Supabase Auth
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(resetCode.user_id, {
          password: newPassword,
        });

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message || "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে" }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! নতুন পাসওয়ার্ড দিয়ে লগইন করুন।",
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'generate' or 'verify'" }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("password-reset-otp error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "সার্ভার সমস্যা হয়েছে" }),
      { status: 500, headers: corsHeaders }
    );
  }
});


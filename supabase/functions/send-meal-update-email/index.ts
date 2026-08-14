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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY environment variable is not configured.");
      return new Response(
        JSON.stringify({ message: "Resend API key not configured, email skipped." }),
        { status: 200, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const { email, name, mealType, action, mealDate, startDate, endDate } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    let subject = "";
    let actionText = "";
    let detailsHtml = "";

    if (action === "ON" || action === "OFF") {
      const typeText = mealType === "lunch" ? "লাঞ্চ" : "ডিনার";
      actionText = action === "ON" ? "চালু (ON)" : "বন্ধ (OFF)";
      subject = `Meal Status Update: ${typeText} ${actionText} - SMC Meal Mate`;
      detailsHtml = `
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>আপডেটের ধরন:</strong> আগামীকালের মিল স্ট্যাটাস পরিবর্তন
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>মিল:</strong> ${typeText} (${mealType === 'lunch' ? 'দুপুর' : 'রাত'})
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>স্ট্যাটাস:</strong> <span style="color: ${action === 'ON' ? '#16a34a' : '#dc2626'}; font-weight: bold;">${actionText} করা হয়েছে</span>
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>তারিখ:</strong> ${mealDate}
        </p>
      `;
    } else if (action === "HOLIDAY_START") {
      subject = "Vacation Mode Enabled - SMC Meal Mate";
      detailsHtml = `
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>আপডেটের ধরন:</strong> ছুটি / মিল অফ ডেট রেঞ্জ চালু
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>ছুটির সময়সীমা:</strong> ${startDate} হতে ${endDate}
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>স্ট্যাটাস:</strong> এই ডেট রেঞ্জের মধ্যে আপনার লাঞ্চ ও ডিনারের সকল মিল সয়ংক্রিয়ভাবে <span style="color: #dc2626; font-weight: bold;">বন্ধ (OFF)</span> থাকবে।
        </p>
      `;
    } else if (action === "HOLIDAY_CANCEL") {
      subject = "Vacation Mode Cancelled - SMC Meal Mate";
      detailsHtml = `
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>আপডেটের ধরন:</strong> ছুটি / মিল অফ ডেট রেঞ্জ বাতিল
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>ছুটির সময়সীমা:</strong> ${startDate} হতে ${endDate}
        </p>
        <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 5px 0;">
          <strong>স্ট্যাটাস:</strong> আপনার ছুটি বাতিল করা হয়েছে। মিল পুনরায় স্বাভাবিক নিয়মে সচল থাকবে।
        </p>
      `;
    }

    const htmlContent = `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h2 style="color: #1e3a8a; margin: 0; font-size: 22px;">সাতক্ষীরা মেডিকেল কলেজ</h2>
    <p style="font-size: 13px; color: #64748b; margin: 5px 0 0 0; font-weight: 500;">মিল ম্যানেজমেন্ট সিস্টেম (SMC Meal Mate)</p>
  </div>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
  <div style="background-color: #ffffff; padding: 25px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <p style="font-size: 16px; color: #0f172a; margin-top: 0; font-weight: 600;">প্রিয় ${name || 'সদস্য'},</p>
    <p style="font-size: 15px; color: #334155; line-height: 1.6;">আপনার SMC Meal Mate অ্যাকাউন্ট থেকে একটি সফল মিল আপডেট সম্পন্ন হয়েছে। বিস্তারিত তথ্য নিচে দেওয়া হলো:</p>
    <div style="background-color: #f1f5f9; padding: 15px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e3a8a;">
      ${detailsHtml}
    </div>
    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 0;">যেকোনো প্রয়োজনে অনুগ্রহ করে আপনার মিল ম্যানেজারের সাথে সরাসরি যোগাযোগ করুন।</p>
  </div>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0 20px 0;" />
  <div style="text-align: center;">
    <p style="font-size: 11px; color: #94a3b8; margin: 0;">এটি একটি সিস্টেম জেনারেটেড সয়ংক্রিয় ইমেইল, দয়া করে এখানে সরাসরি রিপ্লাই করবেন না।</p>
    <p style="font-size: 11px; color: #cbd5e1; margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} SMC Meal Mate. All rights reserved.</p>
  </div>
</div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "SMC Meal Mate <onboarding@resend.dev>",
        to: email,
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", errText);
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${errText}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    const resData = await res.json();
    return new Response(
      JSON.stringify({ message: "Email sent successfully", data: resData }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Error in Edge Function:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

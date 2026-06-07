import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRA_LABEL_MAP: Record<string, string> = {
  beef: 'গরু',
  mutton: 'খাসি',
  chicken: 'গরু/খাসির পরিবর্তে মুরগি',
  egg_fish_fry: 'ডিম ভাজি (মাছ)',
  egg_fish_poach: 'ডিম পোচ (মাছ)',
  egg_chicken_fry: 'ডিম ভাজি (পোল্ট্রি)',
  egg_chicken_poach: 'ডিম পোচ (পোল্ট্রি)',
  egg_instead_of_fish: 'ডিম (মাছ)',
  egg_instead_of_chicken: 'ডিম (পোল্ট্রি)',
  egg_fry: 'ডিম ভাজি',
  egg_poach: 'ডিম পোচ',
};

function getFormattedDate(date: Date): string {
  const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year} (${dayName})`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from('app_settings')
      .select('telegram_chat_id, telegram_enabled')
      .eq('id', 1)
      .single();

    if (settings && (settings as any).telegram_enabled === false) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'Telegram bot disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let chatId = settings?.telegram_chat_id;
    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Telegram chat ID not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    // Use Bangladesh time (UTC+6) for all date calculations to match frontend
    const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const todayStr = bdNow.toISOString().split('T')[0];
    const bdTomorrow = new Date(bdNow.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = bdTomorrow.toISOString().split('T')[0];
    // Create a proper Date object for tomorrow in BD timezone for display
    const tomorrow = new Date(tomorrowStr + 'T00:00:00');

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, year, roll_number')
      .eq('is_active', true)
      .order('roll_number', { ascending: true, nullsFirst: false });

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No active profiles' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    profiles.sort((a: any, b: any) => {
      const ra = a.roll_number ? parseInt(a.roll_number, 10) : Infinity;
      const rb = b.roll_number ? parseInt(b.roll_number, 10) : Infinity;
      if (isNaN(ra) && isNaN(rb)) return (a.roll_number || '').localeCompare(b.roll_number || '');
      if (isNaN(ra)) return 1;
      if (isNaN(rb)) return -1;
      return ra - rb;
    });

    const { data: tomorrowMeals } = await supabase
      .from('daily_meals')
      .select('user_id, lunch, dinner, lunch_extra_option')
      .eq('meal_date', tomorrowStr);

    const { data: todayMeals } = await supabase
      .from('daily_meals')
      .select('user_id, lunch, dinner')
      .eq('meal_date', todayStr);

    const { data: extraMealsData } = await supabase
      .from('extra_meals')
      .select('user_id, meal_type, quantity, extra_option, is_feast_day')
      .eq('meal_date', tomorrowStr);

    const { data: feastConfig } = await supabase
      .from('feast_day_config')
      .select('feast_date')
      .eq('feast_date', tomorrowStr);
    const isFeastDay = feastConfig && feastConfig.length > 0;

    const { data: specialItems } = await supabase
      .from('special_day_items')
      .select('id, item_name')
      .eq('item_date', tomorrowStr);

    const { data: specialResponses } = await supabase
      .from('special_day_responses')
      .select('user_id, item_id, opted_in');

    const tomorrowMap = new Map<string, any>();
    (tomorrowMeals || []).forEach((m: any) => tomorrowMap.set(m.user_id, m));

    const todayMap = new Map<string, any>();
    (todayMeals || []).forEach((m: any) => todayMap.set(m.user_id, m));

    const extraMap = new Map<string, { extraLunch: number; extraDinner: number }>();
    const extraOptionMap = new Map<string, string[]>();
    (extraMealsData || []).forEach((em: any) => {
      const cur = extraMap.get(em.user_id) || { extraLunch: 0, extraDinner: 0 };
      if (em.meal_type === 'lunch') cur.extraLunch += em.quantity;
      else cur.extraDinner += em.quantity;
      extraMap.set(em.user_id, cur);

      if (em.extra_option) {
        const opts = em.extra_option.split(',').map((v: string) => v.trim()).filter(Boolean);
        const existing = extraOptionMap.get(em.user_id) || [];
        existing.push(...opts);
        extraOptionMap.set(em.user_id, existing);
      }
    });

    const specialItemMap = new Map<string, string>();
    (specialItems || []).forEach((si: any) => specialItemMap.set(si.id, si.item_name));

    const userSpecialMap = new Map<string, string[]>();
    (specialResponses || []).forEach((sr: any) => {
      if (sr.opted_in && specialItemMap.has(sr.item_id)) {
        const existing = userSpecialMap.get(sr.user_id) || [];
        existing.push(specialItemMap.get(sr.item_id)!);
        userSpecialMap.set(sr.user_id, existing);
      }
    });

    const hours = bdNow.getUTCHours();
    const minutes = bdNow.getUTCMinutes();
    const timeStr = `${hours}:${String(minutes).padStart(2, '0')}`;
    const remainingMinutes = Math.max(0, (22 * 60) - (hours * 60 + minutes));

    const extraCounts: Record<string, number> = {};
    Object.keys(EXTRA_LABEL_MAP).forEach((key) => {
      extraCounts[key] = 0;
    });

    const lines: string[] = [];
    let updatedCount = 0;
    let notUpdatedCount = 0;
    const warnings: string[] = [];
    let totalLunch = 0;
    let totalDinner = 0;

    profiles.forEach((p: any, idx: number) => {
      const meal = tomorrowMap.get(p.user_id);
      const todayMeal = todayMap.get(p.user_id);
      const extra = extraMap.get(p.user_id);
      const rollLabel = p.roll_number || '—';

      if (meal) {
        updatedCount++;
        const lunchCount = (meal.lunch ? 1 : 0) + (extra?.extraLunch || 0);
        const dinnerCount = (meal.dinner ? 1 : 0) + (extra?.extraDinner || 0);
        totalLunch += lunchCount;
        totalDinner += dinnerCount;

        const lunchStr = lunchCount > 1 ? `☀️ L: ${lunchCount}` : lunchCount === 1 ? '☀️ L: ✅' : '☀️ L: ❌';
        const dinnerStr = dinnerCount > 1 ? `🌙 D: ${dinnerCount}` : dinnerCount === 1 ? '🌙 D: ✅' : '🌙 D: ❌';

        const rawExtraKeys = (meal.lunch_extra_option || '')
          .split(',').map((v: string) => v.trim()).filter(Boolean);
        const extraMealKeys = extraOptionMap.get(p.user_id) || [];
        const allRawKeys = [...rawExtraKeys, ...extraMealKeys];
        const displayKeys = isFeastDay ? allRawKeys : allRawKeys.filter((k: string) => k !== 'chicken');

        displayKeys.forEach((key: string) => {
          if (extraCounts[key] !== undefined) {
            extraCounts[key] += 1;
          }
        });

        const keyCounts = new Map<string, number>();
        for (const key of displayKeys) {
          keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
        }

        const specialLabels = userSpecialMap.get(p.user_id) || [];
        const countedLabels = Array.from(keyCounts.entries()).map(([key, count]) => {
          const label = EXTRA_LABEL_MAP[key] || key;
          return count > 1 ? `${count}টি ${label}` : `${label}`;
        });
        const allExtra = [...countedLabels, ...specialLabels];
        const extraText = allExtra.length > 0 ? ` [🍖 ${allExtra.join(', ')}]` : '';

        lines.push(`🟢 [${rollLabel}] ${p.full_name} ➔ ${lunchStr} | ${dinnerStr}${extraText}`);
      } else {
        notUpdatedCount++;
        let warning = '';
        if (todayMeal) {
          const todayLunchOff = !todayMeal.lunch;
          const todayDinnerOff = !todayMeal.dinner;
          if (todayLunchOff || todayDinnerOff) {
            const parts: string[] = [];
            if (todayLunchOff) parts.push('L');
            if (todayDinnerOff) parts.push('D');
            warning = ` ⚠️ আজ ${parts.join(',')} OFF ছিল!`;
            warnings.push(p.full_name);
          }
        }
        lines.push(`🔴 [${rollLabel}] ${p.full_name} ➔ আপডেট দেয়নি${warning}`);
      }
    });

    let message = `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🍽️  <b>মিল স্ট্যাটাস রিপোর্ট (Meal Status Report)</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📅 <b>তারিখ:</b> ${getFormattedDate(tomorrow)}\n`;
    message += `🕐 <b>রিপোর্ট সময়:</b> ${timeStr} (⏳ বাকি: ${remainingMinutes} মিনিট)\n\n`;
    message += `📊 <b>আপডেট স্থিতি:</b>\n`;
    message += `   🟢 আপডেট দিয়েছেন: <b>${updatedCount} জন</b>\n`;
    if (notUpdatedCount > 0) {
      message += `   🔴 বাকি আছেন: <b>${notUpdatedCount} জন</b>\n`;
    } else {
      message += `   🎉 সবাই আপডেট দিয়েছেন!\n`;
    }
    message += `\n🍴 <b>মিল হিসেব:</b>\n`;
    message += `   ☀️ লাঞ্চ (Lunch): <b>${totalLunch} টি</b>\n`;
    message += `   🌙 ডিনার (Dinner): <b>${totalDinner} টি</b>\n`;
    message += `   📈 মোট মিল: <b>${totalLunch + totalDinner} টি</b>\n`;

    const EXTRA_SUMMARY_ORDER = [
      'beef',
      'mutton',
      'chicken',
      'egg_fish_fry',
      'egg_fish_poach',
      'egg_chicken_fry',
      'egg_chicken_poach',
      'egg_instead_of_fish',
      'egg_instead_of_chicken',
      'egg_fry',
      'egg_poach',
    ];

    let extraLines = '';
    EXTRA_SUMMARY_ORDER.forEach((key) => {
      const count = extraCounts[key] || 0;
      if (count > 0) {
        const label = EXTRA_LABEL_MAP[key];
        extraLines += `   🥩 ${label}: <b>${count} টি</b>\n`;
      }
    });

    if (extraLines) {
      message += `\n🍖 <b>বিবিধ হিসেব (Extra Options):</b>\n` + extraLines;
    }
    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `<b>👤 সদস্য তালিকা (Roll অনুযায়ী):</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += lines.join('\n');

    if (warnings.length > 0) {
      message += `\n\n🚨 <b>সতর্কতা! আজ OFF ছিল কিন্তু আগামীকালের আপডেট দেয়নি:</b>\n`;
      warnings.forEach((name) => { message += `⚠️ ${name}\n`; });
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    if (notUpdatedCount > 0) {
      message += `⚠️ <i>মিল আপডেট দিন! রাত ১০টার পর বন্ধ হয়ে যাবে।</i>`;
    } else {
      message += `🎉 <i>সবাই সফলভাবে মিল আপডেট সম্পন্ন করেছেন!</i>`;
    }

    const sendMessage = async (targetChatId: string) => {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: targetChatId, text: message, parse_mode: 'HTML' }),
      });

      const data = await response.json();
      return { response, data };
    };

    let { response, data } = await sendMessage(chatId);

    const migratedChatId = data?.parameters?.migrate_to_chat_id;
    if (!response.ok && migratedChatId) {
      chatId = String(migratedChatId);
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ telegram_chat_id: chatId })
        .eq('id', 1);

      if (updateError) {
        throw new Error(`Failed to store migrated Telegram chat ID: ${updateError.message}`);
      }

      ({ response, data } = await sendMessage(chatId));
    }

    if (!response.ok) {
      throw new Error(`Telegram API failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ ok: true, updated: updatedCount, notUpdated: notUpdatedCount, warnings: warnings.length, chat_id: chatId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
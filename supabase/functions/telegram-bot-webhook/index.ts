import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRA_LABEL_MAP: Record<string, string> = {
  beef: "🥩 গরু (Beef)",
  mutton: "🍖 খাসি (Mutton)",
  chicken: "🍗 মুরগি (Chicken)",
  egg_fish_fry: "🍳 ডিম ভাজি - মাছ (মাডি / madi)",
  egg_fish_poach: "🍳 ডিম পোচ - মাছ (মাপো / mapo)",
  egg_chicken_fry: "🍳 ডিম ভাজি - পোল্ট্রি (মুডি / mudi)",
  egg_chicken_poach: "🍳 ডিম পোচ - পোল্ট্রি (মুপো / mupo)",
  egg_instead_of_fish: "🍳 ডিম (মাছ)",
  egg_instead_of_chicken: "🍳 ডিম (পোল্ট্রি)",
  egg_fry: "🍳 ডিম ভাজি",
  egg_poach: "🍳 ডিম পোচ",
};

const YEAR_ORDER = ["5th", "4th", "3rd", "2nd", "1st", "extra"];
const YEAR_LABELS: Record<string, string> = {
  "5th": "৫ম বর্ষ (5th Year)",
  "4th": "৪র্থ বর্ষ (4th Year)",
  "3rd": "৩য় বর্ষ (3rd Year)",
  "2nd": "২য় বর্ষ (2nd Year)",
  "1st": "১ম বর্ষ (1st Year)",
  extra: "অতিরিক্ত (Extra)",
};

function formatExtraDisplay(extraStr: string | null | undefined): string {
  if (!extraStr) return "";
  return extraStr
    .split(",")
    .map((v: string) => EXTRA_LABEL_MAP[v.trim()] || v.trim())
    .join(", ");
}

function getFormattedDate(date: Date): string {
  const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year} (${dayName})`;
}

// Convert Bengali numerals to English numerals
function toEnglishDigits(str: string): string {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return str.replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
}

const hasWord = (text: string, ...words: string[]): boolean => {
  return words.some((w) => {
    if (!w) return false;
    // If w has Bengali/non-ASCII characters, use inclusion
    if (/[^\x00-\x7F]/.test(w)) {
      return text.includes(w);
    }
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, "i");
    return regex.test(text);
  });
};

function extractExtraFoodFromText(text: string): {
  extraOption?: string | null;
  removeExtraOption?: string;
  matchedText?: string;
} {
  const lower = text.toLowerCase();

  // 1. General extra off / clear all
  const generalClearPatterns = [
    /(?:extra|আইটেম|এক্সট্রা|এহ্মট্রা)\s*(?:=|:|-)?\s*(?:off|of|0|০|bad|cancel|none|clear|bondho|nai|no|বন্ধ|বাদ|না|নাই|নেই|বাতিল|অফ|লাগবেনা|লাগবে\s*না)/i,
    /(?:no\s*extra|noextra|none\s*extra|0\s*extra|bad\s*extra|কোনো\s*এক্সট্রা\s*নাই|কোন\s*এক্সট্রা\s*নাই|এক্সট্রা\s*নাই|এক্সট্রা\s*নেই|এক্সট্রা\s*না|এক্সট্রা\s*অফ|এক্সট্রা\s*বাদ|এক্সট্রা\s*বন্ধ|এক্সট্রা\s*বাতিল|এক্সট্রা\s*০)/i,
  ];

  for (const pat of generalClearPatterns) {
    const match = lower.match(pat);
    if (match) {
      return { extraOption: null, matchedText: match[0] };
    }
  }

  // 2. Specific item removal
  const specificRemovals: [RegExp, string][] = [
    [/(?:goru|gorur|beef|beaf|গরু|গরুর)\s*(?:=|:|-)?\s*(?:off|of|0|০|bad|cancel|none|clear|বন্ধ|বাদ|না|নাই|নেই|বাতিল|অফ)/i, "beef"],
    [/(?:khasi|khasir|mutton|খাসি|খাসির)\s*(?:=|:|-)?\s*(?:off|of|0|০|bad|cancel|none|clear|বন্ধ|বাদ|না|নাই|নেই|বাতিল|অফ)/i, "mutton"],
    [/(?:murgi|murgir|chicken|chiken|মুরগি|মুরগী|মুরগির)\s*(?:=|:|-)?\s*(?:off|of|0|০|bad|cancel|none|clear|বন্ধ|বাদ|না|নাই|নেই|বাতিল|অফ)/i, "chicken"],
    [/(?:madi|মাডি|মাড়ি|মাদি|মাড়ী|mari|মাছের\s*ডিম\s*ভাজি)\s*(?:=|:|-)?\s*(?:off|of|0|০|bad|cancel|none|clear|বন্ধ|বাদ|না|নাই|নেই|বাতিল|অফ)/i, "egg_fish_fry"],
    [/(?:mapo|মাপো|মাফো|মাছের\s*ডিম\s*পোচ)\s*(?:=|:|-)?\s*(?:off|of|0|০|bad|cancel|none|clear|বন্ধ|বাদ|না|নাই|নেই|বাতিল|অফ)/i, "egg_fish_poach"],
    [/(?:mudi|মুডি|মুড়ি|মুদি|মুড়ী|muri|পোল্ট্রি\s*ডিম\s*ভাজি)\s*(?:=|:|-)?\s*(?:off|of|0|০|bad|cancel|none|clear|বন্ধ|বাদ|না|নাই|নেই|বাতিল|অফ)/i, "egg_chicken_fry"],
    [/(?:mupo|মুপো|মূপো|মুফো|পোল্ট্রি\s*ডিম\s*পোচ)\s*(?:=|:|-)?\s*(?:off|of|0|০|bad|cancel|none|clear|বন্ধ|বাদ|না|নাই|নেই|বাতিল|অফ)/i, "egg_chicken_poach"],
  ];

  for (const [pat, itemKey] of specificRemovals) {
    const match = lower.match(pat);
    if (match) {
      return { removeExtraOption: itemKey, matchedText: match[0] };
    }
  }

  // 3. Extra ON items
  const itemKeywords: [string[], string][] = [
    [["madi", "মাডি", "মাড়ি", "মাদি", "মাড়ী", "মাদী", "mari", "maari", "মাছের ডিম ভাজি", "মাছ ডিম ভাজি"], "egg_fish_fry"],
    [["mapo", "মাপো", "মাফো", "মপো", "mafo", "মাছের ডিম পোচ", "মাছ ডিম পোচ"], "egg_fish_poach"],
    [["mudi", "মুডি", "মুড়ি", "মুদি", "মুড়ী", "মুদী", "muri", "পোল্ট্রি ডিম ভাজি", "পোল্ট্রি ভাজি", "মুরগির ডিম ভাজি"], "egg_chicken_fry"],
    [["mupo", "মুপো", "মূপো", "মুফো", "mufo", "পোল্ট্রি ডিম পোচ", "পোল্ট্রি পোচ", "মুরগির ডিম পোচ"], "egg_chicken_poach"],
    [["goru", "gorur", "beef", "beaf", "গরু", "গরুর"], "beef"],
    [["khasi", "khasir", "mutton", "খাসি", "খাসির"], "mutton"],
    [["murgi", "murgir", "chicken", "chiken", "মুরগি", "মুরগী", "মুরগির"], "chicken"],
    [["dim vaji", "dim fry", "ডিম ভাজি", "ডিমভাজি"], "egg_fish_fry"],
    [["dim poch", "dim poach", "ডিম পোচ", "ডিমপোচ"], "egg_fish_poach"],
  ];

  for (const [aliases, itemKey] of itemKeywords) {
    if (hasWord(lower, ...aliases)) {
      return { extraOption: itemKey, matchedText: aliases.find((a) => lower.includes(a)) };
    }
  }

  return {};
}

interface ComprehensiveParseResult {
  isHelp?: boolean;
  isStatus?: boolean;
  isSummary?: boolean;
  roll?: string;
  totalLunch?: number; // 0 = off, 1 = regular on, 2 = 1 reg + 1 extra, 3 = 1 reg + 2 extra
  totalDinner?: number;
  relativeExtraLunch?: number;
  relativeExtraDinner?: number;
  lunchFoodExtra?: string | null;
  lunchRemoveFoodExtra?: string;
  dinnerFoodExtra?: string | null;
  dinnerRemoveFoodExtra?: string;
  globalFoodExtra?: string | null;
  globalRemoveFoodExtra?: string;
  hasChange?: boolean;
  rawText: string;
}

function parseMessageText(text: string): ComprehensiveParseResult {
  let clean = text.replace(/@\w+/g, "").trim();
  clean = clean.replace(/^\/meal\s+/i, "");
  const cleanText = toEnglishDigits(clean);
  const lower = cleanText.toLowerCase();

  const result: ComprehensiveParseResult = {
    rawText: text,
  };

  // 1. Help Commands
  if (
    hasWord(lower, "/help", "help", "/start", "start", "কমান্ড", "/commands", "সহায়িকা", "হেল্প")
  ) {
    result.isHelp = true;
    return result;
  }

  // 2. Summary Commands
  if (hasWord(lower, "/summary", "summary", "হিসাব", "মিল হিসাব", "সামারি")) {
    result.isSummary = true;
    return result;
  }

  // 3. Status Commands
  const statusMatch = lower.match(/(?:\/status|status|অবস্থা|চেক|স্ট্যাটাস)\s*(?:roll|r|রোল|#)?\s*(\d+)/i) ||
                      lower.match(/(?:roll|r|রোল|#)?\s*(\d+)\s*(?:status|অবস্থা|চেক|স্ট্যাটাস)/i);
  if (statusMatch) {
    result.isStatus = true;
    result.roll = statusMatch[1];
    return result;
  }
  if (lower === "/status" || lower === "status") {
    result.isStatus = true;
    return result;
  }

  // 4. Extract Roll Number
  const rollMatch = cleanText.match(/(?:^|\s|[.,:;।_\-])(?:roll|r|রোল|#)?\s*(\d{1,4})(?:$|\s|[.,:;।_\-])/i) ||
                    cleanText.match(/^(\d{1,4})\b/i) ||
                    cleanText.match(/(\d{1,4})/);
  if (rollMatch) {
    result.roll = rollMatch[1];
  }

  let body = cleanText;
  if (result.roll) {
    body = body.replace(new RegExp(`(?:roll|r|রোল|#)?\\s*${result.roll}`, "i"), "").trim();
  }

  // 5. Check counts with keywords (without ASCII-only \b for Bengali Unicode)
  // A. Number before L/D: e.g. "2L", "3 lunch", "2 লাঞ্চ", "0L", "+1L", "+2D"
  const countBeforeLunch = body.match(/(?:\+\s*|^|\s|[.,:;।_\-])(\d{1,2})\s*(?:l|lunch|লাঞ্চে|লাঞ্চ|দুপুরে|দুপুর)(?:$|\s|[.,:;।_\-])/i);
  const isRelLunch = Boolean(body.match(/\+\s*\d{1,2}\s*(?:l|lunch|লাঞ্চ)/i));
  if (countBeforeLunch) {
    const qty = parseInt(countBeforeLunch[1], 10);
    if (isRelLunch) {
      result.relativeExtraLunch = qty;
    } else {
      result.totalLunch = qty;
    }
    result.hasChange = true;
  }

  const countBeforeDinner = body.match(/(?:\+\s*|^|\s|[.,:;।_\-])(\d{1,2})\s*(?:d|dinner|ডিনারে|ডিনার|রাতে|রাত)(?:$|\s|[.,:;।_\-])/i);
  const isRelDinner = Boolean(body.match(/\+\s*\d{1,2}\s*(?:d|dinner|ডিনার)/i));
  if (countBeforeDinner) {
    const qty = parseInt(countBeforeDinner[1], 10);
    if (isRelDinner) {
      result.relativeExtraDinner = qty;
    } else {
      result.totalDinner = qty;
    }
    result.hasChange = true;
  }

  // B. Number after L/D: e.g. "L 2", "lunch 2", "লাঞ্চ ২", "L 0", "D 1"
  if (result.totalLunch === undefined && result.relativeExtraLunch === undefined) {
    const countAfterLunch = body.match(/(?:l|lunch|লাঞ্চে|লাঞ্চ|দুপুর)\s*[:=-]?\s*(\d{1,2})/i);
    if (countAfterLunch) {
      result.totalLunch = parseInt(countAfterLunch[1], 10);
      result.hasChange = true;
    }
  }
  if (result.totalDinner === undefined && result.relativeExtraDinner === undefined) {
    const countAfterDinner = body.match(/(?:d|dinner|ডিনারে|ডিনার|রাত)\s*[:=-]?\s*(\d{1,2})/i);
    if (countAfterDinner) {
      result.totalDinner = parseInt(countAfterDinner[1], 10);
      result.hasChange = true;
    }
  }

  // C. Split body into Lunch & Dinner segments to extract food extras and boolean ON/OFF states
  const lunchKeywordRegex = /(?:^|\s|[.,:;।_\-])(\d{0,2}\s*(?:l|lunch|লাঞ্চে|লাঞ্চ|দুপুরে|দুপুর))(?::|=| -|\s|$)/i;
  const dinnerKeywordRegex = /(?:^|\s|[.,:;।_\-])(\d{0,2}\s*(?:d|dinner|ডিনারে|ডিনার|রাতে|রাত))(?::|=| -|\s|$)/i;

  const lunchMatch = body.match(lunchKeywordRegex);
  const dinnerMatch = body.match(dinnerKeywordRegex);

  let hasExplicitLOrD = false;

  if (lunchMatch || dinnerMatch) {
    hasExplicitLOrD = true;
    const lunchIdx = lunchMatch ? body.search(lunchKeywordRegex) : -1;
    const dinnerIdx = dinnerMatch ? body.search(dinnerKeywordRegex) : -1;

    let lunchSegment = "";
    let dinnerSegment = "";

    if (lunchIdx !== -1 && dinnerIdx !== -1) {
      if (lunchIdx < dinnerIdx) {
        lunchSegment = body.slice(lunchIdx + (lunchMatch ? lunchMatch[0].length : 0), dinnerIdx).trim();
        dinnerSegment = body.slice(dinnerIdx + (dinnerMatch ? dinnerMatch[0].length : 0)).trim();
      } else {
        dinnerSegment = body.slice(dinnerIdx + (dinnerMatch ? dinnerMatch[0].length : 0), lunchIdx).trim();
        lunchSegment = body.slice(lunchIdx + (lunchMatch ? lunchMatch[0].length : 0)).trim();
      }
    } else if (lunchIdx !== -1) {
      lunchSegment = body.slice(lunchIdx + (lunchMatch ? lunchMatch[0].length : 0)).trim();
    } else if (dinnerIdx !== -1) {
      dinnerSegment = body.slice(dinnerIdx + (dinnerMatch ? dinnerMatch[0].length : 0)).trim();
    }

    // Lunch Segment
    if (lunchIdx !== -1) {
      const lFood = extractExtraFoodFromText(lunchSegment);
      if (lFood.extraOption !== undefined) result.lunchFoodExtra = lFood.extraOption;
      if (lFood.removeExtraOption) result.lunchRemoveFoodExtra = lFood.removeExtraOption;

      let remainingLunch = lunchSegment.toLowerCase();
      if (lFood.matchedText) remainingLunch = remainingLunch.replace(lFood.matchedText.toLowerCase(), " ");
      remainingLunch = remainingLunch.replace(/(?:extra|এক্সট্রা|আইটেম)/gi, " ").trim();

      if (result.totalLunch === undefined && result.relativeExtraLunch === undefined) {
        if (hasWord(remainingLunch, "on", "চালু", "হবে", "খাবো", "খাব", "থাকবে", "1")) {
          result.totalLunch = 1;
          result.hasChange = true;
        } else if (hasWord(remainingLunch, "off", "of", "বন্ধ", "বাদ", "হবে না", "খাব না", "0")) {
          result.totalLunch = 0;
          result.hasChange = true;
        }
      }
    }

    // Dinner Segment
    if (dinnerIdx !== -1) {
      const dFood = extractExtraFoodFromText(dinnerSegment);
      if (dFood.extraOption !== undefined) result.dinnerFoodExtra = dFood.extraOption;
      if (dFood.removeExtraOption) result.dinnerRemoveFoodExtra = dFood.removeExtraOption;

      let remainingDinner = dinnerSegment.toLowerCase();
      if (dFood.matchedText) remainingDinner = remainingDinner.replace(dFood.matchedText.toLowerCase(), " ");
      remainingDinner = remainingDinner.replace(/(?:extra|এক্সট্রা|আইটেম)/gi, " ").trim();

      if (result.totalDinner === undefined && result.relativeExtraDinner === undefined) {
        if (hasWord(remainingDinner, "on", "চালু", "হবে", "খাবো", "খাব", "থাকবে", "1")) {
          result.totalDinner = 1;
          result.hasChange = true;
        } else if (hasWord(remainingDinner, "off", "of", "বন্ধ", "বাদ", "হবে না", "খাব না", "0")) {
          result.totalDinner = 0;
          result.hasChange = true;
        }
      }
    }
  }

  // 6. If no explicit L/D, check global / positional patterns
  if (!hasExplicitLOrD) {
    let mealBody = lower;

    if (hasWord(lower, "on off", "চালু বন্ধ", "অন অফ", "অন বন্ধ", "1 0", "১ ০")) {
      result.totalLunch = 1;
      result.totalDinner = 0;
      result.hasChange = true;
      mealBody = mealBody.replace(/on off|চালু বন্ধ|অন অফ|অন বন্ধ|1 0|১ ০/g, " ");
    } else if (hasWord(lower, "off on", "বন্ধ চালু", "অফ অন", "0 1", "০ ১")) {
      result.totalLunch = 0;
      result.totalDinner = 1;
      result.hasChange = true;
      mealBody = mealBody.replace(/off on|বন্ধ চালু|অফ অন|0 1|০ ১/g, " ");
    } else if (hasWord(lower, "on on", "চালু চালু", "অন অন", "1 1", "১ ১", "উভয় চালু", "সব চালু")) {
      result.totalLunch = 1;
      result.totalDinner = 1;
      result.hasChange = true;
      mealBody = mealBody.replace(/on on|চালু চালু|অন অন|1 1|১ ১|উভয় চালু|সব চালু/g, " ");
    } else if (hasWord(lower, "off off", "বন্ধ বন্ধ", "অফ অফ", "0 0", "০ ০", "উভয় বন্ধ", "সব বন্ধ")) {
      result.totalLunch = 0;
      result.totalDinner = 0;
      result.hasChange = true;
      mealBody = mealBody.replace(/off off|বন্ধ বন্ধ|অফ অফ|0 0|০ ০|উভয় বন্ধ|সব বন্ধ/g, " ");
    } else if (hasWord(lower, "on", "চালু") && !hasWord(lower, "off", "বন্ধ", "বাদ")) {
      result.totalLunch = 1;
      result.totalDinner = 1;
      result.hasChange = true;
    } else if (
      hasWord(lower, "off", "বন্ধ", "বাদ") &&
      !hasWord(lower, "on", "চালু") &&
      !lower.includes("extra") &&
      !lower.includes("এক্সট্রা")
    ) {
      result.totalLunch = 0;
      result.totalDinner = 0;
      result.hasChange = true;
    }

    // Global Food Extra
    const globalFood = extractExtraFoodFromText(mealBody);
    if (globalFood.extraOption !== undefined) {
      result.globalFoodExtra = globalFood.extraOption;
    }
    if (globalFood.removeExtraOption) {
      result.globalRemoveFoodExtra = globalFood.removeExtraOption;
    }
  }

  return result;
}

function applyExtraOptionUpdate(
  currentExtra: string | null | undefined,
  setOption: string | null | undefined,
  removeOption?: string
): string | null {
  if (setOption === null) {
    return null; // Clear all in this slot
  }

  let list: string[] = currentExtra
    ? currentExtra.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (removeOption) {
    list = list.filter((item) => item !== removeOption);
  }

  if (setOption) {
    const MEAT_GROUP = ["beef", "mutton", "chicken"];
    const EGG_GROUP = [
      "egg_fish_fry",
      "egg_fish_poach",
      "egg_chicken_fry",
      "egg_chicken_poach",
      "egg_fry",
      "egg_poach",
      "egg_instead_of_fish",
      "egg_instead_of_chicken",
    ];

    if (MEAT_GROUP.includes(setOption)) {
      list = list.filter((v) => !MEAT_GROUP.includes(v));
    } else if (EGG_GROUP.includes(setOption)) {
      list = list.filter((v) => !EGG_GROUP.includes(v));
    }

    if (!list.includes(setOption)) {
      list.push(setOption);
    }
  }

  return list.length > 0 ? list.join(",") : null;
}

// Full All-Batch Meal Summary Builder
async function buildAllBatchSummary(supabase: any, tomorrowStr: string, bannerUpdateText?: string): Promise<string> {
  const tomorrowDateObj = new Date(tomorrowStr + "T00:00:00");
  const formattedTomorrow = getFormattedDate(tomorrowDateObj);

  const now = new Date();
  const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const todayStr = bdNow.toISOString().split("T")[0];
  const hours = bdNow.getUTCHours();
  const minutes = bdNow.getUTCMinutes();
  const timeStr = `${hours}:${String(minutes).padStart(2, "0")}`;
  const remainingMinutes = Math.max(0, 22 * 60 - (hours * 60 + minutes));

  // 1. Fetch active profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, year, roll_number")
    .eq("is_active", true)
    .order("roll_number", { ascending: true, nullsFirst: false });

  if (!profiles || profiles.length === 0) {
    return "❌ কোনো সক্রিয় সদস্যের ডাটা পাওয়া যায়নি।";
  }

  profiles.sort((a: any, b: any) => {
    const ra = a.roll_number ? parseInt(a.roll_number, 10) : Infinity;
    const rb = b.roll_number ? parseInt(b.roll_number, 10) : Infinity;
    if (isNaN(ra) && isNaN(rb)) return (a.roll_number || "").localeCompare(b.roll_number || "");
    if (isNaN(ra)) return 1;
    if (isNaN(rb)) return -1;
    return ra - rb;
  });

  // 2. Fetch meals & extra
  const [tomorrowMealsRes, todayMealsRes, extraMealsRes, feastConfigRes, specialItemsRes, specialResponsesRes] =
    await Promise.all([
      supabase.from("daily_meals").select("user_id, lunch, dinner, lunch_extra_option, dinner_extra_option").eq("meal_date", tomorrowStr),
      supabase.from("daily_meals").select("user_id, lunch, dinner, lunch_extra_option, dinner_extra_option").eq("meal_date", todayStr),
      supabase.from("extra_meals").select("user_id, meal_type, quantity, extra_option, is_feast_day").eq("meal_date", tomorrowStr),
      supabase.from("feast_day_config").select("feast_date").eq("feast_date", tomorrowStr),
      supabase.from("special_day_items").select("id, item_name").eq("item_date", tomorrowStr),
      supabase.from("special_day_responses").select("user_id, item_id, opted_in"),
    ]);

  const dayOfWeekTomorrow = new Date(tomorrowStr + "T00:00:00").getDay();
  const isDefaultFeastTomorrow = dayOfWeekTomorrow === 1 || dayOfWeekTomorrow === 5;
  const isFeastDay = Boolean((feastConfigRes.data && feastConfigRes.data.length > 0) || isDefaultFeastTomorrow);
  const tomorrowMeals = tomorrowMealsRes.data || [];
  const todayMeals = todayMealsRes.data || [];
  const extraMealsData = extraMealsRes.data || [];
  const specialItems = specialItemsRes.data || [];
  const specialResponses = specialResponsesRes.data || [];

  const tomorrowMap = new Map<string, any>();
  tomorrowMeals.forEach((m: any) => tomorrowMap.set(m.user_id, m));

  const todayMap = new Map<string, any>();
  todayMeals.forEach((m: any) => todayMap.set(m.user_id, m));

  // Auto self-heal missing profiles
  const missingProfiles = profiles.filter((p: any) => !tomorrowMap.has(p.user_id));
  if (missingProfiles.length > 0) {
    const { data: offPeriods } = await supabase
      .from("meal_off_periods")
      .select("user_id, start_date, end_date")
      .lte("start_date", tomorrowStr)
      .gte("end_date", todayStr);

    const offList = offPeriods || [];
    const rowsToInsert: any[] = [];

    for (const p of missingProfiles) {
      const todayMeal = todayMap.get(p.user_id);
      const isTargetOff = offList.some(
        (op: any) => op.user_id === p.user_id && tomorrowStr >= op.start_date && tomorrowStr <= op.end_date
      );
      const isSourceOff = offList.some(
        (op: any) => op.user_id === p.user_id && todayStr >= op.start_date && todayStr <= op.end_date
      );

      let carriedLunch = true;
      let carriedDinner = true;

      if (isTargetOff) {
        carriedLunch = false;
        carriedDinner = false;
      } else if (isSourceOff) {
        carriedLunch = true;
        carriedDinner = true;
      } else if (todayMeal) {
        carriedLunch = todayMeal.lunch_off_today_only ? true : todayMeal.lunch;
        carriedDinner = todayMeal.dinner_off_today_only ? true : todayMeal.dinner;
      }

      const newRow = {
        user_id: p.user_id,
        meal_date: tomorrowStr,
        lunch: carriedLunch,
        dinner: carriedDinner,
        lunch_extra_option: todayMeal?.lunch_extra_option || null,
        dinner_extra_option: todayMeal?.dinner_extra_option || null,
        lunch_off_today_only: false,
        dinner_off_today_only: false,
      };

      rowsToInsert.push(newRow);
      tomorrowMap.set(p.user_id, newRow);
    }

    if (rowsToInsert.length > 0) {
      await supabase.from("daily_meals").insert(rowsToInsert);
    }
  }

  const extraMap = new Map<string, { extraLunch: number; extraDinner: number }>();
  const extraOptionMap = new Map<string, string[]>();
  extraMealsData.forEach((em: any) => {
    const cur = extraMap.get(em.user_id) || { extraLunch: 0, extraDinner: 0 };
    if (em.meal_type === "lunch") cur.extraLunch += em.quantity;
    else cur.extraDinner += em.quantity;
    extraMap.set(em.user_id, cur);

    if (em.extra_option) {
      const opts = em.extra_option.split(",").map((v: string) => v.trim()).filter(Boolean);
      const existing = extraOptionMap.get(em.user_id) || [];
      existing.push(...opts);
      extraOptionMap.set(em.user_id, existing);
    }
  });

  const specialItemMap = new Map<string, string>();
  specialItems.forEach((si: any) => specialItemMap.set(si.id, si.item_name));

  const userSpecialMap = new Map<string, string[]>();
  specialResponses.forEach((sr: any) => {
    if (sr.opted_in && specialItemMap.has(sr.item_id)) {
      const existing = userSpecialMap.get(sr.user_id) || [];
      existing.push(specialItemMap.get(sr.item_id)!);
      userSpecialMap.set(sr.user_id, existing);
    }
  });

  const extraCounts: Record<string, number> = {};
  Object.keys(EXTRA_LABEL_MAP).forEach((key) => {
    extraCounts[key] = 0;
  });

  const groupedLines = new Map<string, string[]>();
  YEAR_ORDER.forEach((y) => groupedLines.set(y, []));

  const warnings: string[] = [];
  let updatedCount = 0;
  let notUpdatedCount = 0;
  let totalLunch = 0;
  let totalDinner = 0;
  let totalExtraLunch = 0;
  let totalExtraDinner = 0;

  profiles.forEach((p: any) => {
    const meal = tomorrowMap.get(p.user_id);
    const todayMeal = todayMap.get(p.user_id);
    const extra = extraMap.get(p.user_id);
    const rollLabel = p.roll_number || "—";
    const shortName = p.full_name.split(" ").slice(0, 2).join(" ");

    const userYear = p.year || "extra";
    const yearLines = groupedLines.get(userYear) || [];

    if (meal) {
      updatedCount++;
      const extraL = extra?.extraLunch || 0;
      const extraD = extra?.extraDinner || 0;
      const lunchCount = (meal.lunch ? 1 : 0) + extraL;
      const dinnerCount = (meal.dinner ? 1 : 0) + extraD;
      totalLunch += lunchCount;
      totalDinner += dinnerCount;
      totalExtraLunch += extraL;
      totalExtraDinner += extraD;

      const lunchIcon = meal.lunch ? "✅" : "❌";
      const dinnerIcon = meal.dinner ? "✅" : "❌";
      let lunchStr = lunchIcon;
      if (extraL > 0) lunchStr += `+${extraL}`;
      let dinnerStr = dinnerIcon;
      if (extraD > 0) dinnerStr += `+${extraD}`;

      const rawExtraKeys = [
        ...(meal.lunch_extra_option || "").split(",").map((v: string) => v.trim()).filter(Boolean),
        ...(meal.dinner_extra_option || "").split(",").map((v: string) => v.trim()).filter(Boolean),
      ];
      const extraMealKeys = extraOptionMap.get(p.user_id) || [];
      const allRawKeys = [...rawExtraKeys, ...extraMealKeys];
      const displayKeys = isFeastDay ? allRawKeys : allRawKeys.filter((k: string) => k !== "chicken");

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
        return count > 1 ? `${count}×${label}` : label;
      });
      const allExtra = [...countedLabels, ...specialLabels];
      const extraText = allExtra.length > 0 ? ` (🍖 ${allExtra.join(" · ")})` : "";

      yearLines.push(`  • [${rollLabel}] <b>${shortName}</b> ➔ L: ${lunchStr} · D: ${dinnerStr}${extraText}`);
    } else {
      notUpdatedCount++;
      let extraInfo = "";
      if (todayMeal) {
        const wasLunchOn = todayMeal.lunch;
        const wasDinnerOn = todayMeal.dinner;
        if (wasLunchOn && wasDinnerOn) {
          extraInfo = " (আজ L✅ D✅)";
        } else if (wasLunchOn) {
          extraInfo = " (আজ L✅)";
        } else if (wasDinnerOn) {
          extraInfo = " (আজ D✅)";
        } else {
          extraInfo = " (আজও বন্ধ)";
          warnings.push(p.full_name);
        }
      } else {
        warnings.push(p.full_name);
      }

      yearLines.push(`  • [${rollLabel}] 🔴 <b>${shortName}</b> ➔ আপডেট দেয়নি${extraInfo}`);
    }
    groupedLines.set(userYear, yearLines);
  });

  // Build message
  let msg = "";

  if (bannerUpdateText) {
    msg += `⚡ <b>${bannerUpdateText}</b>\n\n`;
  }

  msg += `╔══════════════════════════╗\n`;
  msg += `   🍽️ <b>মিল রিপোর্ট</b>\n`;
  msg += `╚══════════════════════════╝\n\n`;

  msg += `📅 <b>${formattedTomorrow}</b>\n`;
  msg += `🕐 রিপোর্ট: ${timeStr} | ⏳ বাকি: ${remainingMinutes} মিনিট\n`;
  msg += `─────────────────────\n\n`;

  // Summary stats
  msg += `📊 <b>সারসংক্ষেপ:</b>\n`;
  msg += `┌─────────────────────┐\n`;
  msg += `│ 🟢 আপডেট দিয়েছে: <b>${updatedCount}/${profiles.length} জন</b>\n`;
  if (notUpdatedCount > 0) {
    msg += `│ 🔴 বাকি আছে: <b>${notUpdatedCount} জন</b>\n`;
  }
  msg += `│\n`;
  msg += `│ ☀️ মোট লাঞ্চ: <b>${totalLunch} টি</b>\n`;
  msg += `│ 🌙 মোট ডিনার: <b>${totalDinner} টি</b>\n`;
  msg += `│ 📈 সর্বমোট: <b>${totalLunch + totalDinner} টি মিল</b>\n`;

  if (totalExtraLunch > 0 || totalExtraDinner > 0) {
    msg += `│\n`;
    msg += `│ 🧾 অতিরিক্ত লাঞ্চ: <b>${totalExtraLunch}</b> | ডিনার: <b>${totalExtraDinner}</b>\n`;
  }
  msg += `└─────────────────────┘\n`;

  // Extra Food items summary
  const EXTRA_SUMMARY_ORDER = [
    "beef",
    "mutton",
    "chicken",
    "egg_fish_fry",
    "egg_fish_poach",
    "egg_chicken_fry",
    "egg_chicken_poach",
    "egg_instead_of_fish",
    "egg_instead_of_chicken",
    "egg_fry",
    "egg_poach",
  ];

  let extraLines = "";
  EXTRA_SUMMARY_ORDER.forEach((key) => {
    const count = extraCounts[key] || 0;
    if (count > 0) {
      const label = EXTRA_LABEL_MAP[key] || key;
      extraLines += `   🥩 ${label}: <b>${count} জন</b>\n`;
    }
  });

  if (extraLines) {
    msg += `\n🍳 <b>অতিরিক্ত অপশন সমূহের যোগফল:</b>\n`;
    msg += extraLines;
  }

  // Batches
  let memberListMessage = "";
  YEAR_ORDER.forEach((year) => {
    const yearLines = groupedLines.get(year) || [];
    if (yearLines.length > 0) {
      memberListMessage += `\n🎓 <b>${YEAR_LABELS[year]}:</b>\n`;
      memberListMessage += yearLines.join("\n") + "\n";
    }
  });

  msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `<b>👤 সদস্য তালিকা (ব্যাচ অনুযায়ী):</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += memberListMessage;

  if (warnings.length > 0) {
    msg += `\n🚨 <b>সতর্কতা! আজ OFF ছিল কিন্তু আগামীকালের আপডেট দেয়নি:</b>\n`;
    warnings.forEach((name) => {
      msg += `⚠️ ${name}\n`;
    });
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (notUpdatedCount > 0) {
    msg += `⚠️ <i>মিল আপডেট দিন! রাত ১০টার পর বন্ধ হয়ে যাবে।</i>`;
  } else {
    msg += `🎉 <i>সবাই সফলভাবে মিল আপডেট সম্পন্ন করেছেন!</i>`;
  }

  return msg;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  // Helper to send a message back to Telegram
  const sendTelegramReply = async (chatId: number | string, text: string, replyToMessageId?: number, disableNotification = false) => {
    try {
      const payload: any = {
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_notification: disableNotification,
      };
      if (replyToMessageId) {
        payload.reply_to_message_id = replyToMessageId;
      }
      const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (e) {
      console.error("Failed to send Telegram message:", e);
      return null;
    }
  };

  // Helper to delete a telegram message
  const deleteTelegramMessage = async (chatId: number | string, messageId: number | string) => {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: typeof messageId === "string" ? parseInt(messageId, 10) : messageId }),
      });
    } catch (e) {
      console.warn("Delete telegram message failed:", e);
    }
  };

  try {
    const body = await req.json();

    // 1. Admin / Setup Action: Set Webhook directly via Supabase function
    if (body?.action === "set_webhook") {
      const webhookUrl = body.webhook_url || `${SUPABASE_URL}/functions/v1/telegram-bot-webhook`;
      const setResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "edited_message"],
          drop_pending_updates: false,
        }),
      });
      const data = await setResp.json();
      return new Response(JSON.stringify({ ok: true, telegram_response: data, webhook_url: webhookUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Admin Action: Get Webhook Info
    if (body?.action === "get_webhook_info") {
      const getResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const data = await getResp.json();
      return new Response(JSON.stringify({ ok: true, webhook_info: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Admin Action: Test Message
    if (body?.action === "send_test") {
      const { data: settings } = await supabase.from("app_settings").select("telegram_chat_id").eq("id", 1).single();
      const targetChatId = body.chat_id || settings?.telegram_chat_id;
      if (!targetChatId) {
        return new Response(JSON.stringify({ error: "No chat ID found" }), { status: 400, headers: corsHeaders });
      }
      const testMsg = body.text || "🤖 Satkhira Meal Mate Bot: Webhook সফলভাবে সংযুক্ত হয়েছে!";
      const res = await sendTelegramReply(targetChatId, testMsg);
      return new Response(JSON.stringify({ ok: true, response: res }), { headers: corsHeaders });
    }

    // 4. Website Meal Change → Telegram DM + Group mention
    if (body?.action === "notify_website_meal_change") {
      const { user_id, message: notifMessage, roll, name } = body;
      if (!user_id && !roll) {
        return new Response(JSON.stringify({ error: "user_id or roll required" }), { status: 400, headers: corsHeaders });
      }

      // Fetch profile's telegram_chat_id
      let telegramChatId: string | null = null;
      let telegramUsername: string | null = null;
      let fullName = name || "";
      let rollNumber = roll || "";
      if (user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("telegram_chat_id, telegram_username, full_name, roll_number")
          .eq("user_id", user_id)
          .maybeSingle();
        if (prof) {
          telegramChatId = prof.telegram_chat_id;
          telegramUsername = prof.telegram_username;
          fullName = prof.full_name || fullName;
          rollNumber = prof.roll_number || rollNumber;
        }
      }

      // Fetch group chat ID from app_settings
      const { data: settingsRow } = await supabase
        .from("app_settings")
        .select("telegram_chat_id, telegram_enabled")
        .eq("id", 1)
        .single();

      const groupChatId = settingsRow?.telegram_chat_id;
      const botEnabled = settingsRow?.telegram_enabled !== false;

      if (!botEnabled) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Bot disabled" }), { headers: corsHeaders });
      }

      const msgText = notifMessage || `📢 ওয়েবসাইট থেকে মিল আপডেট হয়েছে।\n👤 <b>${fullName}</b> (রোল: ${rollNumber})`;

      const results: any = {};

      // Send DM to student if they have linked Telegram
      if (telegramChatId) {
        try {
          results.dm = await sendTelegramReply(telegramChatId, `📲 <b>আপনার মিল আপডেট হয়েছে!</b>\n\n${msgText}`);
        } catch (e) {
          console.warn("DM failed:", e);
          results.dm_error = String(e);
        }
      } else {
        results.dm = "no_telegram_linked";
      }

      // Post mention in group chat
      if (groupChatId) {
        const mention = telegramUsername ? `@${telegramUsername}` : `<b>${fullName}</b>`;
        const groupMsg = `🔔 ${mention} — ${msgText}`;
        try {
          results.group = await sendTelegramReply(groupChatId, groupMsg, undefined, true);
        } catch (e) {
          console.warn("Group notify failed:", e);
          results.group_error = String(e);
        }
      }

      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Link Telegram account to profile (called from website settings)
    if (body?.action === "link_telegram_account") {
      const { roll, telegram_chat_id: tgChatId, telegram_username: tgUsername } = body;
      if (!roll || !tgChatId) {
        return new Response(JSON.stringify({ error: "roll and telegram_chat_id required" }), { status: 400, headers: corsHeaders });
      }
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("roll_number", String(roll))
        .eq("is_active", true)
        .maybeSingle();
      if (profErr || !prof) {
        return new Response(JSON.stringify({ ok: false, error: "Profile not found for roll " + roll }), { status: 404, headers: corsHeaders });
      }
      await supabase.from("profiles").update({
        telegram_chat_id: String(tgChatId),
        telegram_username: tgUsername || null,
      }).eq("user_id", prof.user_id);

      await sendTelegramReply(String(tgChatId), `✅ আপনার Telegram অ্যাকাউন্ট Satkhira Meal Mate-এ লিঙ্ক হয়েছে!\n👤 <b>${prof.full_name}</b> (রোল: ${roll})\n\nএখন থেকে ওয়েবসাইট থেকে মিল আপডেট হলে আপনি সরাসরি এখানে নোটিফিকেশন পাবেন। 🎉`);

      return new Response(JSON.stringify({ ok: true, user_id: prof.user_id, name: prof.full_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Handle Incoming Telegram Webhook Update
    const message = body?.message || body?.edited_message;
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const chatId = message.chat.id;
    const messageId = message.message_id;
    const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";
    const text = message.text.trim();

    // Check app settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("telegram_chat_id, telegram_enabled, meal_cutoff_hour, meal_cutoff_minute, telegram_last_summary_message_id")
      .eq("id", 1)
      .single();

    if (settings && (settings as any).telegram_enabled === false) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Bot disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-update telegram_chat_id if not set or if migrating
    if (!settings?.telegram_chat_id && isGroup) {
      await supabase.from("app_settings").update({ telegram_chat_id: String(chatId) }).eq("id", 1);
    }

    // Parse the message text
    const parsed = parseMessageText(text);

    // Calculate Bangladesh Dates (UTC+6)
    const now = new Date();
    const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const todayStr = bdNow.toISOString().split("T")[0];
    const bdTomorrow = new Date(bdNow.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = bdTomorrow.toISOString().split("T")[0];
    const tomorrowDateObj = new Date(tomorrowStr + "T00:00:00");
    const formattedTomorrow = getFormattedDate(tomorrowDateObj);

    // Cutoff calculation
    const cutoffHour = settings?.meal_cutoff_hour ?? 22;
    const cutoffMinute = settings?.meal_cutoff_minute ?? 0;
    const bdCurrentHour = bdNow.getUTCHours();
    const bdCurrentMinute = bdNow.getUTCMinutes();
    const isPastCutoff =
      bdCurrentHour > cutoffHour || (bdCurrentHour === cutoffHour && bdCurrentMinute >= cutoffMinute);

    // Format cutoff string for display
    const cutoffDisplay = `${cutoffHour > 12 ? cutoffHour - 12 : cutoffHour}:${String(cutoffMinute).padStart(2, "0")} ${cutoffHour >= 12 ? "PM" : "AM"}`;

    // A0. Handle /start [roll] in private DM — link Telegram account
    if (!isGroup && text.match(/^\/start(\s+\d+)?/i)) {
      const rollMatch = text.match(/^\/start\s+(\d+)/i);
      const tgUserId = String(message.from?.id || chatId);
      const tgUsername = message.from?.username || null;
      const tgFirstName = message.from?.first_name || "";

      if (rollMatch) {
        const rollNum = rollMatch[1];
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id, full_name, roll_number")
          .eq("roll_number", rollNum)
          .eq("is_active", true)
          .maybeSingle();

        if (!prof) {
          await sendTelegramReply(chatId, `❌ রোল নম্বর <b>${rollNum}</b> দিয়ে কোনো সক্রিয় সদস্য পাওয়া যায়নি!\nসঠিক রোল নম্বর দিয়ে চেষ্টা করুন: <code>/start আপনার_রোল</code>`, messageId);
        } else {
          await supabase.from("profiles").update({
            telegram_chat_id: tgUserId,
            telegram_username: tgUsername,
          }).eq("user_id", prof.user_id);

          await sendTelegramReply(chatId, `✅ <b>সংযোগ সফল!</b>\n\n👤 <b>${prof.full_name}</b> (রোল: ${prof.roll_number})\n\nআপনার Telegram এখন Satkhira Meal Mate-এ লিঙ্ক হয়েছে। ওয়েবসাইট থেকে মিল পরিবর্তন হলে আপনি সরাসরি এখানে নোটিফিকেশন পাবেন! 🎉\n\n<i>আপনি এখন গ্রুপ বা এখানে মিল কমান্ড দিতে পারবেন।</i>`);
        }
        return new Response(JSON.stringify({ ok: true, type: "start_link" }), { headers: corsHeaders });
      } else {
        // /start without roll — show welcome
        await sendTelegramReply(chatId, `👋 <b>স্বাগতম, ${tgFirstName}!</b>\n\nSatkhira Meal Mate Bot-এ আপনাকে স্বাগতম!\n\n📲 <b>Telegram লিঙ্ক করতে:</b>\n<code>/start আপনার_রোল_নম্বর</code>\nউদাহরণ: <code>/start 25</code>\n\n🍽️ লিঙ্ক করলে ওয়েবসাইট থেকে মিল আপডেট হলে এখানে নোটিফিকেশন পাবেন!\n\n📊 সাহায্যের জন্য: /help`);
        return new Response(JSON.stringify({ ok: true, type: "start_welcome" }), { headers: corsHeaders });
      }
    }

    // A. Handle /help or help command
    if (parsed.isHelp) {

      const helpText = `🤖 <b>Satkhira Meal Mate Bot Commands</b>
━━━━━━━━━━━━━━━━━━━━
গ্রুপে মেসেজ দিয়ে সহজে মিল ও অতিরিক্ত মিল আপডেট করুন:

📝 <b>মিল আপডেটের সহজ নিয়ম:</b>
• <code>25 2L 1D</code> ➔ রোল ২৫-এর ২ লাঞ্চ, ১ ডিনার
• <code>25 3L 2D</code> ➔ ৩ লাঞ্চ, ২ ডিনার
• <code>25 2L</code> ➔ ২ লাঞ্চ
• <code>25 +1L</code> ➔ ১টি অতিরিক্ত লাঞ্চ
• <code>25 L on D off</code> ➔ লাঞ্চ ON, ডিনার OFF
• <code>25 2L madi 1D goru</code> ➔ ২ লাঞ্চ (মাডি) + ১ ডিনার (গরু)
• <code>25 extra off</code> ➔ অতিরিক্ত মিল ও এক্সট্রা বাতিল
• <code>25 off off</code> বা <code>25 0L 0D</code> ➔ সব মিল বন্ধ

🍳 <b>সহজ এক্সট্রা খাবার তালিকা:</b>
• 🥩 <b>গরু:</b> <code>goru</code> / <code>beef</code>
• 🍖 <b>খাসি:</b> <code>khasi</code> / <code>mutton</code>
• 🍗 <b>মুরগি:</b> <code>murgi</code> / <code>chicken</code>
• 🍳 <b>ডিম ভাজি (মাছ):</b> <code>madi</code> / <code>মাডি</code>
• 🍳 <b>ডিম পোচ (মাছ):</b> <code>mapo</code> / <code>মাপো</code>
• 🍳 <b>ডিম ভাজি (পোল্ট্রি):</b> <code>mudi</code> / <code>মুডি</code>
• 🍳 <b>ডিম পোচ (পোল্ট্রি):</b> <code>mupo</code> / <code>মুপো</code>

📊 <b>অন্যান্য কমান্ড:</b>
• <code>/status 25</code> ➔ রোল ২৫-এর স্ট্যাটাস দেখুন
• <code>/summary</code> ➔ আগামীকালের সম্পূর্ণ অল-ব্যাচ মিল লিস্ট
• <code>/help</code> ➔ এই সহায়িকা মেসেজটি দেখুন

⏰ <i>কাটঅফ টাইম: রাত ${cutoffDisplay}</i>`;
      await sendTelegramReply(chatId, helpText, messageId);
      return new Response(JSON.stringify({ ok: true, type: "help" }), { headers: corsHeaders });
    }

    // B. Handle /summary or summary command
    if (parsed.isSummary) {
      const summaryText = await buildAllBatchSummary(supabase, tomorrowStr);

      if (isGroup) {
        // Auto-delete previous summary message
        if (settings?.telegram_last_summary_message_id) {
          await deleteTelegramMessage(chatId, settings.telegram_last_summary_message_id);
        }

        const summaryReply = await sendTelegramReply(chatId, summaryText, undefined, true);
        const summaryMsgId = summaryReply?.result?.message_id;

        if (summaryMsgId) {
          try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/unpinAllChatMessages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId }),
            });
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/pinChatMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: summaryMsgId, disable_notification: true }),
            });
          } catch (e) {
            console.warn("Pin summary failed:", e);
          }
          await supabase.from("app_settings").update({ telegram_last_summary_message_id: String(summaryMsgId) }).eq("id", 1);
        }
      } else {
        await sendTelegramReply(chatId, summaryText, messageId);
      }

      return new Response(JSON.stringify({ ok: true, type: "summary" }), { headers: corsHeaders });
    }

    // C. Handle /status command
    if (parsed.isStatus) {
      if (!parsed.roll) {
        await sendTelegramReply(
          chatId,
          "⚠️ অনুগ্রহ করে রোল নম্বর উল্লেখ করুন। যেমন: <code>/status 25</code>",
          messageId
        );
        return new Response(JSON.stringify({ ok: true, type: "status_missing_roll" }), { headers: corsHeaders });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name, roll_number, year")
        .eq("roll_number", parsed.roll)
        .eq("is_active", true)
        .maybeSingle();

      if (!profile) {
        await sendTelegramReply(
          chatId,
          `❌ রোল নম্বর <b>${parsed.roll}</b> দিয়ে কোনো সক্রিয় সদস্য পাওয়া যায়নি!`,
          messageId
        );
        return new Response(JSON.stringify({ ok: true, type: "status_not_found" }), { headers: corsHeaders });
      }

      const { data: meal } = await supabase
        .from("daily_meals")
        .select("lunch, dinner, lunch_extra_option, dinner_extra_option")
        .eq("user_id", profile.user_id)
        .eq("meal_date", tomorrowStr)
        .maybeSingle();

      const { data: extraList } = await supabase
        .from("extra_meals")
        .select("meal_type, quantity")
        .eq("user_id", profile.user_id)
        .eq("meal_date", tomorrowStr);

      const extraL = extraList?.find((e: any) => e.meal_type === "lunch")?.quantity || 0;
      const extraD = extraList?.find((e: any) => e.meal_type === "dinner")?.quantity || 0;

      let lunchStatus = meal ? (meal.lunch ? "✅ চালু (ON)" : "❌ বন্ধ (OFF)") : "⏳ ডাটা পাওয়া যায়নি";
      if (extraL > 0) lunchStatus += ` +${extraL} অতিরিক্ত`;

      let dinnerStatus = meal ? (meal.dinner ? "✅ চালু (ON)" : "❌ বন্ধ (OFF)") : "⏳ ডাটা পাওয়া যায়নি";
      if (extraD > 0) dinnerStatus += ` +${extraD} অতিরিক্ত`;

      let extraStatusText = "";
      if (meal?.lunch_extra_option || meal?.dinner_extra_option) {
        if (meal?.lunch_extra_option && meal?.dinner_extra_option) {
          extraStatusText = `\n🍲 <b>লাঞ্চ এক্সট্রা:</b> ${formatExtraDisplay(meal.lunch_extra_option)}\n🍲 <b>ডিনার এক্সট্রা:</b> ${formatExtraDisplay(meal.dinner_extra_option)}`;
        } else if (meal?.lunch_extra_option) {
          extraStatusText = `\n🍲 <b>লাঞ্চ এক্সট্রা:</b> ${formatExtraDisplay(meal.lunch_extra_option)}`;
        } else {
          extraStatusText = `\n🍲 <b>ডিনার এক্সট্রা:</b> ${formatExtraDisplay(meal.dinner_extra_option)}`;
        }
      } else {
        extraStatusText = "\n🍲 <b>এক্সট্রা খাদ্য:</b> কোনোটি নয়";
      }

      const statusText = `👤 <b>সদস্যের মিল স্ট্যাটাস</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>নাম:</b> ${profile.full_name}
🎓 <b>রোল:</b> ${profile.roll_number || "—"} (${profile.year || "General"})
📅 <b>তারিখ:</b> ${formattedTomorrow}
━━━━━━━━━━━━━━━━━━━━
☀️ <b>লাঞ্চ:</b> ${lunchStatus}
🌙 <b>ডিনার:</b> ${dinnerStatus}${extraStatusText}
━━━━━━━━━━━━━━━━━━━━`;

      await sendTelegramReply(chatId, statusText, messageId);
      return new Response(JSON.stringify({ ok: true, type: "status_success" }), { headers: corsHeaders });
    }

    // D. Meal or Extra Update Command
    const hasAnyAction =
      parsed.roll ||
      parsed.hasChange ||
      parsed.totalLunch !== undefined ||
      parsed.totalDinner !== undefined ||
      parsed.relativeExtraLunch !== undefined ||
      parsed.relativeExtraDinner !== undefined ||
      parsed.lunchFoodExtra !== undefined ||
      parsed.dinnerFoodExtra !== undefined ||
      parsed.globalFoodExtra !== undefined ||
      parsed.lunchRemoveFoodExtra ||
      parsed.dinnerRemoveFoodExtra ||
      parsed.globalRemoveFoodExtra;

    if (!hasAnyAction) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: corsHeaders });
    }

    if (!parsed.roll) {
      await sendTelegramReply(
        chatId,
        "⚠️ <b>রোল নম্বর পাওয়া যায়নি!</b>\nঅনুগ্রহ করে রোল নম্বর দিয়ে লিখুন। যেমন: <code>25 2L 1D</code> বা <code>25 L on D off</code>",
        messageId
      );
      return new Response(JSON.stringify({ ok: true, error: "Missing roll" }), { headers: corsHeaders });
    }

    // Lookup profile by roll number
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name, roll_number, year")
      .eq("roll_number", parsed.roll)
      .eq("is_active", true)
      .maybeSingle();

    if (!profile) {
      await sendTelegramReply(
        chatId,
        `❌ রোল <b>${parsed.roll}</b> দিয়ে কোনো সক্রিয় সদস্য খুঁজে পাওয়া যায়নি! সঠিক রোল নম্বর দিন।`,
        messageId
      );
      return new Response(JSON.stringify({ ok: true, error: "Profile not found" }), { headers: corsHeaders });
    }

    // Check Cutoff
    if (isPastCutoff) {
      await sendTelegramReply(
        chatId,
        `⏰ <b>কাটঅফ সময় শেষ হয়ে গেছে!</b>\nআগামীকালের (${formattedTomorrow}) মিল পরিবর্তনের নির্ধারিত সময় (রাত ${cutoffDisplay}) পার হয়ে গেছে।\nজরুরি প্রয়োজনে মিল ম্যানেজারের সাথে সরাসরি যোগাযোগ করুন।`,
        messageId
      );
      return new Response(JSON.stringify({ ok: true, error: "Cutoff passed" }), { headers: corsHeaders });
    }

    // Determine feast day
    const { data: feastConfig } = await supabase
      .from("feast_day_config")
      .select("feast_date, meal_count_equivalent")
      .eq("feast_date", tomorrowStr);
    const dayOfWeek = new Date(tomorrowStr + "T00:00:00").getDay();
    const isDefaultFeast = dayOfWeek === 1 || dayOfWeek === 5;
    const configRow = feastConfig && feastConfig[0];
    const mealCountEquiv = configRow ? Number(configRow.meal_count_equivalent) || 3 : (isDefaultFeast ? 3 : 1);
    const isFeastDay = Boolean(configRow ? mealCountEquiv > 1 : isDefaultFeast);

    // Fetch existing tomorrow meal
    const { data: existingMeal } = await supabase
      .from("daily_meals")
      .select("id, lunch, dinner, lunch_extra_option, dinner_extra_option")
      .eq("user_id", profile.user_id)
      .eq("meal_date", tomorrowStr)
      .maybeSingle();

    // Fetch today meal as fallback default if tomorrow is not yet created
    const { data: todayMeal } = await supabase
      .from("daily_meals")
      .select("lunch, dinner, lunch_extra_option, dinner_extra_option")
      .eq("user_id", profile.user_id)
      .eq("meal_date", todayStr)
      .maybeSingle();

    // Fetch existing extra_meals
    const { data: existingExtraMeals } = await supabase
      .from("extra_meals")
      .select("id, meal_type, quantity")
      .eq("user_id", profile.user_id)
      .eq("meal_date", tomorrowStr);

    let newLunch = existingMeal ? existingMeal.lunch : todayMeal ? todayMeal.lunch : true;
    let newDinner = existingMeal ? existingMeal.dinner : todayMeal ? todayMeal.dinner : true;
    let newLunchFoodExtra = existingMeal ? existingMeal.lunch_extra_option : todayMeal?.lunch_extra_option || null;
    let newDinnerFoodExtra = existingMeal ? existingMeal.dinner_extra_option : todayMeal?.dinner_extra_option || null;

    let targetExtraL = existingExtraMeals?.find((e: any) => e.meal_type === "lunch")?.quantity || 0;
    let targetExtraD = existingExtraMeals?.find((e: any) => e.meal_type === "dinner")?.quantity || 0;

    // Apply Total Lunch Count
    if (parsed.totalLunch !== undefined) {
      if (parsed.totalLunch > 0) {
        newLunch = true;
        targetExtraL = parsed.totalLunch - 1;
      } else {
        newLunch = false;
        targetExtraL = 0;
      }
    } else if (parsed.relativeExtraLunch !== undefined) {
      newLunch = true;
      targetExtraL = parsed.relativeExtraLunch;
    }

    // Apply Total Dinner Count
    if (parsed.totalDinner !== undefined) {
      if (parsed.totalDinner > 0) {
        newDinner = true;
        targetExtraD = parsed.totalDinner - 1;
      } else {
        newDinner = false;
        targetExtraD = 0;
      }
    } else if (parsed.relativeExtraDinner !== undefined) {
      newDinner = true;
      targetExtraD = parsed.relativeExtraDinner;
    }

    // Apply Food Extra Options
    if (parsed.globalFoodExtra === null) {
      newLunchFoodExtra = null;
      newDinnerFoodExtra = null;
      targetExtraL = 0;
      targetExtraD = 0;
    }

    if (parsed.globalRemoveFoodExtra) {
      newLunchFoodExtra = applyExtraOptionUpdate(newLunchFoodExtra, undefined, parsed.globalRemoveFoodExtra);
      newDinnerFoodExtra = applyExtraOptionUpdate(newDinnerFoodExtra, undefined, parsed.globalRemoveFoodExtra);
    }

    if (parsed.lunchFoodExtra !== undefined || parsed.lunchRemoveFoodExtra) {
      newLunchFoodExtra = applyExtraOptionUpdate(newLunchFoodExtra, parsed.lunchFoodExtra, parsed.lunchRemoveFoodExtra);
    }

    if (parsed.dinnerFoodExtra !== undefined || parsed.dinnerRemoveFoodExtra) {
      newDinnerFoodExtra = applyExtraOptionUpdate(newDinnerFoodExtra, parsed.dinnerFoodExtra, parsed.dinnerRemoveFoodExtra);
    }

    if (parsed.globalFoodExtra) {
      if (newLunch === false && newDinner === true) {
        newDinnerFoodExtra = applyExtraOptionUpdate(newDinnerFoodExtra, parsed.globalFoodExtra);
      } else {
        newLunchFoodExtra = applyExtraOptionUpdate(newLunchFoodExtra, parsed.globalFoodExtra);
      }
    }

    // 1. Save to daily_meals database
    if (existingMeal) {
      const { error: updateErr } = await supabase
        .from("daily_meals")
        .update({
          lunch: newLunch,
          dinner: newDinner,
          lunch_extra_option: newLunchFoodExtra,
          dinner_extra_option: newDinnerFoodExtra,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMeal.id);

      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase.from("daily_meals").insert({
        user_id: profile.user_id,
        meal_date: tomorrowStr,
        lunch: newLunch,
        dinner: newDinner,
        lunch_extra_option: newLunchFoodExtra,
        dinner_extra_option: newDinnerFoodExtra,
        lunch_off_today_only: false,
        dinner_off_today_only: false,
      });

      if (insertErr) throw insertErr;
    }

    // 2. Save Extra Meals to extra_meals database
    // Lunch Extra Meal
    const existingLunchExtraRow = existingExtraMeals?.find((e: any) => e.meal_type === "lunch");
    if (targetExtraL > 0) {
      if (existingLunchExtraRow) {
        await supabase
          .from("extra_meals")
          .update({
            quantity: targetExtraL,
            is_feast_day: isFeastDay,
            meal_count_equivalent: mealCountEquiv,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLunchExtraRow.id);
      } else {
        await supabase.from("extra_meals").insert({
          user_id: profile.user_id,
          meal_date: tomorrowStr,
          meal_type: "lunch",
          quantity: targetExtraL,
          is_feast_day: isFeastDay,
          meal_count_equivalent: mealCountEquiv,
          reason: "telegram_bot",
        });
      }
    } else if (existingLunchExtraRow) {
      await supabase.from("extra_meals").delete().eq("id", existingLunchExtraRow.id);
    }

    // Dinner Extra Meal
    const existingDinnerExtraRow = existingExtraMeals?.find((e: any) => e.meal_type === "dinner");
    if (targetExtraD > 0) {
      if (existingDinnerExtraRow) {
        await supabase
          .from("extra_meals")
          .update({
            quantity: targetExtraD,
            is_feast_day: isFeastDay,
            meal_count_equivalent: mealCountEquiv,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDinnerExtraRow.id);
      } else {
        await supabase.from("extra_meals").insert({
          user_id: profile.user_id,
          meal_date: tomorrowStr,
          meal_type: "dinner",
          quantity: targetExtraD,
          is_feast_day: isFeastDay,
          meal_count_equivalent: mealCountEquiv,
          reason: "telegram_bot",
        });
      }
    } else if (existingDinnerExtraRow) {
      await supabase.from("extra_meals").delete().eq("id", existingDinnerExtraRow.id);
    }

    // Build update banner text for the All-Batch message
    const totalLCount = (newLunch ? 1 : 0) + targetExtraL;
    const totalDCount = (newDinner ? 1 : 0) + targetExtraD;
    const lunchDisplay = newLunch ? (targetExtraL > 0 ? `✅+${targetExtraL}` : "✅") : "❌";
    const dinnerDisplay = newDinner ? (targetExtraD > 0 ? `✅+${targetExtraD}` : "✅") : "❌";

    let foodExtraBanner = "";
    if (newLunchFoodExtra && newDinnerFoodExtra) {
      foodExtraBanner = ` · 🍖 ${formatExtraDisplay(newLunchFoodExtra)} / ${formatExtraDisplay(newDinnerFoodExtra)}`;
    } else if (newLunchFoodExtra) {
      foodExtraBanner = ` · 🍖 ${formatExtraDisplay(newLunchFoodExtra)}`;
    } else if (newDinnerFoodExtra) {
      foodExtraBanner = ` · 🍖 ${formatExtraDisplay(newDinnerFoodExtra)}`;
    }

    const bannerText = `[রোল ${profile.roll_number} (${profile.full_name.split(" ")[0]}): L: ${lunchDisplay} · D: ${dinnerDisplay}${foodExtraBanner} আপডেট সম্পন্ন]`;

    // 3. Generate Complete All-Batch List
    const fullAllBatchSummary = await buildAllBatchSummary(supabase, tomorrowStr, bannerText);

    if (isGroup) {
      // Delete previous summary message if any
      if (settings?.telegram_last_summary_message_id) {
        await deleteTelegramMessage(chatId, settings.telegram_last_summary_message_id);
      }

      // Send silent new message
      const sendResp = await sendTelegramReply(chatId, fullAllBatchSummary, undefined, true);
      const newMsgId = sendResp?.result?.message_id;

      if (newMsgId) {
        // Unpin previous & Pin new message silently
        try {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/unpinAllChatMessages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId }),
          });
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/pinChatMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: newMsgId, disable_notification: true }),
          });
        } catch (e) {
          console.warn("Pin summary failed:", e);
        }

        // Save new message id in app_settings
        await supabase.from("app_settings").update({ telegram_last_summary_message_id: String(newMsgId) }).eq("id", 1);
      }
    } else {
      // Private message response
      await sendTelegramReply(chatId, fullAllBatchSummary, messageId);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: profile.user_id,
        roll: profile.roll_number,
        lunch: newLunch,
        dinner: newDinner,
        total_lunch: totalLCount,
        total_dinner: totalDCount,
        extra_lunch: targetExtraL,
        extra_dinner: targetExtraD,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Telegram webhook error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

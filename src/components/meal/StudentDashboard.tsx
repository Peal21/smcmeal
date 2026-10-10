import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { playToggleOnSound, playToggleOffSound, playSuccessSound, playClickSound } from '@/lib/sounds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { notifyUpdate, sendTelegramMealNotification } from '@/lib/notify';
import { format, addDays, isAfter, set, getDay } from 'date-fns';
import { Sun, Moon, Utensils, Wallet, TrendingUp, Clock, Plus, Minus, Trash2, Edit2, Check, X, AlertTriangle, ShieldAlert, Phone, History, Timer, Sparkles, GraduationCap, Image as ImageIcon, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { fetchResolvedMealMonth, getMealMonthDateRange } from '@/lib/mealMonth';
import { getExtraMealEquivalent, isDefaultFeastDay } from '@/lib/feastDay';
import SpecialDayItems from './SpecialDayItems';

const DAY_NAMES_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];

const EXTRA_LABEL_MAP: Record<string, string> = {
  beef: 'গরু', mutton: 'খাসি', chicken: 'গরু/খাসির পরিবর্তে মুরগি',
  egg_fish_fry: 'ডিম ভাজি(মাছ)', egg_fish_poach: 'ডিম পোচ(মাছ)',
  egg_chicken_fry: 'ডিম ভাজি(পোল্ট্রি)', egg_chicken_poach: 'ডিম পোচ(পোল্ট্রি)',
};

const EXTRA_OPTIONS = [
  { value: 'beef', label: 'গরু', group: 'meat' },
  { value: 'mutton', label: 'খাসি', group: 'meat' },
  { value: 'chicken', label: 'গরু/খাসির পরিবর্তে মুরগি', group: 'meat' },
  { value: 'egg_fish_fry', label: 'ডিম ভাজি (মাছ)', group: 'egg_fish' },
  { value: 'egg_fish_poach', label: 'ডিম পোচ (মাছ)', group: 'egg_fish' },
  { value: 'egg_chicken_fry', label: 'ডিম ভাজি (পোল্ট্রি)', group: 'egg_chicken' },
  { value: 'egg_chicken_poach', label: 'ডিম পোচ (পোল্ট্রি)', group: 'egg_chicken' },
];

const EXCLUSION_GROUPS: Record<string, string[]> = {
  meat: ['beef', 'mutton', 'chicken'],
  egg_fish: ['egg_fish_fry', 'egg_fish_poach'],
  egg_chicken: ['egg_chicken_fry', 'egg_chicken_poach'],
};

function getMealDate(): string {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd');
}

type CutoffPhase = 'open' | 'countdown' | 'locked';

type CutoffTime = { hour: number; minute: number };

function getCutoffPhase(cutoff: CutoffTime): CutoffPhase {
  const now = new Date();
  const countdownStart = set(now, { hours: cutoff.hour - 1, minutes: cutoff.minute, seconds: 0, milliseconds: 0 });
  const lockTime = set(now, { hours: cutoff.hour, minutes: cutoff.minute, seconds: 0, milliseconds: 0 });
  if (isAfter(now, lockTime)) return 'locked';
  if (isAfter(now, countdownStart)) return 'countdown';
  return 'open';
}

function getCountdownRemaining(cutoff: CutoffTime): { minutes: number; seconds: number; text: string; progress: number } {
  const now = new Date();
  const target = set(now, { hours: cutoff.hour, minutes: cutoff.minute, seconds: 0, milliseconds: 0 });
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { minutes: 0, seconds: 0, text: '০০:০০', progress: 100 };
  const totalSeconds = Math.floor(diff / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const toBangla = (n: number) => String(n).padStart(2, '0').replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[parseInt(d)]);
  const progress = ((3600 - totalSeconds) / 3600) * 100;
  return { minutes: mins, seconds: secs, text: `${toBangla(mins)}:${toBangla(secs)}`, progress };
}

function isCutoffPassed(cutoff: CutoffTime): boolean {
  return getCutoffPhase(cutoff) === 'locked';
}

export default function StudentDashboard() {
  const { user, profile, isManager, isAdmin } = useAuth();
  const privileged = isManager || isAdmin;
  const notify = (m: string) => notifyUpdate(m, privileged);
  const [todayMeal, setTodayMeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [monthStats, setMonthStats] = useState({ totalMeals: 0, totalPaid: 0, totalDue: 0, mealRate: 0, carryForward: 0 });
  const [extraQuantity, setExtraQuantity] = useState('0');
  const [extraMealType, setExtraMealType] = useState('lunch');
  const [extraReason, setExtraReason] = useState('');
  const [myExtraMeals, setMyExtraMeals] = useState<any[]>([]);
  const [offPeriods, setOffPeriods] = useState<any[]>([]);
  const [newOffStart, setNewOffStart] = useState<string>('');
  const [newOffEnd, setNewOffEnd] = useState<string>('');
  const [savingOffPeriod, setSavingOffPeriod] = useState(false);
  
  const [showExtraItemDialog, setShowExtraItemDialog] = useState(false);
  const [pendingExtraOption, setPendingExtraOption] = useState<string[]>([]);
  const [editingExtraMealId, setEditingExtraMealId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyMeals, setHistoryMeals] = useState<any[]>([]);
  const [historyExtras, setHistoryExtras] = useState<any[]>([]);
  const [historyStats, setHistoryStats] = useState({ paid: 0, carryForward: 0, rate: 0, mealMonth: null as any, mealCountOverride: null as number | null, minMeals: 0, extraCharge: 0 });
  const [allMonths, setAllMonths] = useState<any[]>([]);
  const [historyMonthId, setHistoryMonthId] = useState<string>('');
  const historyMonthIdRef = useRef<string>('');
  useEffect(() => { historyMonthIdRef.current = historyMonthId; }, [historyMonthId]);
  const mealDate = getMealDate();
  const tomorrowExtras = myExtraMeals.filter(em => em.meal_date === mealDate);
  const tomorrowExtraLunch = tomorrowExtras.find(em => em.meal_type === 'lunch');
  const tomorrowExtraDinner = tomorrowExtras.find(em => em.meal_type === 'dinner');
  const notified9 = useRef(false);
  const notified945 = useRef(false);
  const [cutoffTime, setCutoffTime] = useState<CutoffTime>({ hour: 22, minute: 0 });
  const [offModeDialog, setOffModeDialog] = useState<{ open: boolean; type: 'lunch' | 'dinner' | null }>({ open: false, type: null });
  const [showGalleryDialog, setShowGalleryDialog] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const smcPhotos = [
    { src: '/smc_1.jpg', title: 'সাতক্ষীরা মেডিকেল কলেজ মেইন ভবন', subtitle: 'প্রশাসনিক ও একাডেমিক কম্প্লেক্স' },
    { src: '/smc_2.jpg', title: 'ক্যাম্পাস প্রাঙ্গণ ও চত্বর', subtitle: 'সবুজ মনোরম পরিবেশ' },
    { src: '/smc_3.jpg', title: 'ডাইনিং হল ও মিল কর্নার', subtitle: 'ছাত্র হোস্টেল ও ক্যাফেটেরিয়া' },
    { src: '/smc_4.jpg', title: 'হোস্টেল চত্বর ও সড়ক', subtitle: 'মেডিকেল শিক্ষার্থীদের আবাসন' },
    { src: '/smc_5.jpg', title: 'গোধূলি আলোয় শান্ত ক্যাম্পাস', subtitle: 'সন্ধ্যায় দৃষ্টিনন্দন সাতক্ষীরা মেডিকেল কলেজ' },
  ];

  const getSelectedExtras = (mealType: 'lunch' | 'dinner' = 'lunch'): string[] => {
    const raw = mealType === 'dinner' ? todayMeal?.dinner_extra_option : todayMeal?.lunch_extra_option;
    if (!raw) return [];
    return Array.from(new Set(raw.split(',').map((s: string) => s.trim()).filter(Boolean)));
  };

  const fetchTodayMeal = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('daily_meals').select('*')
      .eq('user_id', user.id).eq('meal_date', mealDate).maybeSingle();

    if (!data) {
      try {
        const { data: offData } = await supabase
          .from('meal_off_periods' as any)
          .select('*')
          .eq('user_id', user.id)
          .lte('start_date', mealDate)
          .gte('end_date', mealDate)
          .maybeSingle();

        const isOff = !!offData;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const { data: todayRow } = await supabase
          .from('daily_meals')
          .select('*')
          .eq('user_id', user.id)
          .eq('meal_date', todayStr)
          .maybeSingle();

        let defaultLunch = true;
        let defaultDinner = true;
        if (isOff) {
          defaultLunch = false;
          defaultDinner = false;
        } else if (todayRow) {
          defaultLunch = todayRow.lunch_off_today_only ? true : todayRow.lunch;
          defaultDinner = todayRow.dinner_off_today_only ? true : todayRow.dinner;
        }

        const defaultMeal = {
          user_id: user.id,
          meal_date: mealDate,
          lunch: defaultLunch,
          dinner: defaultDinner,
          lunch_extra_option: todayRow?.lunch_extra_option || null,
          dinner_extra_option: todayRow?.dinner_extra_option || null,
          lunch_off_today_only: false,
          dinner_off_today_only: false,
        };

        const { data: inserted } = await supabase
          .from('daily_meals')
          .insert(defaultMeal)
          .select()
          .maybeSingle();

        setTodayMeal(inserted || defaultMeal);
      } catch (e) {
        console.error('Error auto-initializing meal:', e);
        setTodayMeal(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    setTodayMeal(data);
    setLoading(false);
  };

  const fetchExtraMeals = async () => {
    if (!user) return;
    const now = new Date();
    const { data: mm } = await fetchResolvedMealMonth(now);
    const { start: startOfMonth, end: endOfMonth } = getMealMonthDateRange(mm, now);
    const { data } = await supabase
      .from('extra_meals').select('*')
      .eq('user_id', user.id).gte('meal_date', startOfMonth).lte('meal_date', endOfMonth)
      .order('created_at', { ascending: false });
    setMyExtraMeals(data || []);
  };

  const fetchOffPeriods = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('meal_off_periods' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true });
    setOffPeriods(data || []);
  };

  const addOffPeriod = async () => {
    if (!user || !newOffStart || !newOffEnd) {
      toast.error('শুরু এবং শেষ তারিখ সিলেক্ট করুন');
      return;
    }
    const start = new Date(newOffStart + 'T00:00:00');
    const end = new Date(newOffEnd + 'T00:00:00');
    if (end < start) {
      toast.error('শেষ তারিখ শুরু তারিখের আগে হতে পারবে না');
      return;
    }

    setSavingOffPeriod(true);
    const { error } = await supabase.from('meal_off_periods' as any).insert({
      user_id: user.id,
      start_date: newOffStart,
      end_date: newOffEnd,
    });

    if (error) {
      toast.error(error.message);
      setSavingOffPeriod(false);
      return;
    }

    const dates: string[] = [];
    let curr = new Date(start);
    while (curr <= end) {
      dates.push(format(curr, 'yyyy-MM-dd'));
      curr.setDate(curr.getDate() + 1);
    }

    for (const dateStr of dates) {
      const { data: existing } = await supabase
        .from('daily_meals')
        .select('id')
        .eq('user_id', user.id)
        .eq('meal_date', dateStr)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('daily_meals')
          .update({ lunch: false, dinner: false })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('daily_meals')
          .insert({ user_id: user.id, meal_date: dateStr, lunch: false, dinner: false });
      }
    }

    const resumeDate = new Date(end);
    resumeDate.setDate(resumeDate.getDate() + 1);
    const resumeDateStr = format(resumeDate, 'yyyy-MM-dd');
    const { data: resumeExisting } = await supabase
      .from('daily_meals')
      .select('id')
      .eq('user_id', user.id)
      .eq('meal_date', resumeDateStr)
      .maybeSingle();

    if (resumeExisting) {
      await supabase
        .from('daily_meals')
        .update({ lunch: true, dinner: true })
        .eq('id', resumeExisting.id);
    } else {
      await supabase
        .from('daily_meals')
        .insert({ user_id: user.id, meal_date: resumeDateStr, lunch: true, dinner: true });
    }

    void sendMealUpdateEmail({
      action: 'HOLIDAY_START',
      startDate: format(new Date(newOffStart + 'T00:00:00'), 'dd MMM yyyy'),
      endDate: format(new Date(newOffEnd + 'T00:00:00'), 'dd MMM yyyy')
    });

    toast.success('ছুটি/অফ ডেট রেঞ্জ সফলভাবে যোগ হয়েছে');
    setNewOffStart('');
    setNewOffEnd('');
    fetchOffPeriods();
    fetchTodayMeal();
    fetchMonthStats();
    setSavingOffPeriod(false);
  };

  const deleteOffPeriod = async (id: string, startDateStr: string, endDateStr: string) => {
    const { error } = await supabase.from('meal_off_periods' as any).delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }

    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(endDateStr + 'T00:00:00');
    const dates: string[] = [];
    let curr = new Date(start);
    while (curr <= end) {
      dates.push(format(curr, 'yyyy-MM-dd'));
      curr.setDate(curr.getDate() + 1);
    }

    for (const dateStr of dates) {
      const { data: existing } = await supabase
        .from('daily_meals')
        .select('id')
        .eq('user_id', user.id)
        .eq('meal_date', dateStr)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('daily_meals')
          .update({ lunch: true, dinner: true })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('daily_meals')
          .insert({ user_id: user.id, meal_date: dateStr, lunch: true, dinner: true });
      }
    }

    void sendMealUpdateEmail({
      action: 'HOLIDAY_CANCEL',
      startDate: format(new Date(startDateStr + 'T00:00:00'), 'dd MMM yyyy'),
      endDate: format(new Date(endDateStr + 'T00:00:00'), 'dd MMM yyyy')
    });

    toast.success('ছুটি/অফ ডেট রেঞ্জ মুছে ফেলা হয়েছে');
    fetchOffPeriods();
    fetchTodayMeal();
    fetchMonthStats();
  };

  const fetchMonthStats = async () => {
    if (!user) return;
    const now = new Date();
    const { data: mealMonth } = await fetchResolvedMealMonth(now);
    const { start: startOfMonth, end: endOfMonth } = getMealMonthDateRange(mealMonth, now);

    const [mealsRes, extraRes] = await Promise.all([
      supabase.from('daily_meals').select('lunch, dinner, meal_date')
        .eq('user_id', user.id).gte('meal_date', startOfMonth).lte('meal_date', endOfMonth),
      supabase.from('extra_meals').select('quantity, meal_count_equivalent')
        .eq('user_id', user.id).gte('meal_date', startOfMonth).lte('meal_date', endOfMonth),
    ]);

    const regularMeals = (mealsRes.data || []).reduce((acc, m) => {
      return acc + (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0);
    }, 0);
    const extraMealCount = (extraRes.data || []).reduce((a, e) => a + (Number(e.quantity) || 0) * getExtraMealEquivalent(e), 0);
    let totalMeals = regularMeals + extraMealCount;

    let totalPaid = 0;
    let carryForward = 0;
    let mealCountOverride: number | null = null;
    if (mealMonth) {
      const [paymentsRes, balanceRes] = await Promise.all([
        supabase.from('payments').select('amount').eq('user_id', user.id).eq('month_id', mealMonth.id),
        supabase.from('member_balances').select('carry_forward, meal_count_override').eq('user_id', user.id).eq('month_id', mealMonth.id).maybeSingle(),
      ]);
      totalPaid = (paymentsRes.data || []).reduce((acc, p) => acc + Number(p.amount), 0);
      carryForward = balanceRes.data ? Number(balanceRes.data.carry_forward) : 0;
      const ov = (balanceRes.data as any)?.meal_count_override;
      if (ov !== null && ov !== undefined) mealCountOverride = Number(ov);
    }

    // Apply admin override if present
    if (mealCountOverride !== null) totalMeals = mealCountOverride;
    // Apply min_meals floor
    const minMeals = mealMonth ? Number((mealMonth as any).min_meals ?? 0) : 0;
    const effectiveMeals = minMeals > 0 && totalMeals < minMeals ? minMeals : totalMeals;
    const extraCharge = mealMonth ? Number((mealMonth as any).extra_charge ?? 0) : 0;

    const mealRate = mealMonth ? Number(mealMonth.meal_rate) : 0;
    const totalCost = effectiveMeals * mealRate + extraCharge;
    const totalDue = totalCost + carryForward - totalPaid;
    setMonthStats({ totalMeals: effectiveMeals, totalPaid, totalDue, mealRate, carryForward });
  };

  const fetchHistory = async (monthIdOverride?: string) => {
    if (!user) return;
    const now = new Date();
    let mm: any = null;
    const targetId = monthIdOverride ?? historyMonthIdRef.current ?? historyMonthId;
    if (targetId) {
      const { data } = await supabase.from('meal_months').select('*').eq('id', targetId).maybeSingle();
      mm = data;
    }
    if (!mm) {
      const res = await fetchResolvedMealMonth(now);
      mm = res.data;
    }
    const { start: startOfMonth, end: endOfMonth } = getMealMonthDateRange(mm, now);
    const [{ data: meals }, { data: extras }, { data: payments }, { data: balance }] = await Promise.all([
      supabase.from('daily_meals').select('meal_date, lunch, dinner, lunch_extra_option').eq('user_id', user.id).gte('meal_date', startOfMonth).lte('meal_date', endOfMonth).order('meal_date'),
      supabase.from('extra_meals').select('meal_date, meal_type, quantity, meal_count_equivalent, is_feast_day').eq('user_id', user.id).gte('meal_date', startOfMonth).lte('meal_date', endOfMonth),
      mm ? supabase.from('payments').select('amount').eq('user_id', user.id).eq('month_id', mm.id) : Promise.resolve({ data: [] as any[] }),
      mm ? supabase.from('member_balances').select('carry_forward, meal_count_override').eq('user_id', user.id).eq('month_id', mm.id).maybeSingle() : Promise.resolve({ data: null as any }),
    ]);
    setHistoryMeals(meals || []);
    setHistoryExtras(extras || []);
    const ov = (balance as any)?.meal_count_override;
    setHistoryStats({
      paid: (payments || []).reduce((a: number, p: any) => a + Number(p.amount), 0),
      carryForward: balance ? Number((balance as any).carry_forward) : 0,
      rate: mm ? Number(mm.meal_rate) || 0 : 0,
      mealMonth: mm,
      mealCountOverride: ov !== null && ov !== undefined ? Number(ov) : null,
      minMeals: mm ? Number((mm as any).min_meals ?? 0) : 0,
      extraCharge: mm ? Number((mm as any).extra_charge ?? 0) : 0,
    });
  };

  const fetchAllMonths = async () => {
    const { data } = await supabase.from('meal_months').select('*').order('start_date', { ascending: false, nullsFirst: false });
    const months = data || [];
    setAllMonths(months);
    if (!historyMonthId) {
      const active = months.find((m: any) => m.is_active) || months[0];
      if (active) setHistoryMonthId(active.id);
    }
  };

  // Fetch cutoff time from app_settings
  useEffect(() => {
    const fetchCutoff = async () => {
      const { data } = await supabase.from('app_settings' as any).select('meal_cutoff_hour, meal_cutoff_minute').eq('id', 1).single();
      if (data) {
        setCutoffTime({ hour: (data as any).meal_cutoff_hour ?? 22, minute: (data as any).meal_cutoff_minute ?? 0 });
      }
    };
    fetchCutoff();
  }, []);

  useEffect(() => {
    fetchTodayMeal();
    fetchMonthStats();
    fetchExtraMeals();
    fetchOffPeriods();
    fetchHistory();
    fetchAllMonths();
    const channel = supabase
      .channel('daily-meals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_meals', filter: `user_id=eq.${user?.id}` }, () => {
        fetchTodayMeal(); fetchMonthStats(); fetchHistory();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extra_meals', filter: `user_id=eq.${user?.id}` }, () => {
        fetchExtraMeals(); fetchMonthStats(); fetchHistory();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_off_periods', filter: `user_id=eq.${user?.id}` }, () => {
        fetchOffPeriods(); fetchTodayMeal(); fetchMonthStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user?.id}` }, () => {
        fetchMonthStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_balances', filter: `user_id=eq.${user?.id}` }, () => {
        fetchMonthStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_months' }, () => {
        fetchExtraMeals(); fetchMonthStats(); fetchHistory();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        supabase.from('app_settings' as any).select('meal_cutoff_hour, meal_cutoff_minute').eq('id', 1).single().then(({ data }) => {
          if (data) setCutoffTime({ hour: (data as any).meal_cutoff_hour ?? 22, minute: (data as any).meal_cutoff_minute ?? 0 });
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const [phase, setPhase] = useState<CutoffPhase>(getCutoffPhase(cutoffTime));
  const [countdown, setCountdown] = useState(getCountdownRemaining(cutoffTime));

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const newPhase = getCutoffPhase(cutoffTime);
      setPhase(newPhase);
      setCountdown(getCountdownRemaining(cutoffTime));

      // Send notifications at 9:00 PM and 9:45 PM
      const now = new Date();
      const hour = now.getHours();
      const min = now.getMinutes();

      if (hour === 21 && min === 0 && !notified9.current) {
        notified9.current = true;
        sendNotification('⏰ মিল আপডেট করুন!', 'দুরুতো meal update দিন — আর ১ ঘণ্টা বাকি আছে!');
      }
      if (hour === 21 && min === 45 && !notified945.current) {
        notified945.current = true;
        sendNotification('🚨 মিল আপডেটের সময় শেষ হচ্ছে!', 'আর মাত্র ১৫ মিনিট! এখনই meal update দিন!');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [cutoffTime]);

  const sendNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png' });
    }
  };

  const cutoff = phase === 'locked';

  const toggleMeal = async (type: 'lunch' | 'dinner', value: boolean, offTodayOnly = false) => {
    if (cutoff) { toast.error('কাটঅফ টাইমের পর meal আপডেট করা যায় না!'); return; }
    if (!user) { toast.error('লগইন করুন'); return; }
    try {
      // When turning ON, always clear the off-today-only flag.
      // When turning OFF, set the flag based on user's choice.
      const flagValue = value ? false : offTodayOnly;
      const updatePayload: any = type === 'lunch'
        ? { lunch: value, lunch_off_today_only: flagValue }
        : { dinner: value, dinner_off_today_only: flagValue };
      if (todayMeal) {
        const { error } = await supabase.from('daily_meals').update(updatePayload).eq('id', todayMeal.id);
        if (error) { console.error('Update error:', error); toast.error('আপডেট ব্যর্থ: ' + error.message); return; }
      } else {
        const insertPayload: any = type === 'lunch'
          ? { user_id: user.id, meal_date: mealDate, lunch: value, lunch_off_today_only: flagValue }
          : { user_id: user.id, meal_date: mealDate, dinner: value, dinner_off_today_only: flagValue };
        const { error } = await supabase.from('daily_meals').insert(insertPayload);
        if (error) { console.error('Insert error:', error); toast.error('ইনসার্ট ব্যর্থ: ' + error.message); return; }
      }
      await fetchTodayMeal();
      const label = type === 'lunch' ? 'লাঞ্চ' : 'ডিনার';
      const dateDisplay = format(new Date(mealDate + 'T00:00:00'), 'dd MMM yyyy');

      void sendMealUpdateEmail({
        mealType: type,
        action: value ? 'ON' : 'OFF',
        mealDate: format(new Date(mealDate + 'T00:00:00'), 'dd MMMM yyyy')
      });

      // Telegram notification (fire-and-forget)
      void sendTelegramMealNotification({
        userId: user.id,
        roll: profile?.roll_number || '',
        name: profile?.full_name || '',
        message: value
          ? `☀️ <b>${label} চালু</b> — ${dateDisplay}\n👤 <b>${profile?.full_name || ''}</b> (রোল: ${profile?.roll_number || ''})`
          : offTodayOnly
            ? `❌ <b>${label} বন্ধ (শুধু আগামীকাল)</b> — ${dateDisplay}\n👤 <b>${profile?.full_name || ''}</b> (রোল: ${profile?.roll_number || ''})`
            : `❌ <b>${label} বন্ধ</b> — ${dateDisplay}\n👤 <b>${profile?.full_name || ''}</b> (রোল: ${profile?.roll_number || ''})`,
      });

      if (value) {
        playToggleOnSound();
        notify(`${label} চালু করা হয়েছে`);
      } else {
        playToggleOffSound();
        if (offTodayOnly) notify(`${label} শুধু আগামীকালের জন্য বন্ধ — পরের দিন আবার চালু হবে`);
        else notify(`${label} বন্ধ করা হয়েছে (যতক্ষণ না আপনি আবার চালু করেন)`);
      }
    } catch (err: any) {
      console.error('Toggle meal error:', err);
      toast.error('সমস্যা হয়েছে: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleMealRowToggle = (type: 'lunch' | 'dinner') => {
    const currentValue = type === 'lunch' ? !!todayMeal?.lunch : !!todayMeal?.dinner;
    const nextValue = !currentValue;
    if (!nextValue) {
      // Turning OFF — ask user the off mode
      if (cutoff) { toast.error('কাটঅফ টাইমের পর meal আপডেট করা যায় না!'); return; }
      setOffModeDialog({ open: true, type });
      return;
    }
    void toggleMeal(type, nextValue);
  };

  const toggleExtra = async (value: string, checked: boolean) => {
    if (!user) return;
    if (isCutoffPassed(cutoffTime)) { toast.error('কাটঅফ টাইমের পর Extra item পরিবর্তন করা যাবে না'); return; }
    let current = getSelectedExtras();
    if (checked) {
      const option = EXTRA_OPTIONS.find(o => o.value === value);
      const group = option?.group;
      if (group && EXCLUSION_GROUPS[group]) {
        current = current.filter(v => !EXCLUSION_GROUPS[group].includes(v));
      }
      current = [...current, value];
    } else {
      current = current.filter(v => v !== value);
    }
    const stored = current.length > 0 ? current.join(',') : null;
    if (todayMeal) {
      await supabase.from('daily_meals').update({ lunch_extra_option: stored }).eq('id', todayMeal.id);
    } else {
      await supabase.from('daily_meals').insert({ user_id: user.id, meal_date: mealDate, lunch_extra_option: stored });
    }
    fetchTodayMeal();
    playClickSound();
    notify('Extra option আপডেট হয়েছে');
  };

  const sendMealUpdateEmail = async (params: {
    mealType?: 'lunch' | 'dinner' | 'both';
    action: 'ON' | 'OFF' | 'HOLIDAY_START' | 'HOLIDAY_CANCEL' | 'EXTRA_MEAL_ADD' | 'EXTRA_MEAL_DELETE';
    mealDate?: string;
    startDate?: string;
    endDate?: string;
    quantity?: number;
    extraOption?: string;
    mealCountEquivalent?: number;
  }) => {
    if (!user || !user.email) return;
    try {
      await supabase.functions.invoke('send-meal-update-email', {
        body: {
          email: user.email,
          name: profile?.full_name || user.email,
          mealType: params.mealType,
          action: params.action,
          mealDate: params.mealDate,
          startDate: params.startDate,
          endDate: params.endDate,
          quantity: params.quantity,
          extraOption: params.extraOption,
          mealCountEquivalent: params.mealCountEquivalent,
        }
      });
    } catch (err) {
      console.error('Error invoking email function:', err);
    }
  };

  const canEditExtraMeal = (mealDateStr: string): boolean => {
    const now = new Date();
    const mealDay = new Date(mealDateStr + 'T00:00:00');
    const cutoffTime = new Date(mealDay);
    cutoffTime.setHours(22, 0, 0, 0);
    return now < cutoffTime;
  };

  const openExtraMealDialog = () => {
    if (!user) return;
    if (isCutoffPassed(cutoffTime)) { toast.error('কাটঅফ টাইমের পর Extra মিল যোগ করা যাবে না'); return; }
    const qty = parseInt(extraQuantity) || 0;
    if (qty < 1 || qty > 10) { toast.error('১ থেকে ১০ এর মধ্যে দিন'); return; }
    setEditingExtraMealId(null);
    // Pre-fill with the SAME meal type's extra options (lunch ↔ lunch, dinner ↔ dinner)
    const regularExtras = getSelectedExtras(extraMealType as 'lunch' | 'dinner');
    setPendingExtraOption(regularExtras.length > 0 ? [...regularExtras] : []);
    setShowExtraItemDialog(true);
  };

  const handleIncTomorrowExtra = (type: 'lunch' | 'dinner') => {
    if (isCutoffPassed(cutoffTime)) { toast.error('কাটঅফ টাইমের পর Extra মিল পরিবর্তন করা যাবে না'); return; }
    const existing = type === 'lunch' ? tomorrowExtraLunch : tomorrowExtraDinner;
    if (existing) {
      setEditingExtraMealId(existing.id);
      setExtraMealType(type);
      setExtraQuantity(String(existing.quantity + 1));
      const opts = (existing.extra_option || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      setPendingExtraOption(opts);
      setShowExtraItemDialog(true);
    } else {
      setEditingExtraMealId(null);
      setExtraMealType(type);
      setExtraQuantity('1');
      const regularExtras = getSelectedExtras(type);
      setPendingExtraOption(regularExtras.length > 0 ? [...regularExtras] : []);
      setShowExtraItemDialog(true);
    }
  };

  const handleDecTomorrowExtra = async (type: 'lunch' | 'dinner') => {
    if (isCutoffPassed(cutoffTime)) { toast.error('কাটঅফ টাইমের পর Extra মিল পরিবর্তন করা যাবে না'); return; }
    const existing = type === 'lunch' ? tomorrowExtraLunch : tomorrowExtraDinner;
    if (!existing) return;

    if (existing.quantity <= 1) {
      await deleteExtraMeal(existing.id, mealDate);
    } else {
      const opts = (existing.extra_option || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      if (opts.length > 0) opts.pop();
      const newOptsStr = opts.join(',');
      
      const { error } = await supabase.from('extra_meals').update({
        quantity: existing.quantity - 1,
        extra_option: newOptsStr,
      } as any).eq('id', existing.id);

      if (error) toast.error(error.message);
      else {
        notify('অতিরিক্ত মিল কমানো হয়েছে');
        fetchExtraMeals();
        fetchMonthStats();
      }
    }
  };

  const openEditExtraDialog = (em: any) => {
    if (!canEditExtraMeal(em.meal_date)) { toast.error('এই দিনের Extra মিল আর পরিবর্তন করা যাবে না'); return; }
    setEditingExtraMealId(em.id);
    setExtraMealType(em.meal_type);
    setExtraQuantity(String(em.quantity));
    setExtraReason(em.reason || '');
    const opts = (em.extra_option || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    setPendingExtraOption(opts);
    setShowExtraItemDialog(true);
  };

  const incExtraItem = (value: string) => {
    const qty = parseInt(extraQuantity) || 0;
    if (pendingExtraOption.length >= qty) {
      toast.error(`সর্বোচ্চ ${qty}টি item নেওয়া যাবে`);
      return;
    }
    setPendingExtraOption(prev => [...prev, value]);
  };

  const decExtraItem = (value: string) => {
    setPendingExtraOption(prev => {
      const idx = prev.lastIndexOf(value);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  };

  const togglePendingExtraOption = (value: string, checked: boolean) => {
    if (checked) incExtraItem(value); else decExtraItem(value);
  };

  const confirmAddExtraMeal = async () => {
    if (!user) return;
    const qty = parseInt(extraQuantity) || 0;
    if (qty < 1) { toast.error('সংখ্যা কমপক্ষে ১ হতে হবে'); return; }
    if (pendingExtraOption.length !== qty) {
      toast.error(`${qty}টি serving — তাই ঠিক ${qty}টি item বাছাই করুন (এখন ${pendingExtraOption.length}টি)`);
      return;
    }

    const extraOptionStr = pendingExtraOption.join(',');
    const mealDateObj = new Date(mealDate + 'T00:00:00');
    const dayOfWeek = mealDateObj.getDay();
    const isFeast = dayOfWeek === 1 || dayOfWeek === 5;
    const mealCountEquivalent = isFeast ? 3 : 1;

    const dateDisplay = format(new Date(mealDate + 'T00:00:00'), 'dd MMM yyyy');
    const extraLabel = extraMealType === 'lunch' ? 'লাঞ্চ' : 'ডিনার';
    if (editingExtraMealId) {
      const { error } = await supabase.from('extra_meals').update({
        meal_type: extraMealType,
        quantity: qty,
        reason: extraReason || null,
        extra_option: extraOptionStr,
        is_feast_day: isFeast,
        meal_count_equivalent: mealCountEquivalent,
      } as any).eq('id', editingExtraMealId);
      if (error) { toast.error(error.message); return; }
      playSuccessSound();
      void sendMealUpdateEmail({
        action: 'EXTRA_MEAL_ADD',
        mealType: extraMealType as any,
        quantity: qty,
        extraOption: extraOptionStr,
        mealDate: format(new Date(mealDate + 'T00:00:00'), 'dd MMMM yyyy'),
        mealCountEquivalent: mealCountEquivalent
      });
      void sendTelegramMealNotification({
        userId: user.id,
        roll: profile?.roll_number || '',
        name: profile?.full_name || '',
        message: `✏️ <b>Extra ${extraLabel} আপডেট</b> — ${dateDisplay}\n👤 <b>${profile?.full_name || ''}</b> (রোল: ${profile?.roll_number || ''})\n🍽️ পরিমাণ: ${qty}${isFeast ? ' (Feast Day — ১টি = ৩ মিল)' : ''}`,
      });
      notify('আপডেট হয়েছে');
    } else {
      const { error } = await supabase.from('extra_meals').insert({
        user_id: user.id,
        meal_date: mealDate,
        meal_type: extraMealType,
        quantity: qty,
        is_feast_day: isFeast,
        meal_count_equivalent: mealCountEquivalent,
        reason: extraReason || null,
        extra_option: extraOptionStr,
      } as any);

      if (error) { toast.error(error.message); return; }
      playSuccessSound();
      void sendMealUpdateEmail({
        action: 'EXTRA_MEAL_ADD',
        mealType: extraMealType as any,
        quantity: qty,
        extraOption: extraOptionStr,
        mealDate: format(new Date(mealDate + 'T00:00:00'), 'dd MMMM yyyy'),
        mealCountEquivalent: mealCountEquivalent
      });
      void sendTelegramMealNotification({
        userId: user.id,
        roll: profile?.roll_number || '',
        name: profile?.full_name || '',
        message: `➕ <b>Extra ${extraLabel} যোগ</b> — ${dateDisplay}\n👤 <b>${profile?.full_name || ''}</b> (রোল: ${profile?.roll_number || ''})\n🍽️ পরিমাণ: ${qty}${isFeast ? ' (Feast Day — ১টি = ৩ মিল)' : ''}`,
      });
      notify(`${qty}টি অতিরিক্ত ${extraMealType === 'lunch' ? 'লাঞ্চ' : 'ডিনার'} যোগ হয়েছে${isFeast ? ' (Feast Day — ১টি = ৩ মিল)' : ''}`);
      setExtraQuantity('0');
      setExtraReason('');
    }
    setShowExtraItemDialog(false);
    setPendingExtraOption([]);
    setEditingExtraMealId(null);
    fetchExtraMeals();
    fetchMonthStats();
  };

  const deleteExtraMeal = async (id: string, mealDateStr: string) => {
    if (!canEditExtraMeal(mealDateStr)) { toast.error('এই দিনের Extra মিল আর পরিবর্তন করা যাবে না (রাত ১০:০০ পার)'); return; }
    const { data: em } = await supabase.from('extra_meals').select('meal_type').eq('id', id).maybeSingle();
    const { error } = await supabase.from('extra_meals').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      playToggleOffSound();
      if (em) {
        void sendMealUpdateEmail({
          action: 'EXTRA_MEAL_DELETE',
          mealType: em.meal_type as any,
          mealDate: format(new Date(mealDateStr + 'T00:00:00'), 'dd MMMM yyyy')
        });
        const dLabel = em.meal_type === 'lunch' ? 'লাঞ্চ' : 'ডিনার';
        if (user) {
          void sendTelegramMealNotification({
            userId: user.id,
            roll: profile?.roll_number || '',
            name: profile?.full_name || '',
            message: `🗑️ <b>Extra ${dLabel} বাতিল</b> — ${format(new Date(mealDateStr + 'T00:00:00'), 'dd MMM yyyy')}\n👤 <b>${profile?.full_name || ''}</b> (রোল: ${profile?.roll_number || ''})`,
          });
        }
      }
      notify('অতিরিক্ত মিল মুছে ফেলা হয়েছে');
      fetchExtraMeals();
      fetchMonthStats();
    }
  };


  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 h-14 w-14 rounded-full border-4 border-transparent border-b-accent/30 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
      <p className="text-sm text-muted-foreground font-bengali animate-pulse neon-glow">লোড হচ্ছে...</p>
    </div>
  );

  const selectedExtras = getSelectedExtras();

  return (
    <div className="space-y-6">
      {/* ── Top Profile & Campus Banner ── */}
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Student Profile Info */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-base sm:text-lg font-bold font-bengali text-slate-900 dark:text-slate-100">
                  {profile?.full_name || 'শিক্ষার্থী'}
                </span>
                {profile?.roll_number && (
                  <Badge variant="secondary" className="font-mono text-[11px] px-2 py-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    রোল: {profile.roll_number}
                  </Badge>
                )}
                {profile?.room_number && (
                  <Badge variant="outline" className="font-bengali text-[11px] px-2 py-0 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                    রুম {profile.room_number}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bengali">
                সাতক্ষীরা মেডিকেল কলেজ হোস্টেল • {format(new Date(), 'EEEE, dd MMMM yyyy')}
              </p>
            </div>
          </div>

          {/* SMC Campus Photo Gallery Trigger */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGalleryDialog(true)}
              className="font-bengali h-9 text-xs px-3.5 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 gap-2 shadow-xs"
            >
              <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0">
                <img src={smcPhotos[activePhotoIdx].src} alt="SMC" className="w-full h-full object-cover" />
              </div>
              <span>ক্যাম্পাস গ্যালারি (৫টি ছবি)</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Campus Photo Gallery Modal ── */}
      <Dialog open={showGalleryDialog} onOpenChange={setShowGalleryDialog}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-bengali text-base sm:text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-emerald-600" />
              <span>সাতক্ষীরা মেডিকেল কলেজ — ক্যাম্পাস দৃশ্য</span>
            </DialogTitle>
            <DialogDescription className="font-bengali text-xs text-slate-500">
              {smcPhotos[activePhotoIdx].title} • {smcPhotos[activePhotoIdx].subtitle}
            </DialogDescription>
          </DialogHeader>

          {/* Photo Frame */}
          <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-950 shadow-inner group">
            <img
              src={smcPhotos[activePhotoIdx].src}
              alt={smcPhotos[activePhotoIdx].title}
              className="w-full h-full object-cover"
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setActivePhotoIdx(p => (p === 0 ? smcPhotos.length - 1 : p - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 border-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setActivePhotoIdx(p => (p === smcPhotos.length - 1 ? 0 : p + 1))}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 border-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Thumbnails */}
          <div className="grid grid-cols-5 gap-2 pt-2">
            {smcPhotos.map((photo, idx) => (
              <button
                key={photo.src}
                onClick={() => setActivePhotoIdx(idx)}
                className={`relative rounded-lg overflow-hidden aspect-video transition-all border-2 ${
                  activePhotoIdx === idx
                    ? 'border-emerald-600 shadow-sm'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={photo.src} alt={photo.title} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cutoff Countdown Banner (Clean & Non-distracting) ── */}
      {phase === 'countdown' && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/20 p-4 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Timer className="h-5 w-5 text-rose-600 flex-shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-semibold font-bengali">
                কাটঅফ সময় শেষ হতে বাকি: <span className="font-mono font-bold text-rose-700 dark:text-rose-300">{countdown.text}</span>
              </p>
              <p className="text-xs text-rose-600/80 dark:text-rose-400 font-bengali">
                রাত {`${String(cutoffTime.hour).padStart(2, '0')}:${String(cutoffTime.minute).padStart(2, '0')}`} টার পূর্বে আপনার মিল আপডেট সম্পন্ন করুন।
              </p>
            </div>
          </div>
          <div className="w-full sm:w-40 h-2 bg-rose-200 dark:bg-rose-900/50 rounded-full overflow-hidden self-center">
            <div className="h-full bg-rose-600 rounded-full transition-all duration-1000" style={{ width: `${countdown.progress}%` }} />
          </div>
        </div>
      )}

      {/* ── Locked Alert ── */}
      {phase === 'locked' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 p-4 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-slate-500" />
          <div>
            <p className="text-sm font-semibold font-bengali text-slate-800 dark:text-slate-200">🔒 মিল আপডেট বন্ধ</p>
            <p className="text-xs text-slate-500 font-bengali">কাটঅফ সময় পার হয়েছে। কোনো পরিবর্তনের প্রয়োজন হলে মিল ম্যানেজারের সাথে যোগাযোগ করুন।</p>
          </div>
        </div>
      )}

      {/* ── Tomorrow's Meal Main Card ── */}
      <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="font-bengali flex items-center gap-2.5 text-base sm:text-lg text-slate-900 dark:text-slate-100">
              <Utensils className="h-5 w-5 text-emerald-600" />
              <span>আগামীকালের মিল — {format(addDays(new Date(), 1), 'dd MMMM yyyy')}</span>
            </CardTitle>
            {cutoff ? (
              <Badge variant="destructive" className="font-bengali text-[11px] px-2.5 py-0.5 rounded-lg">কাটঅফ সম্পন্ন (লক)</Badge>
            ) : (
              <Badge variant="outline" className="font-bengali text-[11px] px-2.5 py-0.5 border-emerald-300 text-emerald-700 dark:text-emerald-400 dark:border-emerald-800 rounded-lg">
                কাটঅফ: রাত {`${String(cutoffTime.hour).padStart(2, '0')}:${String(cutoffTime.minute).padStart(2, '0')}`}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Extra Options Checklist */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-bengali font-semibold text-xs text-slate-800 dark:text-slate-200">
                🍳 Extra Option <span className="text-[11px] font-normal text-slate-500">(ঐচ্ছিক — প্রয়োজন অনুযায়ী বাছাই করুন)</span>
              </Label>
              {selectedExtras.length > 0 && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium font-bengali">
                  {selectedExtras.length}টি বাছাই করা হয়েছে
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXTRA_OPTIONS.map(o => (
                <label 
                  key={o.value} 
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedExtras.includes(o.value)
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Checkbox
                    checked={selectedExtras.includes(o.value)}
                    onCheckedChange={(checked) => toggleExtra(o.value, !!checked)}
                    disabled={cutoff}
                    className="rounded-md data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <span className="font-bengali leading-tight">{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Lunch */}
            <div
              role="button"
              tabIndex={cutoff ? -1 : 0}
              aria-pressed={todayMeal?.lunch || false}
              onClick={() => {
                if (!cutoff) handleMealRowToggle('lunch');
              }}
              onKeyDown={(e) => {
                if (cutoff) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleMealRowToggle('lunch');
                }
              }}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                todayMeal?.lunch 
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-800/80' 
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${todayMeal?.lunch ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                  <Sun className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold font-bengali text-sm sm:text-base text-slate-900 dark:text-slate-100">লাঞ্চ (দুপুর)</p>
                    <Badge variant={todayMeal?.lunch ? 'default' : 'secondary'} className={`text-[10px] font-bengali py-0 px-1.5 ${todayMeal?.lunch ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {todayMeal?.lunch ? 'চালু' : 'বন্ধ'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bengali">দুপুরের খাবার</p>
                  {!todayMeal?.lunch && todayMeal?.lunch_off_today_only && (
                    <Badge variant="outline" className="mt-1 text-[9px] font-bengali border-amber-300 text-amber-700 dark:text-amber-400 px-1.5 py-0 h-4">শুধু আগামীকালের জন্য বন্ধ</Badge>
                  )}
                  {!todayMeal?.lunch && todayMeal && !todayMeal.lunch_off_today_only && (
                    <Badge variant="outline" className="mt-1 text-[9px] font-bengali border-rose-300 text-rose-700 dark:text-rose-400 px-1.5 py-0 h-4">স্থায়ীভাবে বন্ধ</Badge>
                  )}
                </div>
              </div>
              <Switch
                checked={todayMeal?.lunch || false}
                onCheckedChange={() => handleMealRowToggle('lunch')}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 data-[state=checked]:bg-emerald-600"
                disabled={cutoff}
              />
            </div>

            {/* Dinner */}
            <div
              role="button"
              tabIndex={cutoff ? -1 : 0}
              aria-pressed={todayMeal?.dinner || false}
              onClick={() => {
                if (!cutoff) handleMealRowToggle('dinner');
              }}
              onKeyDown={(e) => {
                if (cutoff) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleMealRowToggle('dinner');
                }
              }}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                todayMeal?.dinner 
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-800/80' 
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${todayMeal?.dinner ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                  <Moon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold font-bengali text-sm sm:text-base text-slate-900 dark:text-slate-100">ডিনার (রাত)</p>
                    <Badge variant={todayMeal?.dinner ? 'default' : 'secondary'} className={`text-[10px] font-bengali py-0 px-1.5 ${todayMeal?.dinner ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      {todayMeal?.dinner ? 'চালু' : 'বন্ধ'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bengali">রাতের খাবার</p>
                  {!todayMeal?.dinner && todayMeal?.dinner_off_today_only && (
                    <Badge variant="outline" className="mt-1 text-[9px] font-bengali border-amber-300 text-amber-700 dark:text-amber-400 px-1.5 py-0 h-4">শুধু আগামীকালের জন্য বন্ধ</Badge>
                  )}
                  {!todayMeal?.dinner && todayMeal && !todayMeal.dinner_off_today_only && (
                    <Badge variant="outline" className="mt-1 text-[9px] font-bengali border-rose-300 text-rose-700 dark:text-rose-400 px-1.5 py-0 h-4">স্থায়ীভাবে বন্ধ</Badge>
                  )}
                </div>
              </div>
              <Switch
                checked={todayMeal?.dinner || false}
                onCheckedChange={() => handleMealRowToggle('dinner')}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 data-[state=checked]:bg-emerald-600"
                disabled={cutoff}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Off Mode Dialog */}
      <Dialog open={offModeDialog.open} onOpenChange={(open) => { if (!open) setOffModeDialog({ open: false, type: null }); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bengali">
              {offModeDialog.type === 'lunch' ? 'লাঞ্চ' : 'ডিনার'} বন্ধ করার ধরন
            </DialogTitle>
            <DialogDescription className="font-bengali">
              আগামীকালের {offModeDialog.type === 'lunch' ? 'লাঞ্চ' : 'ডিনার'} কীভাবে বন্ধ করতে চান?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="default"
              className="font-bengali h-auto py-3 flex-col gap-1"
              onClick={async () => {
                if (offModeDialog.type) {
                  await toggleMeal(offModeDialog.type, false, true);
                }
                setOffModeDialog({ open: false, type: null });
              }}
            >
              <span className="font-semibold">শুধু আগামীকালের জন্য বন্ধ</span>
              <span className="text-[11px] opacity-80 font-normal">পরের দিন স্বয়ংক্রিয়ভাবে চালু হয়ে যাবে</span>
            </Button>
            <Button
              variant="destructive"
              className="font-bengali h-auto py-3 flex-col gap-1"
              onClick={async () => {
                if (offModeDialog.type) {
                  await toggleMeal(offModeDialog.type, false, false);
                }
                setOffModeDialog({ open: false, type: null });
              }}
            >
              <span className="font-semibold">যতদিন না আমি চালু করি</span>
              <span className="text-[11px] opacity-80 font-normal">আমি manually আবার চালু না করা পর্যন্ত বন্ধ থাকবে</span>
            </Button>
            <Button variant="ghost" className="font-bengali" onClick={() => setOffModeDialog({ open: false, type: null })}>বাতিল</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Special Day Items */}
      <SpecialDayItems />

      {/* Extra Meal Request */}
      <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <CardTitle className="font-bengali flex items-center gap-2 text-base sm:text-lg text-slate-900 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Plus className="h-4 w-4" />
            </div>
            <span>অতিরিক্ত মিল যোগ করুন</span>
          </CardTitle>
          <p className="text-xs text-slate-500 font-bengali">Feast Day (সোম/শুক্র) তে ১ serving = ৩ মিল হিসেবে গণনা হবে।</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          
          {/* Lunch Extra Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-secondary/10 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sun className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold font-bengali text-sm">লাঞ্চ অতিরিক্ত (Lunch Extra)</p>
                {tomorrowExtraLunch && (
                  <p className="text-xs text-muted-foreground font-bengali mt-0.5">
                    মোট মিল: {tomorrowExtraLunch.quantity * tomorrowExtraLunch.meal_count_equivalent} মিল {tomorrowExtraLunch.is_feast_day ? '(Feast Day ×3)' : ''}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => handleDecTomorrowExtra('lunch')}
                disabled={!tomorrowExtraLunch || cutoff}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-bold font-bengali text-base w-6 text-center">
                {tomorrowExtraLunch?.quantity || 0}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => handleIncTomorrowExtra('lunch')}
                disabled={cutoff}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Lunch Extra Item Badges */}
          {tomorrowExtraLunch && (
            <div className="text-xs font-bengali text-muted-foreground bg-secondary/5 p-2 rounded-lg border border-dashed flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>আইটেম:</span>
                {tomorrowExtraLunch.extra_option ? (
                  (() => {
                    const items = tomorrowExtraLunch.extra_option.split(',').map((s: string) => s.trim()).filter(Boolean);
                    const counts = items.reduce((acc: Record<string, number>, v: string) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
                    return Object.entries(counts).map(([v, c]) => (
                      <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {EXTRA_LABEL_MAP[v] || v}{(c as number) > 1 ? ` × ${c}` : ''}
                      </Badge>
                    ));
                  })()
                ) : (
                  <span className="text-destructive font-semibold">কোনো আইটেম বাছাই করা হয়নি</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-primary font-bengali gap-1 hover:bg-primary/5"
                onClick={() => openEditExtraDialog(tomorrowExtraLunch)}
                disabled={cutoff}
              >
                <Edit2 className="h-3 w-3" /> আইটেম পরিবর্তন
              </Button>
            </div>
          )}

          {/* Dinner Extra Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-secondary/10 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
                <Moon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold font-bengali text-sm">ডিনার অতিরিক্ত (Dinner Extra)</p>
                {tomorrowExtraDinner && (
                  <p className="text-xs text-muted-foreground font-bengali mt-0.5">
                    মোট মিল: {tomorrowExtraDinner.quantity * tomorrowExtraDinner.meal_count_equivalent} মিল {tomorrowExtraDinner.is_feast_day ? '(Feast Day ×3)' : ''}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => handleDecTomorrowExtra('dinner')}
                disabled={!tomorrowExtraDinner || cutoff}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-bold font-bengali text-base w-6 text-center">
                {tomorrowExtraDinner?.quantity || 0}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => handleIncTomorrowExtra('dinner')}
                disabled={cutoff}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Dinner Extra Item Badges */}
          {tomorrowExtraDinner && (
            <div className="text-xs font-bengali text-muted-foreground bg-secondary/5 p-2 rounded-lg border border-dashed flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>আইটেম:</span>
                {tomorrowExtraDinner.extra_option ? (
                  (() => {
                    const items = tomorrowExtraDinner.extra_option.split(',').map((s: string) => s.trim()).filter(Boolean);
                    const counts = items.reduce((acc: Record<string, number>, v: string) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
                    return Object.entries(counts).map(([v, c]) => (
                      <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {EXTRA_LABEL_MAP[v] || v}{(c as number) > 1 ? ` × ${c}` : ''}
                      </Badge>
                    ));
                  })()
                ) : (
                  <span className="text-destructive font-semibold">কোনো আইটেম বাছাই করা হয়নি</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-primary font-bengali gap-1 hover:bg-primary/5"
                onClick={() => openEditExtraDialog(tomorrowExtraDinner)}
                disabled={cutoff}
              >
                <Edit2 className="h-3 w-3" /> আইটেম পরিবর্তন
              </Button>
            </div>
          )}

          {myExtraMeals.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="font-bengali text-xs text-muted-foreground">এই মাসের অতিরিক্ত মিলের তালিকা:</Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {myExtraMeals.map(em => (
                  <div key={em.id} className="flex justify-between items-center text-sm p-3 rounded-xl bg-secondary/35 border border-border/30 gap-2 transition-all hover:bg-secondary/50">
                    <span className="font-bengali flex-1 text-xs">
                      {em.meal_type === 'lunch' ? '🌞 লাঞ্চ' : '🌙 ডিনার'} × {em.quantity}
                      {em.is_feast_day && <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0">Feast ×3</Badge>}
                      {em.extra_option && (() => {
                        const items = em.extra_option.split(',').map((s: string) => s.trim()).filter(Boolean);
                        const counts = items.reduce((acc: Record<string, number>, v: string) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
                        const label = Object.entries(counts).map(([v, c]) => `${EXTRA_LABEL_MAP[v] || v}${(c as number) > 1 ? `×${c}` : ''}`).join(', ');
                        return <span className="ml-1 text-[10px] text-muted-foreground">[{label}]</span>;
                      })()}
                      {em.reason && <span className="text-muted-foreground ml-1 font-bengali">({em.reason})</span>}
                      <span className="text-muted-foreground ml-1 font-semibold font-bengali">= {em.quantity * em.meal_count_equivalent} মিল</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(em.meal_date), 'dd MMM')}</span>
                      {canEditExtraMeal(em.meal_date) ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditExtraDialog(em)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteExtraMeal(em.id, em.meal_date)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[9px] font-bengali py-0 px-1">লক</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vacation / Custom Off Date Range Card */}
      <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <CardTitle className="font-bengali flex items-center gap-2 text-base sm:text-lg text-slate-900 dark:text-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
            <span>ছুটি / মিল অফ ডেট রেঞ্জ</span>
          </CardTitle>
          <p className="text-xs text-slate-500 font-bengali">নির্দিষ্ট ডেট রেঞ্জের মধ্যে আপনার মিল স্বয়ংক্রিয়ভাবে বন্ধ থাকবে।</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-bengali text-xs">ছুটি শুরু</Label>
              <Input
                type="date"
                value={newOffStart}
                onChange={e => setNewOffStart(e.target.value)}
                className="font-bengali text-sm bg-background/50"
              />
            </div>
            <div>
              <Label className="font-bengali text-xs">ছুটি শেষ</Label>
              <Input
                type="date"
                value={newOffEnd}
                onChange={e => setNewOffEnd(e.target.value)}
                className="font-bengali text-sm bg-background/50"
              />
            </div>
          </div>
          <Button
            onClick={addOffPeriod}
            disabled={savingOffPeriod}
            className="w-full font-bengali gap-1 bg-gradient-to-r from-warning to-warning/80 hover:from-warning/90 hover:to-warning/70 text-black font-semibold"
          >
            {savingOffPeriod ? 'প্রসেসিং হচ্ছে...' : 'ছুটি/অফ চালু করুন'}
          </Button>

          {offPeriods.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="font-bengali text-xs text-muted-foreground">আপনার সক্রিয় ছুটিসমূহ:</Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {offPeriods.map((p: any) => {
                  const sD = new Date(p.start_date + 'T00:00:00');
                  const eD = new Date(p.end_date + 'T00:00:00');
                  const days = Math.round((eD.getTime() - sD.getTime()) / (1000 * 3600 * 24)) + 1;
                  return (
                    <div key={p.id} className="flex justify-between items-center text-sm p-3 rounded-xl bg-warning/5 border border-warning/20 gap-2 transition-all hover:bg-warning/10">
                      <span className="font-bengali flex-1 text-xs">
                        🏝️ <strong>{format(sD, 'dd MMM')}</strong> হতে <strong>{format(eD, 'dd MMM yyyy')}</strong> ({days} দিন)
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 hover:bg-destructive/15 text-destructive"
                        onClick={() => deleteOffPeriod(p.id, p.start_date, p.end_date)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Stats Metric Cards (Clean & High Contrast) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { icon: Utensils, value: monthStats.totalMeals, label: 'মোট মিল', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
          { icon: TrendingUp, value: `৳${monthStats.mealRate.toFixed(2)}`, label: 'মিল রেট', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/50' },
          { icon: Wallet, value: `৳${Math.abs(monthStats.carryForward).toFixed(0)}`, label: monthStats.carryForward > 0 ? 'আগের বকেয়া' : monthStats.carryForward < 0 ? 'আগের অতিরিক্ত' : 'আগের ব্যালেন্স', color: monthStats.carryForward > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300', bg: monthStats.carryForward > 0 ? 'bg-rose-50 dark:bg-rose-950/50' : 'bg-slate-100 dark:bg-slate-800/50' },
          { icon: Wallet, value: `৳${monthStats.totalPaid}`, label: 'জমা দিয়েছি', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
          { icon: Wallet, value: `৳${Math.abs(monthStats.totalDue).toFixed(0)}`, label: monthStats.totalDue > 0 ? 'বর্তমান বকেয়া' : 'পাবে', color: monthStats.totalDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400', bg: monthStats.totalDue > 0 ? 'bg-rose-50 dark:bg-rose-950/50' : 'bg-emerald-50 dark:bg-emerald-950/50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium font-bengali text-slate-500 dark:text-slate-400">{stat.label}</span>
              <div className={`h-7 w-7 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Meal History */}
      <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}>
            <CardTitle className="font-bengali flex items-center gap-2 text-base sm:text-lg text-slate-900 dark:text-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <History className="h-4 w-4" />
              </div>
              <span>মিল হিস্ট্রি</span>
            </CardTitle>
            <Badge variant="outline" className="font-bengali text-xs border-slate-200 dark:border-slate-700">{showHistory ? 'বন্ধ করুন' : 'দেখুন'}</Badge>
          </div>
          {showHistory && allMonths.length > 0 && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <Select value={historyMonthId} onValueChange={(v) => { setHistoryMonthId(v); fetchHistory(v); }}>
                <SelectTrigger className="w-full font-bengali text-sm">
                  <SelectValue placeholder="মাস নির্বাচন করুন" />
                </SelectTrigger>
                <SelectContent>
                  {allMonths.map((m: any) => {
                    const label = m.start_date && m.end_date
                      ? `${format(new Date(m.start_date), 'dd MMM')} — ${format(new Date(m.end_date), 'dd MMM yyyy')}`
                      : `${m.year}-${String(m.month).padStart(2, '0')}`;
                    return (
                      <SelectItem key={m.id} value={m.id} className="font-bengali">
                        {label} {m.is_active ? '(চলতি)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        {showHistory && (
          <CardContent className="animate-fade-in">
            <div className="rounded-xl border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bengali text-xs">তারিখ</TableHead>
                    <TableHead className="font-bengali text-xs text-center">বার</TableHead>
                    <TableHead className="text-center text-xs"><Sun className="h-3 w-3 mx-auto" /></TableHead>
                    <TableHead className="text-center text-xs"><Moon className="h-3 w-3 mx-auto" /></TableHead>
                    <TableHead className="font-bengali text-xs">Extra</TableHead>
                    <TableHead className="font-bengali text-xs text-center">মোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const allDates = new Set<string>();
                    historyMeals.forEach(m => allDates.add(m.meal_date));
                    historyExtras.forEach(e => allDates.add(e.meal_date));
                    const range = getMealMonthDateRange(historyStats.mealMonth, new Date());
                    const sortedDates: string[] = [];
                    let cursor = new Date(`${range.start}T00:00:00`);
                    const monthEnd = new Date(`${range.end}T00:00:00`);
                    const today = new Date(new Date().setHours(0, 0, 0, 0));
                    const tomorrow = addDays(today, 1);
                    // For past months (already ended), show full month range.
                    // For current/future months, cap at tomorrow (auto-carry creates tomorrow's row).
                    const effectiveEnd = monthEnd < today ? monthEnd : new Date(Math.min(monthEnd.getTime(), tomorrow.getTime()));
                    while (cursor <= effectiveEnd) {
                      sortedDates.push(format(cursor, 'yyyy-MM-dd'));
                      cursor = addDays(cursor, 1);
                    }
                    if (sortedDates.length === 0) sortedDates.push(...Array.from(allDates).sort());
                    const mealsByDate = new Map(historyMeals.map(m => [m.meal_date, m]));

                    if (sortedDates.length === 0 && allDates.size === 0) {
                      return (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground font-bengali py-4">এই মাসে কোনো মিল নেই</TableCell></TableRow>
                      );
                    }

                    return sortedDates.map(dateStr => {
                      const m = mealsByDate.get(dateStr) || { meal_date: dateStr, lunch: false, dinner: false, lunch_extra_option: '' };
                      const d = new Date(`${dateStr}T00:00:00`);
                      const dayIdx = getDay(d);
                      const isFeast = dayIdx === 1 || dayIdx === 5;
                      const extras = (m.lunch_extra_option || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                      const extraLabels = extras.map((v: string) => EXTRA_LABEL_MAP[v] || v);
                      const dayExtras = historyExtras.filter(e => e.meal_date === dateStr);
                      const regCount = (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0);
                      const exCount = dayExtras.reduce((a, e) => a + (Number(e.quantity) || 0) * getExtraMealEquivalent(e), 0);
                      const dayTotal = regCount + exCount;

                      return (
                        <TableRow key={dateStr} className={isFeast ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-xs py-1.5">{format(d, 'dd/MM')}</TableCell>
                          <TableCell className="text-center text-xs py-1.5 font-bengali">{DAY_NAMES_BN[dayIdx]}</TableCell>
                          <TableCell className="text-center py-1.5">
                            {m.lunch ? <span className="text-primary font-bold">✓</span> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            {m.dinner ? <span className="text-primary font-bold">✓</span> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs py-1.5">
                            {extraLabels.length > 0 && (
                              <div className="font-bengali text-[10px] text-muted-foreground">{extraLabels.join(', ')}</div>
                            )}
                            {dayExtras.map(de => {
                              const equiv = getExtraMealEquivalent(de);
                              const qty = Number(de.quantity) || 0;
                              return (
                                <Badge key={dateStr + de.meal_type} variant="secondary" className="text-[10px] mr-1 mt-0.5">
                                  {de.meal_type === 'lunch' ? 'L' : 'D'}+{qty}{equiv !== 1 ? `×${equiv}` : ''}={qty * equiv}
                                </Badge>
                              );
                            })}
                          </TableCell>
                          <TableCell className="text-center py-1.5">
                            <Badge variant={isFeast ? 'destructive' : 'outline'} className="text-[10px] font-bold">{dayTotal}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
            {/* Month Total Summary */}
            {(() => {
              const regTotal = historyMeals.reduce((a, m) => a + (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0), 0);
              const exTotal = historyExtras.reduce((a, e) => a + (Number(e.quantity) || 0) * getExtraMealEquivalent(e), 0);
              let grand = regTotal + exTotal;
              if (historyStats.mealCountOverride !== null) grand = historyStats.mealCountOverride;
              const effective = historyStats.minMeals > 0 && grand < historyStats.minMeals ? historyStats.minMeals : grand;
              const rate = historyStats.rate;
              const cost = effective * rate + historyStats.extraCharge;
              const carry = historyStats.carryForward;
              const paid = historyStats.paid;
              const due = cost + carry - paid;
              return (
                <div className="mt-3 space-y-2">
                  <div className="p-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div><p className="text-[10px] text-muted-foreground font-bengali">রেগুলার মিল</p><p className="font-bold text-primary">{regTotal}</p></div>
                    <div><p className="text-[10px] text-muted-foreground font-bengali">এক্সট্রা মিল</p><p className="font-bold text-accent-foreground">{exTotal}</p></div>
                    <div><p className="text-[10px] text-muted-foreground font-bengali">মোট মিল</p><p className="font-bold text-lg text-primary">{effective}{historyStats.mealCountOverride !== null && <span className="text-[9px] text-info ml-1">(এডমিন)</span>}</p></div>
                    <div><p className="text-[10px] text-muted-foreground font-bengali">মিল রেট</p><p className="font-bold text-info">৳{rate.toFixed(2)}</p></div>
                  </div>
                  <div className="p-3 rounded-xl border border-accent/30 bg-gradient-to-r from-accent/5 to-primary/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div><p className="text-[10px] text-muted-foreground font-bengali">মোট খরচ{historyStats.extraCharge > 0 && <span className="text-[9px] text-accent-foreground"> (+৳{historyStats.extraCharge})</span>}</p><p className="font-bold text-destructive">৳{cost.toFixed(0)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground font-bengali">{carry > 0 ? 'আগের বকেয়া' : carry < 0 ? 'আগের অতিরিক্ত' : 'আগের ব্যালেন্স'}</p><p className={`font-bold ${carry > 0 ? 'text-destructive' : 'text-primary'}`}>৳{Math.abs(carry).toFixed(0)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground font-bengali">জমা দিয়েছি</p><p className="font-bold text-primary">৳{paid.toFixed(0)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground font-bengali">{due > 0 ? 'বকেয়া' : 'পাবে'}</p><p className={`font-bold text-lg ${due > 0 ? 'text-destructive' : 'text-primary'}`}>৳{Math.abs(due).toFixed(0)}</p></div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        )}
      </Card>

      {/* Extra Item Selection Dialog */}
      <Dialog open={showExtraItemDialog} onOpenChange={(open) => { setShowExtraItemDialog(open); if (!open) setEditingExtraMealId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bengali">🍳 {editingExtraMealId ? 'এক্সট্রা মিল এডিট' : 'এক্সট্রা মিলের আইটেম বাছুন'}</DialogTitle>
            <DialogDescription className="font-bengali text-xs">
              এক্সট্রা {extraMealType === 'lunch' ? 'লাঞ্চ' : 'ডিনার'} × {extraQuantity} serving — ঠিক {parseInt(extraQuantity) || 0}টি আইটেম বাছুন
            </DialogDescription>
          </DialogHeader>
          {editingExtraMealId && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-bengali text-xs">ধরন</Label>
                <Select value={extraMealType} onValueChange={setExtraMealType}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lunch">লাঞ্চ</SelectItem>
                    <SelectItem value="dinner">ডিনার</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-bengali text-xs">কয়টি</Label>
                <Input type="number" min="1" max="10" value={extraQuantity} onChange={e => setExtraQuantity(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            {EXTRA_OPTIONS.map(o => {
              const count = pendingExtraOption.filter(v => v === o.value).length;
              return (
                <div key={o.value} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${count > 0 ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:border-accent/20 hover:bg-accent/10'}`}>
                  <span className="font-bengali text-sm">{o.label}</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => decExtraItem(o.value)} disabled={count === 0}>−</Button>
                    <span className="w-6 text-center font-bold text-sm">{count}</span>
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => incExtraItem(o.value)}>+</Button>
                  </div>
                </div>
              );
            })}
          </div>
          {(() => {
            const qty = parseInt(extraQuantity) || 0;
            const sel = pendingExtraOption.length;
            const match = sel === qty;
            return (
              <div className={`text-xs font-bengali p-2 rounded-md border ${match ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-destructive/5 border-destructive/30 text-destructive'}`}>
                নির্বাচিত: {sel}টি / প্রয়োজন: {qty}টি {match ? '✓' : '✗'}
              </div>
            );
          })()}
          {pendingExtraOption.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {EXTRA_OPTIONS.filter(o => pendingExtraOption.includes(o.value)).map(o => {
                const count = pendingExtraOption.filter(v => v === o.value).length;
                return <Badge key={o.value} className="font-bengali text-xs bg-accent/15 text-accent-foreground border-accent/30">{o.label} × {count}</Badge>;
              })}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 font-bengali" onClick={() => { setShowExtraItemDialog(false); setEditingExtraMealId(null); }}>বাতিল</Button>
            <Button className="flex-1 font-bengali bg-gradient-to-r from-primary to-primary/80" onClick={confirmAddExtraMeal}>
              <Check className="h-4 w-4 mr-1" /> {editingExtraMealId ? 'আপডেট' : 'নিশ্চিত'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

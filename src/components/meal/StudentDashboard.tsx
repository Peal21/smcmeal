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
import { notifyUpdate } from '@/lib/notify';
import { format, addDays, isAfter, set, getDay } from 'date-fns';
import { Sun, Moon, Utensils, Wallet, TrendingUp, Clock, Plus, Trash2, Edit2, Check, X, AlertTriangle, ShieldAlert, Phone, History, Timer } from 'lucide-react';
import { fetchResolvedMealMonth, getMealMonthDateRange } from '@/lib/mealMonth';
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
  const { user, isManager, isAdmin } = useAuth();
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
    const extraMealCount = (extraRes.data || []).reduce((a, e) => a + e.quantity * e.meal_count_equivalent, 0);
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

    if (editingExtraMealId) {
      const { error } = await supabase.from('extra_meals').update({
        meal_type: extraMealType,
        quantity: qty,
        reason: extraReason || null,
        extra_option: extraOptionStr,
      } as any).eq('id', editingExtraMealId);
      if (error) { toast.error(error.message); return; }
      playSuccessSound();
      notify('আপডেট হয়েছে');
    } else {
      const mealDateObj = new Date(mealDate);
      const dayOfWeek = mealDateObj.getDay();
      const isFeast = dayOfWeek === 1 || dayOfWeek === 5;
      const mealCountEquivalent = isFeast ? 3 : 1;

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
      notify(`${qty}টি অতিরিক্ত ${extraMealType === 'lunch' ? 'লাঞ্চ' : 'ডিনার'} যোগ হয়েছে${isFeast ? ' (Feast Day — ১টি = ৩ মিল)' : ''}`);
      setExtraQuantity('0');
      setExtraReason('');
    }
    setShowExtraItemDialog(false);
    setPendingExtraOption([]);
    setEditingExtraMealId(null);
  };

  const deleteExtraMeal = async (id: string, mealDateStr: string) => {
    if (!canEditExtraMeal(mealDateStr)) { toast.error('এই দিনের Extra মিল আর পরিবর্তন করা যাবে না (রাত ১০:০০ পার)'); return; }
    const { error } = await supabase.from('extra_meals').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      playToggleOffSound();
      notify('অতিরিক্ত মিল মুছে ফেলা হয়েছে');
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
    <div className="space-y-5 page-enter stagger-children">
      {/* 🔥 Big Cyberpunk Countdown: 9:00 PM - 10:00 PM */}
      {phase === 'countdown' && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-destructive via-destructive/90 to-accent p-6 text-white timer-glow animate-scale-in border border-destructive/30 shadow-lg shadow-destructive/20">
          <div className="absolute inset-0 bg-mesh opacity-20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%', animation: 'shimmer 2.5s ease-in-out infinite' }} />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 animate-pulse">
              <Timer className="h-4 w-4" />
              <span className="text-[11px] font-extrabold font-bengali tracking-widest uppercase">⚡ দুরুতো meal update দিন!</span>
            </div>
            <div className="text-5xl sm:text-6xl font-extrabold tabular-nums tracking-tight drop-shadow-lg neon-glow animate-pulse-ring" style={{ fontFamily: 'Outfit, Inter, sans-serif' }}>
              {countdown.text}
            </div>
            <p className="text-xs font-bengali opacity-90 font-medium">{`${String(cutoffTime.hour).padStart(2, '0')}:${String(cutoffTime.minute).padStart(2, '0')}`} এর মধ্যে meal update শেষ করুন</p>
            {/* Progress bar */}
            <div className="w-full max-w-xs mt-1">
              <div className="h-2 rounded-full bg-white/25 overflow-hidden shadow-inner border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent via-white to-white transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  style={{ width: `${countdown.progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] mt-1.5 opacity-80 font-bengali font-medium">
                <span>{`${String(cutoffTime.hour - 1).padStart(2, '0')}:${String(cutoffTime.minute).padStart(2, '0')}`} PM</span>
                <span>{`${String(cutoffTime.hour).padStart(2, '0')}:${String(cutoffTime.minute).padStart(2, '0')}`} PM</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Locked Alert: After 10:00 PM */}
      {phase === 'locked' && (
        <div className="rounded-2xl bg-gradient-to-r from-destructive/15 to-destructive/5 border border-destructive/30 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/20">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-bold font-bengali text-destructive">🔒 মিল আপডেট বন্ধ</p>
              <p className="text-sm font-bengali text-muted-foreground">কাটঅফ টাইম পার হয়ে গেছে। পরিবর্তনের জন্য মিল ম্যানেজারকে বলুন।</p>
            </div>
          </div>
        </div>
      )}

      {/* Tomorrow's Meal Card */}
      <Card className={`overflow-hidden transition-all duration-500 border border-border/40 bg-card/70 backdrop-blur-md rounded-2xl shadow-xl shadow-primary/5 ${phase === 'countdown' ? 'border-destructive/40 ring-1 ring-destructive/20 shadow-destructive/10' : 'card-hover'}`}>
        <CardHeader className="bg-gradient-to-r from-primary/5 via-info/5 to-transparent pb-4 border-b border-border/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="font-bengali flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/20 text-primary">
                <Utensils className="h-4 w-4" />
              </div>
              <span>আগামীকালের মিল — {format(addDays(new Date(), 1), 'dd MMMM yyyy')}</span>
            </CardTitle>
            {cutoff ? (
              <Badge variant="destructive" className="font-bengali text-[10px] px-2 py-0.5 animate-pulse rounded-lg">কাটঅফ সম্পন্ন (লক)</Badge>
            ) : (
              <Badge variant="outline" className="font-bengali text-[10px] px-2 py-0.5 border-primary/30 text-primary rounded-lg">কাটঅফ সময়: রাত {`${String(cutoffTime.hour).padStart(2, '0')}:${String(cutoffTime.minute).padStart(2, '0')}`}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {/* Extra Options Checklist */}
          <div className="p-4 rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 via-transparent to-transparent space-y-3">
            <Label className="font-bengali font-semibold text-xs text-accent-foreground flex items-center gap-2">
              🍳 Extra Option <span className="text-[10px] font-normal text-muted-foreground">(ঐচ্ছিক — প্রয়োজন অনুযায়ী বাছাই করুন)</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {EXTRA_OPTIONS.map(o => (
                <label 
                  key={o.value} 
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all duration-300 ${
                    selectedExtras.includes(o.value)
                      ? 'bg-accent/10 border-accent/40 text-accent-foreground shadow-sm shadow-accent/5'
                      : 'bg-background/40 border-transparent hover:border-accent/20 hover:bg-accent/5 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Checkbox
                    checked={selectedExtras.includes(o.value)}
                    onCheckedChange={(checked) => toggleExtra(o.value, !!checked)}
                    disabled={cutoff}
                    className="rounded-md border-muted-foreground/30 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                  />
                  <span className="font-bengali leading-tight">{o.label}</span>
                </label>
              ))}
            </div>
            {selectedExtras.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-accent/10">
                {selectedExtras.map(v => {
                  const opt = EXTRA_OPTIONS.find(o => o.value === v);
                  return <Badge key={v} className="font-bengali text-[10px] bg-accent/20 text-accent-foreground border-0 hover:bg-accent/30">{opt?.label}</Badge>;
                })}
              </div>
            )}
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
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 hover:scale-[1.02] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                todayMeal?.lunch 
                  ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 shadow-md shadow-primary/5' 
                  : 'bg-card/50 border-border/50 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${todayMeal?.lunch ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Sun className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold font-bengali text-sm sm:text-base">লাঞ্চ (দুপুর)</p>
                  <p className="text-[11px] text-muted-foreground font-bengali">দুপুরের খাবার</p>
                  {!todayMeal?.lunch && todayMeal?.lunch_off_today_only && (
                    <Badge variant="outline" className="mt-1 text-[9px] font-bengali border-accent/40 text-accent px-1.5 py-0 h-4">শুধু আগামীকালের জন্য বন্ধ</Badge>
                  )}
                  {!todayMeal?.lunch && todayMeal && !todayMeal.lunch_off_today_only && (
                    <Badge variant="outline" className="mt-1 text-[9px] font-bengali border-destructive/40 text-destructive px-1.5 py-0 h-4">স্থায়ীভাবে বন্ধ</Badge>
                  )}
                </div>
              </div>
              <Switch
                checked={todayMeal?.lunch || false}
                onCheckedChange={() => handleMealRowToggle('lunch')}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 data-[state=checked]:bg-primary"
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
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 hover:scale-[1.02] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                todayMeal?.dinner 
                  ? 'bg-gradient-to-br from-info/10 via-info/5 to-transparent border-info/30 shadow-md shadow-info/5' 
                  : 'bg-card/50 border-border/50 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${todayMeal?.dinner ? 'bg-info/20 text-info' : 'bg-muted text-muted-foreground'}`}>
                  <Moon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold font-bengali text-sm sm:text-base">ডিনার (রাত)</p>
                  <p className="text-[11px] text-muted-foreground font-bengali">রাতের খাবার</p>
                  {!todayMeal?.dinner && todayMeal?.dinner_off_today_only && (
                    <Badge variant="outline" className="mt-1 text-[9px] font-bengali border-info/40 text-info px-1.5 py-0 h-4">শুধু আগামীকালের জন্য বন্ধ</Badge>
                  )}
                  {!todayMeal?.dinner && todayMeal && !todayMeal.dinner_off_today_only && (
                    <Badge variant="outline" className="mt-1 text-[9px] font-bengali border-destructive/40 text-destructive px-1.5 py-0 h-4">স্থায়ীভাবে বন্ধ</Badge>
                  )}
                </div>
              </div>
              <Switch
                checked={todayMeal?.dinner || false}
                onCheckedChange={() => handleMealRowToggle('dinner')}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 data-[state=checked]:bg-info"
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
      <Card className="card-hover card-shine overflow-hidden border border-border/40">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-3">
          <CardTitle className="font-bengali flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            অতিরিক্ত মিল যোগ করুন
          </CardTitle>
          <p className="text-xs text-muted-foreground font-bengali">Feast Day (সোম/শুক্র) তে ১ serving = ৩ মিল হিসেবে গণনা হবে।</p>
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
      <Card className="card-hover card-shine overflow-hidden border border-border/40">
        <CardHeader className="bg-gradient-to-r from-warning/10 via-transparent to-transparent pb-3">
          <CardTitle className="font-bengali flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/20">
              <Clock className="h-4 w-4 text-warning" />
            </div>
            ছুটি / মিল অফ ডেট রেঞ্জ
          </CardTitle>
          <p className="text-xs text-muted-foreground font-bengali">নির্দিষ্ট ডেট রেঞ্জের মধ্যে আপনার মিল স্বয়ংক্রিয়ভাবে বন্ধ থাকবে।</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {[
          { icon: Utensils, value: monthStats.totalMeals, label: 'মোট মিল', bgCls: 'bg-primary/10 border-primary/20 text-primary', iconCls: 'text-primary', valueCls: 'text-primary' },
          { icon: TrendingUp, value: `৳${monthStats.mealRate.toFixed(2)}`, label: 'মিল রেট', bgCls: 'bg-info/10 border-info/20 text-info', iconCls: 'text-info', valueCls: 'text-info' },
          { icon: Wallet, value: `৳${Math.abs(monthStats.carryForward).toFixed(0)}`, label: monthStats.carryForward > 0 ? 'আগের বকেয়া' : monthStats.carryForward < 0 ? 'আগের অতিরিক্ত' : 'আগের ব্যালেন্স', bgCls: monthStats.carryForward > 0 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-primary/10 border-primary/20 text-primary', iconCls: monthStats.carryForward > 0 ? 'text-destructive' : 'text-primary', valueCls: monthStats.carryForward > 0 ? 'text-destructive' : 'text-primary' },
          { icon: Wallet, value: `৳${monthStats.totalPaid}`, label: 'জমা দিয়েছি', bgCls: 'bg-primary/10 border-primary/20 text-primary', iconCls: 'text-primary', valueCls: 'text-primary' },
          { icon: Wallet, value: `৳${Math.abs(monthStats.totalDue).toFixed(0)}`, label: monthStats.totalDue > 0 ? 'বকেয়া' : 'পাবে', bgCls: monthStats.totalDue > 0 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-primary/10 border-primary/20 text-primary', iconCls: monthStats.totalDue > 0 ? 'text-destructive' : 'text-primary', valueCls: monthStats.totalDue > 0 ? 'text-destructive' : 'text-primary' },
        ].map((stat, i) => (
          <Card key={i} className="card-hover card-shine border border-border/40 bg-card/60 backdrop-blur-md overflow-hidden group rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="pt-6 pb-5 text-center flex flex-col items-center justify-center">
              <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-500 group-hover:scale-110 group-hover:shadow-md ${stat.bgCls}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconCls} transition-transform duration-300 group-hover:scale-110`} />
              </div>
              <p className={`text-xl sm:text-2xl font-extrabold stat-number ${stat.valueCls}`} style={{ animationDelay: `${i * 0.08}s` }}>{stat.value}</p>
              <p className="text-[11px] text-muted-foreground font-bengali mt-2 font-medium">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meal History */}
      <Card className="card-hover card-shine overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}>
            <CardTitle className="font-bengali flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <History className="h-4 w-4 text-primary" />
              </div>
              মিল হিস্ট্রি
            </CardTitle>
            <Badge variant="outline" className="font-bengali text-xs">{showHistory ? 'বন্ধ করুন' : 'দেখুন'}</Badge>
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
                      const d = new Date(dateStr);
                      const dayIdx = getDay(d);
                      const isFeast = dayIdx === 1 || dayIdx === 5;
                      const extras = (m.lunch_extra_option || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                      const extraLabels = extras.map((v: string) => EXTRA_LABEL_MAP[v] || v);
                      const dayExtras = historyExtras.filter(e => e.meal_date === dateStr);
                      const regCount = (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0);
                      const exCount = dayExtras.reduce((a, e) => a + Number(e.quantity) * Number(e.meal_count_equivalent), 0);
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
                            {dayExtras.map(de => (
                              <Badge key={dateStr + de.meal_type} variant="secondary" className="text-[10px] mr-1 mt-0.5">
                                {de.meal_type === 'lunch' ? 'L' : 'D'}+{de.quantity}{Number(de.meal_count_equivalent) !== 1 ? `×${de.meal_count_equivalent}` : ''}={Number(de.quantity) * Number(de.meal_count_equivalent)}
                              </Badge>
                            ))}
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
              const exTotal = historyExtras.reduce((a, e) => a + Number(e.quantity) * Number(e.meal_count_equivalent), 0);
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

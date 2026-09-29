import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings, Calculator, UserCheck, ShieldCheck, UserPlus, Send, ArrowRightCircle, CalendarDays, Save, History, Plus, Clock, X, Bot, Copy, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { getMealMonthDateRange } from '@/lib/mealMonth';
import { sortByRoll } from '@/lib/sortMembers';
import { getExtraMealEquivalent } from '@/lib/feastDay';

const MONTH_QUERY_LIMIT = 10000;

type MealMonthRecord = {
  id: string;
  month: number;
  year: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  meal_rate: number | null;
  total_expense: number | null;
  extra_charge: number;
  min_meals?: number | null;
  manager_user_id: string | null;
  created_at: string;
};

export default function MonthSettings() {
  const { user, isManager, isAdmin, isHistoricalManager } = useAuth();
  const isOnlyHistoricalManager = isHistoricalManager && !isManager && !isAdmin;
  const [allMonths, setAllMonths] = useState<MealMonthRecord[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [manualMealRate, setManualMealRate] = useState('');
  const [extraCharge, setExtraCharge] = useState('');
  const [minMeals, setMinMeals] = useState('');
  const [totalExpense, setTotalExpense] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalMeals, setTotalMeals] = useState(0);
  const [members, setMembers] = useState<any[]>([]);
  const [nextManager, setNextManager] = useState('');
  const [adminPortalPassword, setAdminPortalPassword] = useState('');
  const [adminPortalPasswordConfirm, setAdminPortalPasswordConfirm] = useState('');
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [cutoffHour, setCutoffHour] = useState(22);
  const [cutoffMinute, setCutoffMinute] = useState(0);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [telegramScheduleTimes, setTelegramScheduleTimes] = useState<string[]>([]);
  const [newScheduleTime, setNewScheduleTime] = useState('21:00');
  const [webhookConnecting, setWebhookConnecting] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [testingBot, setTestingBot] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [newMonthStart, setNewMonthStart] = useState('');
  const [newMonthEnd, setNewMonthEnd] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [showNewMonthForm, setShowNewMonthForm] = useState(false);
  const [newMonthFormStart, setNewMonthFormStart] = useState('');
  const [newMonthFormEnd, setNewMonthFormEnd] = useState('');
  const now = new Date();

  const fetchAllMonths = useCallback(async () => {
    let query = supabase.from('meal_months').select('*');
    if (isOnlyHistoricalManager) {
      query = query.eq('manager_user_id', user?.id);
    }
    const { data } = await query.order('created_at', { ascending: false });
    const months = (data || []) as MealMonthRecord[];
    setAllMonths(months);

    // Auto-select active month or first
    if (!selectedMonthId || !months.find(m => m.id === selectedMonthId)) {
      const active = months.find(m => m.is_active) || months[0];
      if (active) setSelectedMonthId(active.id);
    }
    return months;
  }, [selectedMonthId, isOnlyHistoricalManager, user]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('user_id, full_name, roll_number').eq('is_active', true).order('full_name');
    setMembers(sortByRoll(data || []));
  }, []);

  const fetchAppSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings' as any).select('signup_enabled, telegram_chat_id, telegram_enabled, meal_cutoff_hour, meal_cutoff_minute, telegram_schedule_times').eq('id', 1).single();
    if (data) {
      setSignupEnabled((data as any).signup_enabled);
      setTelegramChatId((data as any).telegram_chat_id || '');
      setTelegramEnabled((data as any).telegram_enabled ?? true);
      setCutoffHour((data as any).meal_cutoff_hour ?? 22);
      setCutoffMinute((data as any).meal_cutoff_minute ?? 0);
      setTelegramScheduleTimes((data as any).telegram_schedule_times || ['21:00', '21:30', '21:55']);
    }
  }, []);

  useEffect(() => {
    fetchAllMonths();
    fetchMembers();
    fetchAppSettings();
  }, []);

  // When selected month changes, load its data
  const selectedMonth = allMonths.find(m => m.id === selectedMonthId) || null;

  useEffect(() => {
    if (selectedMonth) {
      setManualMealRate(String(selectedMonth.meal_rate || ''));
      setExtraCharge(String(selectedMonth.extra_charge || ''));
      setMinMeals(String((selectedMonth as any).min_meals || ''));
      setTotalExpense(String(selectedMonth.total_expense || ''));
      setStartDate(selectedMonth.start_date || '');
      setEndDate(selectedMonth.end_date || '');
      fetchMonthMealCount(selectedMonth);
    }
  }, [selectedMonthId, allMonths]);

  const fetchMonthMealCount = async (month: MealMonthRecord) => {
    const { start: sd, end: ed } = getMealMonthDateRange(month, now);
    const [mealsRes, extraRes] = await Promise.all([
      supabase.from('daily_meals').select('lunch, dinner, lunch_extra_option, meal_date').gte('meal_date', sd).lte('meal_date', ed).limit(MONTH_QUERY_LIMIT),
      supabase.from('extra_meals').select('quantity, meal_count_equivalent').gte('meal_date', sd).lte('meal_date', ed).limit(MONTH_QUERY_LIMIT),
    ]);

    const regularMeals = (mealsRes.data || []).reduce((a, m) => {
      return a + (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0);
    }, 0);
    const extraMeals = (extraRes.data || []).reduce((a, e) => a + (Number(e.quantity) || 0) * getExtraMealEquivalent(e), 0);
    setTotalMeals(regularMeals + extraMeals);
  };

  const saveMonthSettings = async () => {
    if (!user || !selectedMonth) return;
    if (startDate && endDate && startDate > endDate) {
      toast.error('শুরুর তারিখ শেষের তারিখের চেয়ে পরে হতে পারে না!');
      return;
    }
    const expense = parseFloat(totalExpense) || 0;
    const manualRate = parseFloat(manualMealRate) || 0;
    const rate = manualRate > 0 ? manualRate : (totalMeals > 0 ? expense / totalMeals : 0);
    const charge = parseFloat(extraCharge) || 0;
    const minM = parseFloat(minMeals) || 0;

    const { error } = await supabase.from('meal_months').update({
      total_expense: expense,
      meal_rate: rate,
      extra_charge: charge,
      min_meals: minM,
      start_date: startDate || null,
      end_date: endDate || null,
    } as any).eq('id', selectedMonth.id);

    if (error) { toast.error(error.message); return; }
    toast.success('মাসের সেটিংস আপডেট হয়েছে');
    fetchAllMonths();
  };

  // Create a brand new month
  const createNewMonth = async () => {
    if (!user || !newMonthFormStart || !newMonthFormEnd) return;
    if (newMonthFormStart && newMonthFormEnd && newMonthFormStart > newMonthFormEnd) {
      toast.error('শুরুর তারিখ শেষের তারিখের চেয়ে পরে হতে পারে না!');
      return;
    }
    const parsedStart = new Date(newMonthFormStart);

    // Deactivate all
    await supabase.from('meal_months').update({ is_active: false } as any).eq('is_active', true);

    const { data: newMonth, error } = await supabase.from('meal_months').insert({
      month: parsedStart.getMonth() + 1,
      year: parsedStart.getFullYear(),
      total_expense: 0,
      meal_rate: 0,
      extra_charge: 0,
      is_active: true,
      manager_user_id: user.id,
      start_date: newMonthFormStart,
      end_date: newMonthFormEnd,
    } as any).select().single();

    if (error) { toast.error(error.message); return; }
    toast.success('নতুন মাস তৈরি হয়েছে');
    setShowNewMonthForm(false);
    setNewMonthFormStart('');
    setNewMonthFormEnd('');
    const months = await fetchAllMonths();
    if (newMonth) setSelectedMonthId((newMonth as any).id);
  };

  // Finalize selected month: calculate carry-forward and create/update next month
  const finalizeMonth = async () => {
    if (!user || !selectedMonth) return;
    setFinalizing(true);

    try {
      const currentRate = Number(selectedMonth.meal_rate) || 0;
      const currentExtraCharge = Number(selectedMonth.extra_charge ?? 0);

      if (currentRate <= 0) {
        toast.error('আগে মিল রেট সেট করুন!');
        setFinalizing(false);
        return;
      }

      const { start: sd, end: ed } = getMealMonthDateRange(selectedMonth, now);

      const [membersRes, mealsRes, extraRes, paymentsRes, prevBalRes] = await Promise.all([
        supabase.from('profiles').select('user_id').eq('is_active', true),
        supabase.from('daily_meals').select('user_id, lunch, dinner').gte('meal_date', sd).lte('meal_date', ed).limit(MONTH_QUERY_LIMIT),
        supabase.from('extra_meals').select('user_id, quantity, meal_count_equivalent').gte('meal_date', sd).lte('meal_date', ed).limit(MONTH_QUERY_LIMIT),
        supabase.from('payments').select('user_id, amount').eq('month_id', selectedMonth.id),
        supabase.from('member_balances').select('user_id, carry_forward').eq('month_id', selectedMonth.id),
      ]);

      const activeUsers = (membersRes.data || []).map(m => m.user_id);

      // Per-user meals
      const userMealMap = new Map<string, number>();
      (mealsRes.data || []).forEach(m => {
        const count = (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0);
        userMealMap.set(m.user_id, (userMealMap.get(m.user_id) || 0) + count);
      });
      (extraRes.data || []).forEach(e => {
        userMealMap.set(e.user_id, (userMealMap.get(e.user_id) || 0) + (Number(e.quantity) || 0) * getExtraMealEquivalent(e));
      });

      // Per-user payments
      const userPaidMap = new Map<string, number>();
      (paymentsRes.data || []).forEach(p => {
        userPaidMap.set(p.user_id, (userPaidMap.get(p.user_id) || 0) + Number(p.amount));
      });

      // Previous carry
      const prevCarryMap = new Map<string, number>();
      (prevBalRes.data || []).forEach(b => {
        prevCarryMap.set(b.user_id, Number(b.carry_forward));
      });

      // Find or create next month
      let nextMonthId: string;
      const nextMonthRecord = allMonths.find(m => m.id !== selectedMonth.id && m.is_active);

      if (nextMonthRecord) {
        nextMonthId = nextMonthRecord.id;
      } else if (newMonthStart && newMonthEnd) {
        // Create next month
        const parsedStart = new Date(newMonthStart);
        await supabase.from('meal_months').update({ is_active: false } as any).eq('is_active', true);

        const { data: newMonth, error } = await supabase.from('meal_months').insert({
          month: parsedStart.getMonth() + 1,
          year: parsedStart.getFullYear(),
          total_expense: 0,
          meal_rate: 0,
          extra_charge: 0,
          is_active: true,
          manager_user_id: user.id,
          start_date: newMonthStart,
          end_date: newMonthEnd,
        } as any).select().single();

        if (error || !newMonth) {
          toast.error('নতুন মাস তৈরি ব্যর্থ: ' + (error?.message || ''));
          setFinalizing(false);
          return;
        }
        nextMonthId = (newMonth as any).id;
      } else {
        toast.error('নতুন মাসের তারিখ দিন!');
        setFinalizing(false);
        return;
      }

      // Mark finalized month as inactive
      await supabase.from('meal_months').update({ is_active: false } as any).eq('id', selectedMonth.id);

      // Calculate carry-forward
      const currentMinMeals = Number((selectedMonth as any).min_meals ?? 0);
      const balanceRows = activeUsers.map(userId => {
        const rawMeals = userMealMap.get(userId) || 0;
        const meals = currentMinMeals > 0 && rawMeals < currentMinMeals ? currentMinMeals : rawMeals;
        const cost = meals * currentRate + currentExtraCharge;
        const prevCarry = prevCarryMap.get(userId) || 0;
        const totalDue = cost + prevCarry;
        const paid = userPaidMap.get(userId) || 0;
        const balance = paid - totalDue; // positive = overpaid

        return {
          user_id: userId,
          month_id: nextMonthId,
          carry_forward: -balance, // positive = user owes money
          total_meals: 0,
          total_paid: 0,
          total_amount: 0,
        };
      });

      if (balanceRows.length > 0) {
        const { error: balError } = await supabase.from('member_balances').upsert(
          balanceRows as any,
          { onConflict: 'user_id,month_id' }
        );
        if (balError) toast.error('ক্যারি ফরওয়ার্ড সেভ ব্যর্থ: ' + balError.message);
      }

      toast.success('মাস শেষ হয়েছে! ক্যারি ফরওয়ার্ড নতুন মাসে যুক্ত হয়েছে।');
      setShowFinalizeDialog(false);
      const months = await fetchAllMonths();
      setSelectedMonthId(nextMonthId);
    } catch (err: any) {
      toast.error(err.message || 'ত্রুটি হয়েছে');
    } finally {
      setFinalizing(false);
    }
  };

  const assignNextManager = async () => {
    if (!nextManager) return;
    const { error: deleteErr } = await supabase.from('user_roles').delete().eq('role', 'meal_manager');
    if (deleteErr) { toast.error('পুরোনো ম্যানেজার সরাতে ব্যর্থ: ' + deleteErr.message); return; }

    const { error: insertErr } = await supabase.from('user_roles').insert({ user_id: nextManager, role: 'meal_manager' as any });
    if (insertErr) { toast.error('নতুন ম্যানেজার নির্ধারণ ব্যর্থ: ' + insertErr.message); return; }

    toast.success('নতুন ম্যানেজার নির্ধারণ হয়েছে');
  };

  const saveTelegramSettings = async () => {
    const { error } = await supabase.from('app_settings' as any).update({ 
      telegram_chat_id: telegramChatId || null, 
      telegram_schedule_times: telegramScheduleTimes,
      updated_at: new Date().toISOString(), 
      updated_by: user?.id 
    } as any).eq('id', 1);
    if (error) toast.error(error.message);
    else toast.success('Telegram সেটিংস সেভ হয়েছে');
  };

  const addScheduleTime = () => {
    if (!newScheduleTime) return;
    if (telegramScheduleTimes.includes(newScheduleTime)) {
      toast.error('এই সময়টি ইতিমধ্যে যুক্ত আছে');
      return;
    }
    const updated = [...telegramScheduleTimes, newScheduleTime].sort();
    setTelegramScheduleTimes(updated);
  };

  const removeScheduleTime = (timeToRemove: string) => {
    const updated = telegramScheduleTimes.filter(t => t !== timeToRemove);
    setTelegramScheduleTimes(updated);
  };

  const toggleTelegramEnabled = async (val: boolean) => {
    setTelegramEnabled(val);
    const { error } = await supabase.from('app_settings' as any).update({ telegram_enabled: val, updated_at: new Date().toISOString(), updated_by: user?.id } as any).eq('id', 1);
    if (error) {
      toast.error(error.message);
      setTelegramEnabled(!val);
    } else {
      toast.success(val ? 'Telegram বট চালু হয়েছে' : 'Telegram বট বন্ধ হয়েছে');
    }
  };

  const handleSetWebhook = async () => {
    setWebhookConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-bot-webhook', {
        body: { action: 'set_webhook' }
      });
      if (error) throw error;
      if (data?.telegram_response?.ok) {
        toast.success('Telegram Webhook সফলভাবে কানেক্ট করা হয়েছে! এখন গ্রুপ মেসেজ কাজ করবে।');
        setWebhookStatus(data);
      } else {
        toast.error('Webhook সেট ব্যর্থ: ' + (data?.telegram_response?.description || JSON.stringify(data)));
      }
    } catch (err: any) {
      console.error('Webhook set error:', err);
      toast.error('সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setWebhookConnecting(false);
    }
  };

  const handleCheckWebhook = async () => {
    setWebhookConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-bot-webhook', {
        body: { action: 'get_webhook_info' }
      });
      if (error) throw error;
      const info = data?.webhook_info?.result;
      setWebhookStatus(info);
      if (info?.url) {
        toast.success(`Webhook সক্রিয় আছে: ${info.url}`);
      } else {
        toast.info('এখনো কোনো Webhook সেট করা নেই। "Webhook কানেক্ট করুন" চাপুন।');
      }
    } catch (err: any) {
      console.error('Check webhook error:', err);
      toast.error('চেক ব্যর্থ: ' + (err.message || 'Unknown error'));
    } finally {
      setWebhookConnecting(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!telegramChatId) {
      toast.error('প্রথমে Telegram Group Chat ID সেভ করুন');
      return;
    }
    setTestingBot(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-bot-webhook', {
        body: { 
          action: 'send_test', 
          chat_id: telegramChatId, 
          text: '🤖 <b>Satkhira Meal Mate</b>: Telegram Bot সফলভাবে টেস্ট সম্পন্ন হয়েছে!\nএখন গ্রুপে <code>roll 25 L on D off extra goru</code> লিখে মেসেজ দিন।' 
        }
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success('Telegram গ্রুপে টেস্ট মেসেজ পাঠানো হয়েছে!');
      } else {
        toast.error('মেসেজ পাঠানো ব্যর্থ: ' + JSON.stringify(data));
      }
    } catch (err: any) {
      console.error('Test message error:', err);
      toast.error('টেস্ট ব্যর্থ: ' + (err.message || 'Unknown error'));
    } finally {
      setTestingBot(false);
    }
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(cmd);
    toast.success('কমান্ড কপি হয়েছে!');
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const toggleSignup = async (val: boolean) => {
    setSignupEnabled(val);
    const { error } = await supabase.from('app_settings' as any).update({ signup_enabled: val, updated_at: new Date().toISOString(), updated_by: user?.id } as any).eq('id', 1);
    if (error) {
      toast.error(error.message);
      setSignupEnabled(!val);
    } else {
      toast.success(val ? 'সাইনআপ চালু হয়েছে' : 'সাইনআপ বন্ধ হয়েছে');
    }
  };

  const updateAdminPortalPassword = async () => {
    if (!adminPortalPassword || adminPortalPassword.length < 6) {
      toast.error('Dedicated Admin Password কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }
    if (adminPortalPassword !== adminPortalPasswordConfirm) {
      toast.error('Dedicated Admin Password মেলেনি');
      return;
    }
    const { error } = await supabase.rpc('set_admin_portal_password' as any, { _new_password: adminPortalPassword });
    if (error) { toast.error(error.message); return; }
    setAdminPortalPassword('');
    setAdminPortalPasswordConfirm('');
    toast.success('Dedicated Admin Password আপডেট হয়েছে');
  };

  const openFinalizeDialog = () => {
    if (selectedMonth?.end_date) {
      const nextDay = new Date(selectedMonth.end_date);
      nextDay.setDate(nextDay.getDate() + 1);
      setNewMonthStart(format(nextDay, 'yyyy-MM-dd'));
      const nextEnd = new Date(nextDay);
      nextEnd.setMonth(nextEnd.getMonth() + 1);
      nextEnd.setDate(nextEnd.getDate() - 1);
      setNewMonthEnd(format(nextEnd, 'yyyy-MM-dd'));
    }
    setShowFinalizeDialog(true);
  };

  const calculatedRate = totalMeals > 0 ? (parseFloat(totalExpense) || 0) / totalMeals : 0;
  const displayRate = parseFloat(manualMealRate) || calculatedRate;

  const getMonthLabel = (m: MealMonthRecord) => {
    if (m.start_date && m.end_date) {
      return `${format(new Date(m.start_date), 'dd MMM')} — ${format(new Date(m.end_date), 'dd MMM yyyy')}`;
    }
    return `${m.year}-${String(m.month).padStart(2, '0')}`;
  };

  // Check if there's an active next month already
  const hasActiveNextMonth = allMonths.some(m => m.id !== selectedMonthId && m.is_active);

  return (
    <div className="space-y-6 page-enter stagger-children">
      {/* Month Selector */}
      <Card className="holo-card animate-fade-in-up overflow-hidden">
        <CardHeader>
          <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
            <CalendarDays className="h-5 w-5 text-primary animate-float" /> মাস নির্বাচন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedMonthId} onValueChange={setSelectedMonthId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="মাস নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                {allMonths.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      {getMonthLabel(m)}
                      {m.is_active && <Badge variant="default" className="text-[10px] py-0">সক্রিয়</Badge>}
                      {Number(m.meal_rate) > 0 && <Badge variant="secondary" className="text-[10px] py-0">রেট: ৳{Number(m.meal_rate).toFixed(0)}</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isOnlyHistoricalManager && (
              <Button variant="outline" className="font-bengali gap-1" onClick={() => setShowNewMonthForm(true)}>
                <Plus className="h-4 w-4" /> নতুন মাস
              </Button>
            )}
          </div>

          {selectedMonth && (
            <div className="flex flex-wrap gap-2 text-xs font-bengali">
              {selectedMonth.is_active ? (
                <Badge className="bg-primary">সক্রিয় মাস</Badge>
              ) : (
                <Badge variant="secondary">পুরোনো মাস</Badge>
              )}
              {Number(selectedMonth.meal_rate) > 0 ? (
                <Badge variant="outline">রেট সেট করা আছে: ৳{Number(selectedMonth.meal_rate).toFixed(2)}</Badge>
              ) : (
                <Badge variant="destructive">রেট সেট হয়নি</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Month Settings (for selected month) */}
      {selectedMonth && (
        <Card className="holo-card overflow-hidden animate-fade-in-up">
          <CardHeader>
            <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
              <Settings className="h-5 w-5 text-primary" style={{ animation: 'spin-slow 12s linear infinite' }} /> মাসের সেটিংস — {getMonthLabel(selectedMonth)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-bengali">শুরুর তারিখ</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="font-bengali">শেষ তারিখ</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="font-bengali">মিল রেট (টাকা)</Label>
                  <Input type="number" value={manualMealRate} onChange={e => setManualMealRate(e.target.value)} placeholder="যেমন: 65" />
                  <p className="text-xs text-muted-foreground font-bengali mt-1">
                    যেকোনো সময় যেকোনো মাসের রেট সেট/পরিবর্তন করুন
                  </p>
                </div>
                <div>
                  <Label className="font-bengali">অতিরিক্ত চার্জ (টাকা/মাস)</Label>
                  <Input type="number" value={extraCharge} onChange={e => setExtraCharge(e.target.value)} placeholder="যেমন: 200" />
                </div>
                <div>
                  <Label className="font-bengali">সর্বনিম্ন মিল (Minimum Meals)</Label>
                  <Input type="number" value={minMeals} onChange={e => setMinMeals(e.target.value)} placeholder="যেমন: 30" min="0" />
                  <p className="text-xs text-muted-foreground font-bengali mt-1">
                    কারো মিল এই সংখ্যার নিচে হলে, হিসাবে এই সংখ্যাই গণ্য হবে। ০ মানে নিষ্ক্রিয়।
                  </p>
                </div>
                <div>
                  <Label className="font-bengali">মোট খরচ (টাকা) — ঐচ্ছিক</Label>
                  <Input type="number" value={totalExpense} onChange={e => setTotalExpense(e.target.value)} placeholder="মোট খরচ লিখুন" />
                </div>

                {/* Summary */}
                <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
                  <div className="flex justify-between font-bengali text-xs text-muted-foreground">
                    <span>মিলের সময়কাল:</span>
                    <span>{startDate && endDate ? `${format(new Date(startDate), 'dd MMM')} — ${format(new Date(endDate), 'dd MMM yyyy')}` : 'সেট করুন'}</span>
                  </div>
                  <div className="flex justify-between font-bengali">
                    <span>মোট মিল:</span>
                    <span className="font-bold">{totalMeals}</span>
                  </div>
                  <div className="flex justify-between font-bengali">
                    <span>ক্যালকুলেটেড রেট:</span>
                    <span className="text-muted-foreground">৳{calculatedRate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bengali">
                    <span>সক্রিয় মিল রেট:</span>
                    <span className="font-bold text-primary">৳{displayRate.toFixed(2)}</span>
                  </div>
                  {parseFloat(extraCharge) > 0 && (
                    <div className="flex justify-between font-bengali">
                      <span>অতিরিক্ত চার্জ:</span>
                      <span className="font-bold text-destructive">৳{parseFloat(extraCharge).toFixed(0)}/মাস</span>
                    </div>
                  )}
                </div>

                <Button onClick={saveMonthSettings} className="w-full font-bengali gap-1">
                  <Save className="h-4 w-4" /> সেভ করুন
                </Button>

                {/* Finalize — only for months with rate set */}
                {Number(selectedMonth.meal_rate) > 0 && (
                  <Button onClick={openFinalizeDialog} variant="destructive" className="w-full font-bengali gap-1">
                    <ArrowRightCircle className="h-4 w-4" /> মাস শেষ করুন ও ক্যারি ফরওয়ার্ড
                  </Button>
                )}
              </div>

              {!isOnlyHistoricalManager && (
                <div className="space-y-4">
                  <div>
                    <Label className="font-bengali">পরবর্তী ম্যানেজার নির্ধারণ</Label>
                    <Select value={nextManager} onValueChange={setNextManager}>
                      <SelectTrigger><SelectValue placeholder="সদস্য নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>
                        {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={assignNextManager} variant="secondary" className="w-full font-bengali gap-1" disabled={!nextManager}>
                    <UserCheck className="h-4 w-4" /> ম্যানেজার নির্ধারণ করুন
                  </Button>

                  <Card className="border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                          <Label className="font-bengali">সাইনআপ অপশন</Label>
                        </div>
                        <Switch checked={signupEnabled} onCheckedChange={toggleSignup} />
                      </div>
                      <p className="text-xs text-muted-foreground font-bengali mt-2">
                        {signupEnabled ? 'চালু — রেজিস্ট্রেশন ট্যাব দেখাবে' : 'বন্ধ — রেজিস্ট্রেশন ট্যাব লুকানো'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info: How billing works */}
      <Card className="border-dashed border-primary/30">
        <CardContent className="p-4">
          <h4 className="font-bengali font-bold text-sm mb-2 flex items-center gap-2">
            <History className="h-4 w-4" /> হিসাবের নিয়ম
          </h4>
          <ul className="text-xs text-muted-foreground font-bengali space-y-1 list-disc list-inside">
            <li>প্রতিটি মাসের custom তারিখ range সেট করুন</li>
            <li>মাস চলাকালীন পেমেন্ট জমা নিন — ওই মাসের হিসাবে জমা থাকবে</li>
            <li>পরের মাসে মিল রেট আসলে, আগের মাসের রেট সেট করুন</li>
            <li>রেট সেট করে "মাস শেষ করুন" → বকেয়া/পাওনা অটো নতুন মাসে carry হবে</li>
            <li>নতুন মাসে নতুন পেমেন্ট আলাদাভাবে ট্র্যাক হবে</li>
          </ul>
        </CardContent>
      </Card>

      {!isOnlyHistoricalManager && (
        <>
          {/* Telegram */}
          <Card className="holo-card overflow-hidden animate-fade-in-up">
            <CardHeader>
              <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
                <Bot className="h-5 w-5 text-primary animate-float" /> Telegram বট ও রিমাইন্ডার ইন্টিগ্রেশন
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 max-w-2xl">
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                <div>
                  <Label className="font-bengali text-sm font-semibold">Telegram বট {telegramEnabled ? 'চালু' : 'বন্ধ'}</Label>
                  <p className="text-xs text-muted-foreground font-bengali mt-0.5">
                    চালু থাকলে মেম্বাররা Telegram গ্রুপে মেসেজ দিয়ে মিল ও এক্সট্রা পরিবর্তন করতে পারবে
                  </p>
                </div>
                <Switch checked={telegramEnabled} onCheckedChange={toggleTelegramEnabled} />
              </div>

              <div>
                <Label className="font-bengali">Telegram Group Chat ID</Label>
                <div className="flex gap-2 mt-1">
                  <Input 
                    value={telegramChatId} 
                    onChange={(e) => setTelegramChatId(e.target.value)} 
                    placeholder="-100xxxxxxxxxx" 
                    className="font-mono text-sm"
                  />
                  <Button onClick={saveTelegramSettings} size="sm" className="font-bengali gap-1 shrink-0">
                    <Save className="h-4 w-4" /> সেভ করুন
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-bengali mt-1">
                  Telegram গ্রুপে @userinfobot অ্যাড করে Chat ID পান (যেমন: <code>-1002233445566</code>)।
                </p>
              </div>

              {/* Webhook Connection & Testing Controls */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-bengali text-sm font-semibold">গ্রুপ মেসেজ Webhook কানেকশন</span>
                  </div>
                  {webhookStatus?.url && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" /> কানেক্টেড
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-bengali">
                  গ্রুপে মেম্বারদের মেসেজ প্রসেস করার জন্য বটের Webhook এক ক্লিকেই চালু করুন।
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleSetWebhook}
                    disabled={webhookConnecting}
                    className="font-bengali text-xs gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${webhookConnecting ? 'animate-spin' : ''}`} />
                    {webhookConnecting ? 'কানেক্ট হচ্ছে...' : 'Webhook কানেক্ট করুন'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCheckWebhook}
                    disabled={webhookConnecting}
                    className="font-bengali text-xs gap-1.5"
                  >
                    স্ট্যাটাস চেক
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSendTestMessage}
                    disabled={testingBot || !telegramChatId}
                    className="font-bengali text-xs gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {testingBot ? 'পাঠানো হচ্ছে...' : 'টেস্ট মেসেজ পাঠান'}
                  </Button>
                </div>
              </div>

              {/* Supported Bot Commands & Cheatsheet */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bengali text-sm font-semibold flex items-center gap-1.5">
                    <Bot className="h-4 w-4 text-primary" /> গ্রুপে পাঠানোর সহজ মেসেজ ফরম্যাট
                  </span>
                  <Badge variant="secondary" className="font-bengali text-xs">
                    মেম্বারদের সাথে শেয়ার করুন
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { label: '২ লাঞ্চ, ১ ডিনার', cmd: '25 2L 1D' },
                    { label: '৩ লাঞ্চ, ২ ডিনার', cmd: '25 3L 2D' },
                    { label: '২ লাঞ্চ', cmd: '25 2L' },
                    { label: '১টি অতিরিক্ত লাঞ্চ', cmd: '25 +1L' },
                    { label: 'মিল অন/অফ', cmd: '25 L on D off' },
                    { label: 'লাঞ্চ মাডি + ডিনার গরু', cmd: '25 L madi D goru' },
                    { label: '২ লাঞ্চ (মাডি) + ১ ডিনার (গরু)', cmd: '25 2L madi 1D goru' },
                    { label: 'লাঞ্চে মাডি (ডিম ভাজি)', cmd: '25 L madi' },
                    { label: 'ডিনারে গরু', cmd: '25 D goru' },
                    { label: 'লাঞ্চ এক্সট্রা বাতিল', cmd: '25 L extra off' },
                    { label: 'ডিনার এক্সট্রা বাতিল', cmd: '25 D extra off' },
                    { label: '🥩 গরু', cmd: '25 on on extra goru' },
                    { label: '🍖 খাসি', cmd: '25 on on extra khasi' },
                    { label: '🍗 মুরগি', cmd: '25 on on extra murgi' },
                    { label: '🍳 ডিম ভাজি - মাছ (মাডি)', cmd: '25 on on madi' },
                    { label: '🍳 ডিম পোচ - মাছ (মাপো)', cmd: '25 on on mapo' },
                    { label: '🍳 ডিম ভাজি - পোল্ট্রি (মুডি)', cmd: '25 on on mudi' },
                    { label: '🍳 ডিম পোচ - পোল্ট্রি (মুপো)', cmd: '25 on on mupo' },
                    { label: '❌ সকল এক্সট্রা বাতিল', cmd: '25 extra off' },
                    { label: '📊 মেম্বার স্ট্যাটাস', cmd: '/status 25' },
                    { label: '📈 অল-ব্যাচ সামারি', cmd: '/summary' },
                    { label: '❓ বটের সহায়িকা', cmd: '/help' },
                  ].map((item) => (
                    <div 
                      key={item.cmd} 
                      className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-border/40 hover:border-primary/40 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground font-bengali block">{item.label}</span>
                        <code className="text-primary font-mono font-medium">{item.cmd}</code>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => handleCopyCommand(item.cmd)}
                      >
                        {copiedCommand === item.cmd ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule times for reminders */}
              <div className="space-y-2 border-t border-border/30 pt-3">
                <Label className="font-bengali font-semibold">স্বয়ংক্রিয় রিমাইন্ডার পাঠানোর সময়সমূহ</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {telegramScheduleTimes.length === 0 ? (
                    <span className="text-xs text-muted-foreground font-bengali">কোনো সময় সেট করা নেই</span>
                  ) : (
                    telegramScheduleTimes.map((time) => (
                      <Badge key={time} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5 font-sans text-sm">
                        {time}
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive rounded-full"
                          onClick={() => removeScheduleTime(time)}
                          type="button"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input 
                    type="time" 
                    value={newScheduleTime} 
                    onChange={(e) => setNewScheduleTime(e.target.value)} 
                    className="max-w-[150px] font-sans"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={addScheduleTime}
                    className="font-bengali flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> সময় যোগ করুন
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-bengali mt-1">
                  এখানে সেট করা সময়গুলোতে (বাংলাদেশ সময় অনুযায়ী) স্বয়ংক্রিয়ভাবে Telegram-এ মিল আপডেটের রিমাইন্ডার যাবে।
                </p>
              </div>

              <Button onClick={saveTelegramSettings} className="font-bengali gap-1 w-full sm:w-auto">
                <Save className="h-4 w-4" /> Telegram সেটিংস সেভ করুন
              </Button>
            </CardContent>
          </Card>


          {/* Meal Cutoff Time */}
          <Card className="holo-card overflow-hidden animate-fade-in-up">
            <CardHeader>
              <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
                <Clock className="h-5 w-5 text-primary animate-float" /> মিল আপডেট কাটঅফ টাইম
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <p className="text-xs text-muted-foreground font-bengali">
                এই সময়ের পর স্টুডেন্টরা মিল আপডেট করতে পারবে না। ডিফল্ট: রাত ১০:০০ PM
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="font-bengali">ঘণ্টা (0-23)</Label>
                  <Input type="number" min="0" max="23" value={cutoffHour} onChange={e => setCutoffHour(parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex-1">
                  <Label className="font-bengali">মিনিট (0-59)</Label>
                  <Input type="number" min="0" max="59" value={cutoffMinute} onChange={e => setCutoffMinute(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-sm font-bengali">
                  বর্তমান কাটঅফ: <span className="font-bold text-primary">{String(cutoffHour).padStart(2, '0')}:{String(cutoffMinute).padStart(2, '0')}</span>
                  <span className="text-muted-foreground ml-2">
                    ({cutoffHour >= 12 ? `${cutoffHour === 12 ? 12 : cutoffHour - 12}:${String(cutoffMinute).padStart(2, '0')} PM` : `${cutoffHour === 0 ? 12 : cutoffHour}:${String(cutoffMinute).padStart(2, '0')} AM`})
                  </span>
                </p>
              </div>
              <Button onClick={async () => {
                const { error } = await supabase.from('app_settings' as any).update({
                  meal_cutoff_hour: cutoffHour,
                  meal_cutoff_minute: cutoffMinute,
                  updated_at: new Date().toISOString(),
                  updated_by: user?.id,
                } as any).eq('id', 1);
                if (error) toast.error(error.message);
                else toast.success('কাটঅফ টাইম আপডেট হয়েছে');
              }} className="font-bengali gap-1">
                <Clock className="h-4 w-4" /> কাটঅফ টাইম সেভ করুন
              </Button>
            </CardContent>
          </Card>

          {/* Admin Password */}
          <Card className="holo-card overflow-hidden animate-fade-in-up">
            <CardHeader>
              <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
                <ShieldCheck className="h-5 w-5 text-primary animate-glow-pulse" /> Dedicated Admin Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div>
                <Label className="font-bengali">নতুন Password</Label>
                <Input type="password" value={adminPortalPassword} onChange={(e) => setAdminPortalPassword(e.target.value)} placeholder="কমপক্ষে ৬ অক্ষর" />
              </div>
              <div>
                <Label className="font-bengali">পুনরায় লিখুন</Label>
                <Input type="password" value={adminPortalPasswordConfirm} onChange={(e) => setAdminPortalPasswordConfirm(e.target.value)} placeholder="একই পাসওয়ার্ড আবার" />
              </div>
              <Button onClick={updateAdminPortalPassword} className="font-bengali gap-1">
                <ShieldCheck className="h-4 w-4" /> সেভ করুন
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* New Month Dialog */}
      <Dialog open={showNewMonthForm} onOpenChange={setShowNewMonthForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bengali">নতুন মাস তৈরি করুন</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-bengali">শুরুর তারিখ</Label>
              <Input type="date" value={newMonthFormStart} onChange={e => setNewMonthFormStart(e.target.value)} />
            </div>
            <div>
              <Label className="font-bengali">শেষ তারিখ</Label>
              <Input type="date" value={newMonthFormEnd} onChange={e => setNewMonthFormEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMonthForm(false)} className="font-bengali">বাতিল</Button>
            <Button onClick={createNewMonth} disabled={!newMonthFormStart || !newMonthFormEnd} className="font-bengali gap-1">
              <CalendarDays className="h-4 w-4" /> তৈরি করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Month Dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bengali">মাস শেষ করুন ও ক্যারি ফরওয়ার্ড</DialogTitle>
            <DialogDescription className="font-bengali">
              এই মাসের হিসাব (মিল × রেট + অতিরিক্ত চার্জ + আগের বকেয়া − জমা) ক্যারি ফরওয়ার্ড হিসেবে পরবর্তী মাসে যুক্ত হবে।
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary/50 font-bengali text-sm space-y-1">
              <p>মাস: <span className="font-bold">{selectedMonth && getMonthLabel(selectedMonth)}</span></p>
              <p>মিল রেট: <span className="font-bold">৳{Number(selectedMonth?.meal_rate || 0).toFixed(2)}</span></p>
              <p>অতিরিক্ত চার্জ: <span className="font-bold">৳{Number(selectedMonth?.extra_charge || 0)}</span></p>
            </div>

            {hasActiveNextMonth ? (
              <p className="text-sm font-bengali text-primary">
                ✓ পরবর্তী সক্রিয় মাস আছে — সেখানে ক্যারি ফরওয়ার্ড যুক্ত হবে
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-bengali">নতুন মাসের শুরু</Label>
                  <Input type="date" value={newMonthStart} onChange={e => setNewMonthStart(e.target.value)} />
                </div>
                <div>
                  <Label className="font-bengali">নতুন মাসের শেষ</Label>
                  <Input type="date" value={newMonthEnd} onChange={e => setNewMonthEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)} className="font-bengali">বাতিল</Button>
            <Button variant="destructive" onClick={finalizeMonth} disabled={finalizing || (!hasActiveNextMonth && (!newMonthStart || !newMonthEnd))} className="font-bengali gap-1">
              <ArrowRightCircle className="h-4 w-4" />
              {finalizing ? 'প্রসেসিং...' : 'মাস শেষ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

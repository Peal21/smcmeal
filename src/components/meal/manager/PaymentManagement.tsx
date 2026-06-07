import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CreditCard, Plus, Check, Search, Download, Edit2, X, Wallet, History, Smartphone, Banknote, Trash2 } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { generatePaymentExcel } from '@/lib/paymentExcelGenerator';
import { format } from 'date-fns';
import { getMealMonthDateRange } from '@/lib/mealMonth';
import { sortByRoll } from '@/lib/sortMembers';

const MONTH_QUERY_LIMIT = 10000;

export default function PaymentManagement() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [dailyMeals, setDailyMeals] = useState<any[]>([]);
  const [extraMeals, setExtraMeals] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [mealMonth, setMealMonth] = useState<any>(null);
  const [allMonths, setAllMonths] = useState<any[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [detailMember, setDetailMember] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newMethod, setNewMethod] = useState<'cash' | 'bikash'>('cash');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState<'cash' | 'bikash'>('cash');
  const [editingMealCount, setEditingMealCount] = useState(false);
  const [mealCountInput, setMealCountInput] = useState('');
  const [pendingMealSave, setPendingMealSave] = useState<{ userId: string; oldCount: number; newCount: number; name: string } | null>(null);
  const [pendingDeletePaymentId, setPendingDeletePaymentId] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'bikash'>('all');

  // Payment history filter
  const [historyMode, setHistoryMode] = useState<'month' | 'custom'>('month');
  const [historyFrom, setHistoryFrom] = useState<string>('');
  const [historyTo, setHistoryTo] = useState<string>('');
  const [allPayments, setAllPayments] = useState<any[]>([]);

  const fetchAllPayments = useCallback(async () => {
    const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(MONTH_QUERY_LIMIT);
    setAllPayments(data || []);
  }, []);

  useEffect(() => { fetchAllPayments(); }, [fetchAllPayments]);

  const fetchAllMonths = useCallback(async () => {
    const { data } = await supabase.from('meal_months').select('*').order('created_at', { ascending: false });
    const months = data || [];
    setAllMonths(months);
    return months;
  }, []);

  const fetchDataForMonth = useCallback(async (month: any) => {
    if (!month) return;
    setMealMonth(month);
    const now = new Date();

    const { start: monthStart, end: monthEnd } = getMealMonthDateRange(month, now);

    const [membersRes, paymentsRes, dailyRes, extraRes, balancesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('payments').select('*').eq('month_id', month.id).order('created_at', { ascending: false }),
      supabase.from('daily_meals').select('*').gte('meal_date', monthStart).lte('meal_date', monthEnd).order('meal_date').limit(MONTH_QUERY_LIMIT),
      supabase.from('extra_meals').select('*').gte('meal_date', monthStart).lte('meal_date', monthEnd).order('meal_date').limit(MONTH_QUERY_LIMIT),
      supabase.from('member_balances').select('user_id, meal_count_override').eq('month_id', month.id),
    ]);

    setMembers(membersRes.data || []);
    setPayments(paymentsRes.data || []);
    setDailyMeals(dailyRes.data || []);
    setExtraMeals(extraRes.data || []);
    setBalances(balancesRes.data || []);
  }, []);

  useEffect(() => {
    (async () => {
      const months = await fetchAllMonths();
      const active = months.find((m: any) => m.is_active) || months[0];
      if (active) {
        setSelectedMonthId(active.id);
        fetchDataForMonth(active);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedMonthId) {
      const month = allMonths.find(m => m.id === selectedMonthId);
      if (month) fetchDataForMonth(month);
    }
  }, [selectedMonthId]);

  useEffect(() => {
    const channel = supabase
      .channel('payments-realtime-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => { if (mealMonth) fetchDataForMonth(mealMonth); fetchAllPayments(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_meals' }, () => { if (mealMonth) fetchDataForMonth(mealMonth); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extra_meals' }, () => { if (mealMonth) fetchDataForMonth(mealMonth); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_months' }, () => { fetchAllMonths(); if (mealMonth) fetchDataForMonth(mealMonth); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { if (mealMonth) fetchDataForMonth(mealMonth); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_balances' }, () => { if (mealMonth) fetchDataForMonth(mealMonth); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mealMonth, fetchDataForMonth]);

  const mealCountMap = useMemo(() => {
    const map = new Map<string, number>();
    dailyMeals.forEach(dm => {
      const count = (dm.lunch ? 1 : 0) + (dm.dinner ? 1 : 0);
      map.set(dm.user_id, (map.get(dm.user_id) || 0) + count);
    });
    extraMeals.forEach(em => {
      const qty = Number(em.quantity) || 0;
      const equiv = Number(em.meal_count_equivalent) || 1;
      map.set(em.user_id, (map.get(em.user_id) || 0) + qty * equiv);
    });
    // Apply manual overrides from member_balances (matches BillingManagement / hisab)
    balances.forEach((b: any) => {
      if (b.meal_count_override !== null && b.meal_count_override !== undefined) {
        map.set(b.user_id, Number(b.meal_count_override));
      }
    });
    return map;
  }, [dailyMeals, extraMeals, balances]);

  const paidMap = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach(p => {
      map.set(p.user_id, (map.get(p.user_id) || 0) + Number(p.amount));
    });
    return map;
  }, [payments]);

  const paidCashMap = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach(p => {
      if ((p.payment_method || 'cash') === 'cash') {
        map.set(p.user_id, (map.get(p.user_id) || 0) + Number(p.amount));
      }
    });
    return map;
  }, [payments]);

  const paidBikashMap = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach(p => {
      if (p.payment_method === 'bikash') {
        map.set(p.user_id, (map.get(p.user_id) || 0) + Number(p.amount));
      }
    });
    return map;
  }, [payments]);

  const mealRate = mealMonth ? Number(mealMonth.meal_rate) : 0;
  const minMeals = mealMonth ? Number((mealMonth as any).min_meals ?? 0) : 0;
  const extraCharge = mealMonth ? Number((mealMonth as any).extra_charge ?? 0) : 0;

  const effectiveMeals = (userId: string) => {
    const raw = mealCountMap.get(userId) || 0;
    return minMeals > 0 && raw < minMeals ? minMeals : raw;
  };

  const computeDue = (userId: string) => effectiveMeals(userId) * mealRate + extraCharge;

  const filteredMembers = useMemo(() => {
    return sortByRoll(members.filter(m => {
      const matchSearch = !searchQuery || m.full_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchYear = filterYear === 'all' || m.year === filterYear;
      const matchGender = filterGender === 'all' || m.gender === filterGender;

      if (filterStatus !== 'all') {
        const totalDue = computeDue(m.user_id);
        const totalPaid = paidMap.get(m.user_id) || 0;
        const remaining = totalDue - totalPaid;
        if (filterStatus === 'paid' && remaining > 0) return false;
        if (filterStatus === 'due' && remaining <= 0) return false;
      }

      return matchSearch && matchYear && matchGender;
    }));
  }, [members, searchQuery, filterYear, filterGender, filterStatus, mealCountMap, paidMap, mealRate, minMeals, extraCharge]);

  const summary = useMemo(() => {
    let totalDueAll = 0, totalPaidAll = 0, totalCash = 0, totalBikash = 0;
    members.forEach(m => {
      const meals = effectiveMeals(m.user_id);
      totalDueAll += meals * mealRate + extraCharge;
      totalPaidAll += paidMap.get(m.user_id) || 0;
      totalCash += paidCashMap.get(m.user_id) || 0;
      totalBikash += paidBikashMap.get(m.user_id) || 0;
    });
    return { totalDue: totalDueAll, totalPaid: totalPaidAll, totalRemaining: totalDueAll - totalPaidAll, totalCash, totalBikash };
  }, [members, mealCountMap, paidMap, paidCashMap, paidBikashMap, mealRate, minMeals, extraCharge]);

  // Payment for selected detail member
  const memberPayments = useMemo(() => {
    if (!detailMember) return [];
    return payments.filter(p => p.user_id === detailMember.user_id);
  }, [payments, detailMember]);

  const openDetail = (member: any) => {
    setDetailMember(member);
    setDetailOpen(true);
    setNewAmount('');
    setNewMethod('cash');
    setEditingPaymentId(null);
    setEditAmount('');
  };

  const addPayment = async () => {
    if (!detailMember || !newAmount || !mealMonth || !user) return;
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt === 0) { toast.error('সঠিক টাকার পরিমাণ দিন (মাইনাসও দেয়া যাবে)'); return; }
    const { error } = await supabase.from('payments').insert({
      user_id: detailMember.user_id, month_id: mealMonth.id,
      amount: amt, verified_by: user.id, is_verified: true,
      payment_method: newMethod,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${newMethod === 'bikash' ? 'বিকাশ' : 'নগদ'} পেমেন্ট যোগ হয়েছে`);
      setNewAmount('');
      await Promise.all([fetchDataForMonth(mealMonth), fetchAllPayments()]);
    }
  };

  const markFullyPaid = async () => {
    if (!detailMember || !mealMonth || !user) return;
    const remaining = detailDue - detailPaid;
    if (remaining === 0) { toast.info('ইতিমধ্যেই পরিশোধিত'); return; }
    const { error } = await supabase.from('payments').insert({
      user_id: detailMember.user_id, month_id: mealMonth.id,
      amount: remaining, verified_by: user.id, is_verified: true,
      notes: 'Done — full payment',
      payment_method: newMethod,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`৳${remaining.toFixed(0)} জমা হয়েছে — সম্পূর্ণ পরিশোধিত`);
      await Promise.all([fetchDataForMonth(mealMonth), fetchAllPayments()]);
    }
  };

  const updatePayment = async (paymentId: string) => {
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt === 0) { toast.error('সঠিক টাকার পরিমাণ দিন (মাইনাসও দেয়া যাবে)'); return; }
    const { error } = await supabase.from('payments').update({ amount: amt, payment_method: editMethod }).eq('id', paymentId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('পেমেন্ট আপডেট হয়েছে');
      setEditingPaymentId(null);
      setEditAmount('');
      if (mealMonth) await Promise.all([fetchDataForMonth(mealMonth), fetchAllPayments()]);
    }
  };

  const handleDeletePaymentClick = (paymentId: string) => {
    setPendingDeletePaymentId(paymentId);
  };

  const confirmDeletePayment = async () => {
    if (!pendingDeletePaymentId) return;
    const { error } = await supabase.from('payments').delete().eq('id', pendingDeletePaymentId);
    if (error) {
      toast.error('পেমেন্ট ডিলিট করতে সমস্যা হয়েছে: ' + error.message);
    } else {
      toast.success('পেমেন্টটি সফলভাবে ডিলিট করা হয়েছে');
      if (mealMonth) await Promise.all([fetchDataForMonth(mealMonth), fetchAllPayments()]);
    }
    setPendingDeletePaymentId(null);
  };


  const saveMealCountOverride = async () => {
    if (!pendingMealSave || !mealMonth) return;
    const { userId, newCount } = pendingMealSave;
    const { error } = await supabase.from('member_balances').upsert({
      user_id: userId,
      month_id: mealMonth.id,
      meal_count_override: newCount,
    } as any, { onConflict: 'user_id,month_id' });
    if (error) toast.error(error.message);
    else {
      toast.success('মিল কাউন্ট আপডেট হয়েছে');
      setBalances(prev => {
        const exists = prev.some((b: any) => b.user_id === userId);
        if (exists) return prev.map((b: any) => b.user_id === userId ? { ...b, meal_count_override: newCount } : b);
        return [...prev, { user_id: userId, meal_count_override: newCount }];
      });
    }
    setPendingMealSave(null);
    setEditingMealCount(false);
    setMealCountInput('');
  };
  const detailMeals = detailMember ? effectiveMeals(detailMember.user_id) : 0;
  const detailDue = detailMeals * mealRate + extraCharge;
  const detailPaid = detailMember ? (paidMap.get(detailMember.user_id) || 0) : 0;
  const detailCash = detailMember ? (paidCashMap.get(detailMember.user_id) || 0) : 0;
  const detailBikash = detailMember ? (paidBikashMap.get(detailMember.user_id) || 0) : 0;
  const detailRemaining = detailDue - detailPaid;

  const getMonthLabel = (m: any) => {
    if (m?.start_date && m?.end_date) return `${format(new Date(m.start_date), 'dd MMM')} — ${format(new Date(m.end_date), 'dd MMM yyyy')}`;
    return m ? `${m.year}-${String(m.month).padStart(2, '0')}` : '';
  };

  return (
    <Card className="holo-card animate-fade-in-up overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="w-full space-y-2">
          <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
            <CreditCard className="h-5 w-5 text-primary animate-float" /> পেমেন্ট ব্যবস্থাপনা ({filteredMembers.length} জন)
          </CardTitle>
          <Select value={selectedMonthId} onValueChange={setSelectedMonthId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="মাস নির্বাচন করুন" />
            </SelectTrigger>
            <SelectContent>
              {allMonths.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {getMonthLabel(m)} {m.is_active ? '(সক্রিয়)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          {mealMonth && (
            <Button
              size="sm"
              variant="outline"
              className="font-bengali gap-1"
              onClick={() => {
                const ml = `${mealMonth.year}-${String(mealMonth.month).padStart(2, '0')}`;
                const genderFilter = filterGender as 'all' | 'male' | 'female';
                generatePaymentExcel(members, mealCountMap, paidMap, mealRate, minMeals, extraCharge, ml, genderFilter, paidCashMap, paidBikashMap);
              }}
            >
              <Download className="h-4 w-4" /> Excel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mealMonth && <p className="text-muted-foreground font-bengali text-center py-8">এই মাসের সেটিংস এখনো তৈরি হয়নি।</p>}
        {mealMonth && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 stagger-children">
              <div className="rounded-lg border bg-card p-3 text-center card-hover card-shine">
                <p className="text-xs text-muted-foreground font-bengali">মোট পাওনা</p>
                <p className="text-lg font-bold text-foreground">৳{summary.totalDue.toFixed(0)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center card-hover card-shine">
                <p className="text-xs text-muted-foreground font-bengali">মোট জমা</p>
                <p className="text-lg font-bold text-primary">৳{summary.totalPaid.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground font-bengali leading-tight mt-0.5">
                  নগদ ৳{summary.totalCash.toFixed(0)} • বিকাশ ৳{summary.totalBikash.toFixed(0)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center card-hover card-shine">
                <p className="text-xs text-muted-foreground font-bengali">মোট বাকি</p>
                <p className="text-lg font-bold text-destructive">৳{summary.totalRemaining.toFixed(0)}</p>
              </div>
            </div>

            {/* Method breakdown cards */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethodFilter(methodFilter === 'cash' ? 'all' : 'cash')}
                className={`rounded-lg border p-3 text-left transition-all ${methodFilter === 'cash' ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'bg-card hover:bg-secondary/40'}`}
              >
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-primary" />
                  <p className="text-xs font-bengali font-semibold">নগদ Cash</p>
                </div>
                <p className="text-lg font-bold mt-1">৳{summary.totalCash.toFixed(0)}</p>
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter(methodFilter === 'bikash' ? 'all' : 'bikash')}
                className={`rounded-lg border p-3 text-left transition-all ${methodFilter === 'bikash' ? 'border-pink-500 bg-pink-500/10 ring-2 ring-pink-500/30' : 'bg-card hover:bg-secondary/40'}`}
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-pink-500" />
                  <p className="text-xs font-bengali font-semibold">বিকাশ Bikash</p>
                </div>
                <p className="text-lg font-bold mt-1 text-pink-600">৳{summary.totalBikash.toFixed(0)}</p>
              </button>
            </div>


            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="নাম খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  <SelectItem value="male">ছেলে</SelectItem>
                  <SelectItem value="female">মেয়ে</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব Year</SelectItem>
                  <SelectItem value="1st">1st</SelectItem>
                  <SelectItem value="2nd">2nd</SelectItem>
                  <SelectItem value="3rd">3rd</SelectItem>
                  <SelectItem value="4th">4th</SelectItem>
                  <SelectItem value="5th">5th</SelectItem>
                  <SelectItem value="extra">Extra</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
                  <SelectItem value="paid">পরিশোধ</SelectItem>
                  <SelectItem value="due">বাকি আছে</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {/* Desktop Table */}
            <div className="rounded-lg border overflow-auto hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bengali">নাম</TableHead>
                    <TableHead className="font-bengali text-center">Year</TableHead>
                    <TableHead className="font-bengali text-center">মিল</TableHead>
                    <TableHead className="font-bengali text-right">পাওনা</TableHead>
                    <TableHead className="font-bengali text-right">জমা</TableHead>
                    <TableHead className="font-bengali text-right">বাকি</TableHead>
                    <TableHead className="font-bengali text-center">স্ট্যাটাস</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map(m => {
                    const totalMeals = effectiveMeals(m.user_id);
                    const totalDue = totalMeals * mealRate + extraCharge;
                    const totalPaid = paidMap.get(m.user_id) || 0;
                    const remaining = totalDue - totalPaid;
                    return (
                      <TableRow key={m.user_id} className="cursor-pointer hover:bg-secondary/50" onClick={() => openDetail(m)}>
                        <TableCell className="font-medium">{m.full_name}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{m.year}</Badge></TableCell>
                        <TableCell className="text-center">{totalMeals}</TableCell>
                        <TableCell className="text-right">৳{totalDue.toFixed(0)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{totalPaid > 0 ? `৳${totalPaid.toFixed(0)}` : '—'}</TableCell>
                        <TableCell className="text-right font-bold">
                          {remaining > 0
                            ? <span className="text-destructive">৳{remaining.toFixed(0)}</span>
                            : remaining < 0
                              ? <span className="text-primary">+৳{Math.abs(remaining).toFixed(0)}</span>
                              : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {remaining <= 0 ? (
                            <Badge variant="default" className="font-bengali text-xs"><Check className="h-3 w-3 mr-1" />পরিশোধ</Badge>
                          ) : (
                            <Badge variant="destructive" className="font-bengali text-xs">বাকি</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground font-bengali py-8">কোনো সদস্য নেই</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden space-y-2">
              {filteredMembers.map(m => {
                const totalMeals = effectiveMeals(m.user_id);
                const totalDue = totalMeals * mealRate + extraCharge;
                const totalPaid = paidMap.get(m.user_id) || 0;
                const remaining = totalDue - totalPaid;
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    className="w-full text-left rounded-lg border p-3 active:bg-secondary/70 transition-colors"
                    onClick={() => openDetail(m)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{m.full_name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{m.year}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>মিল: {totalMeals}</span>
                          <span>পাওনা: ৳{totalDue.toFixed(0)}</span>
                          {totalPaid > 0 && <span className="text-primary font-bold">জমা: ৳{totalPaid.toFixed(0)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {remaining > 0 ? (
                          <Badge variant="destructive" className="font-bengali text-xs">৳{remaining.toFixed(0)}</Badge>
                        ) : remaining < 0 ? (
                          <Badge className="font-bengali text-xs bg-primary">+৳{Math.abs(remaining).toFixed(0)}</Badge>
                        ) : (
                          <Badge variant="default" className="font-bengali text-xs"><Check className="h-3 w-3 mr-1" />পরিশোধ</Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredMembers.length === 0 && (
                <p className="text-center text-muted-foreground font-bengali py-8">কোনো সদস্য নেই</p>
              )}
            </div>
            {/* All Payments History */}
            <div className="rounded-lg border bg-card/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <h3 className="font-bengali font-semibold text-sm">পেমেন্ট ইতিহাস</h3>
                </div>
                <Select value={historyMode} onValueChange={(v: any) => setHistoryMode(v)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month" className="font-bengali">নির্বাচিত মাস</SelectItem>
                    <SelectItem value="custom" className="font-bengali">কাস্টম তারিখ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {historyMode === 'custom' && (
                <div className="flex gap-2 items-center flex-wrap">
                  <Input type="date" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} className="h-8 text-xs flex-1 min-w-[130px]" />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input type="date" value={historyTo} onChange={e => setHistoryTo(e.target.value)} className="h-8 text-xs flex-1 min-w-[130px]" />
                </div>
              )}
              {(() => {
                let list: any[] = [];
                if (historyMode === 'month') {
                  list = payments;
                } else {
                  list = allPayments.filter(p => {
                    const d = (p.created_at || '').slice(0, 10);
                    if (historyFrom && d < historyFrom) return false;
                    if (historyTo && d > historyTo) return false;
                    return true;
                  });
                }
                if (methodFilter !== 'all') {
                  list = list.filter(p => (p.payment_method || 'cash') === methodFilter);
                }
                if (list.length === 0) {
                  return <p className="text-center text-muted-foreground font-bengali text-xs py-4">কোনো এন্ট্রি নেই</p>;
                }
                return (
                  <>
                    <p className="text-[10px] text-muted-foreground font-bengali">
                      মোট {list.length} এন্ট্রি
                      {methodFilter !== 'all' && ` • শুধু ${methodFilter === 'bikash' ? 'বিকাশ' : 'নগদ'}`}
                    </p>
                    <div className="max-h-72 overflow-y-auto space-y-1.5">
                      {list.map(p => {
                        const member = members.find(m => m.user_id === p.user_id);
                        const amt = Number(p.amount);
                        const isMinus = amt < 0;
                        const method = (p.payment_method || 'cash') as 'cash' | 'bikash';
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => member && openDetail(member)}
                            className="w-full flex items-center justify-between gap-2 rounded-md border bg-background p-2 text-left hover:bg-secondary/60 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate font-bengali flex items-center gap-1.5">
                                {method === 'bikash'
                                  ? <Smartphone className="h-3 w-3 text-pink-500 shrink-0" />
                                  : <Banknote className="h-3 w-3 text-primary shrink-0" />}
                                {member?.full_name || '—'}
                                {member?.roll_number && <span className="text-xs text-muted-foreground">({member.roll_number})</span>}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(p.created_at), 'dd MMM yyyy, hh:mm a')}
                                {' • '}
                                <span className={method === 'bikash' ? 'text-pink-600 font-semibold' : 'text-primary font-semibold'}>
                                  {method === 'bikash' ? 'বিকাশ' : 'নগদ'}
                                </span>
                              </p>
                            </div>
                            <Badge className={`font-bold text-sm shrink-0 ${isMinus ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/30' : method === 'bikash' ? 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 border-pink-500/30' : 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/30'}`}>
                              {isMinus ? '−' : ''}৳{Math.abs(amt).toFixed(0)}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </CardContent>

      {/* Detail Dialog - payment history + add/edit */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bengali flex items-center gap-2">
              <Wallet className="h-5 w-5" /> {detailMember?.full_name}
            </DialogTitle>
          </DialogHeader>
          {detailMember && (
            <div className="space-y-4">
              {/* Summary for this member */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-card p-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-bengali">মিল</p>
                  {editingMealCount ? (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={mealCountInput}
                        onChange={e => setMealCountInput(e.target.value)}
                        className="h-7 w-20 text-center text-sm px-1"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const n = parseFloat(mealCountInput);
                            if (!isNaN(n) && n >= 0 && detailMember) {
                              setPendingMealSave({ userId: detailMember.user_id, oldCount: detailMeals, newCount: n, name: detailMember.full_name });
                            }
                          }
                          if (e.key === 'Escape') { setEditingMealCount(false); setMealCountInput(''); }
                        }}
                      />
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                        const n = parseFloat(mealCountInput);
                        if (!isNaN(n) && n >= 0 && detailMember) {
                          setPendingMealSave({ userId: detailMember.user_id, oldCount: detailMeals, newCount: n, name: detailMember.full_name });
                        }
                      }}>
                        <Check className="h-3 w-3 text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingMealCount(false); setMealCountInput(''); }}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-bold inline-flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => { setEditingMealCount(true); setMealCountInput(String(detailMeals)); }}
                      title="মিল কাউন্ট এডিট করুন"
                    >
                      {detailMeals}
                      <Edit2 className="h-3 w-3 opacity-60" />
                    </button>
                  )}
                </div>
                <div className="rounded-lg border bg-card p-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-bengali">পাওনা</p>
                  <p className="text-sm font-bold">৳{detailDue.toFixed(0)}</p>
                  {extraCharge > 0 && (
                    <p className="text-[9px] text-muted-foreground font-bengali leading-tight">
                      মিল ৳{(detailMeals * mealRate).toFixed(0)} + অতিরিক্ত ৳{extraCharge.toFixed(0)}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border bg-card p-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-bengali">
                    {detailRemaining > 0 ? 'বাকি' : 'অতিরিক্ত'}
                  </p>
                  <p className={`text-sm font-bold ${detailRemaining > 0 ? 'text-destructive' : 'text-primary'}`}>
                    ৳{Math.abs(detailRemaining).toFixed(0)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Add new payment */}
              <div>
                <Label className="font-bengali text-sm font-semibold flex items-center gap-1">
                  <Plus className="h-4 w-4" /> নতুন পেমেন্ট যোগ
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setNewMethod('cash')}
                    className={`rounded-md border p-2 text-xs font-bengali flex items-center justify-center gap-1.5 transition-all ${newMethod === 'cash' ? 'border-primary bg-primary/10 ring-2 ring-primary/30 font-bold' : 'bg-card hover:bg-secondary/40'}`}
                  >
                    <Banknote className="h-4 w-4" /> নগদ (Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMethod('bikash')}
                    className={`rounded-md border p-2 text-xs font-bengali flex items-center justify-center gap-1.5 transition-all ${newMethod === 'bikash' ? 'border-pink-500 bg-pink-500/10 ring-2 ring-pink-500/30 font-bold text-pink-600' : 'bg-card hover:bg-secondary/40'}`}
                  >
                    <Smartphone className="h-4 w-4" /> বিকাশ (Bikash)
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    placeholder="টাকা (মাইনাসও দেয়া যাবে)"
                    className="flex-1"
                    onKeyDown={e => e.key === 'Enter' && addPayment()}
                  />
                  <Button onClick={addPayment} size="sm" className="font-bengali">
                    জমা করুন
                  </Button>
                </div>
                <Button
                  onClick={markFullyPaid}
                  size="sm"
                  variant="default"
                  disabled={detailDue - detailPaid === 0}
                  className="font-bengali w-full mt-2 gap-1 bg-primary hover:bg-primary/90"
                >
                  <Check className="h-4 w-4" /> Done — সম্পূর্ণ পরিশোধিত ({newMethod === 'bikash' ? 'বিকাশ' : 'নগদ'})
                  {detailDue - detailPaid !== 0 && (
                    <span className="ml-1 text-xs opacity-90">
                      ({detailDue - detailPaid > 0 ? '+' : '−'}৳{Math.abs(detailDue - detailPaid).toFixed(0)})
                    </span>
                  )}
                </Button>
              </div>


              <Separator />

              {/* Payment history */}
              <div>
                <Label className="font-bengali text-sm font-semibold flex items-center gap-1 mb-2">
                  <History className="h-4 w-4" /> পেমেন্ট ইতিহাস ({memberPayments.length})
                </Label>
                {memberPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-bengali text-center py-4">কোনো পেমেন্ট নেই</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {memberPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border p-2">
                        {editingPaymentId === p.id ? (
                          <div className="flex items-center gap-2 flex-1 flex-wrap">
                            <Input
                              type="number"
                              value={editAmount}
                              onChange={e => setEditAmount(e.target.value)}
                              className="h-8 w-24"
                              onKeyDown={e => e.key === 'Enter' && updatePayment(p.id)}
                            />
                            <Select value={editMethod} onValueChange={(v: 'cash' | 'bikash') => setEditMethod(v)}>
                              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash" className="font-bengali text-xs">নগদ</SelectItem>
                                <SelectItem value="bikash" className="font-bengali text-xs">বিকাশ</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => updatePayment(p.id)}>
                              <Check className="h-4 w-4 text-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingPaymentId(null); setEditAmount(''); }}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              {(p.payment_method || 'cash') === 'bikash'
                                ? <Smartphone className="h-4 w-4 text-pink-500 shrink-0" />
                                : <Banknote className="h-4 w-4 text-primary shrink-0" />}
                              <div>
                                <p className={`text-sm font-bold ${Number(p.amount) < 0 ? 'text-destructive' : (p.payment_method === 'bikash' ? 'text-pink-600' : 'text-primary')}`}>
                                  {Number(p.amount) < 0 ? '−' : ''}৳{Math.abs(Number(p.amount)).toFixed(0)}
                                  <span className="ml-1 text-[10px] font-normal text-muted-foreground font-bengali">
                                    {(p.payment_method || 'cash') === 'bikash' ? '(বিকাশ)' : '(নগদ)'}
                                  </span>
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(p.created_at), 'dd/MM/yyyy hh:mm a')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => { setEditingPaymentId(p.id); setEditAmount(String(p.amount)); setEditMethod((p.payment_method || 'cash') as 'cash' | 'bikash'); }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDeletePaymentClick(p.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total paid breakdown */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-bengali">মোট জমা</p>
                  <p className="text-base font-bold text-primary">৳{detailPaid.toFixed(0)}</p>
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-bengali flex items-center justify-center gap-1"><Banknote className="h-3 w-3" /> নগদ</p>
                  <p className="text-base font-bold text-primary">৳{detailCash.toFixed(0)}</p>
                </div>
                <div className="rounded-lg bg-pink-500/5 border border-pink-500/20 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground font-bengali flex items-center justify-center gap-1"><Smartphone className="h-3 w-3" /> বিকাশ</p>
                  <p className="text-base font-bold text-pink-600">৳{detailBikash.toFixed(0)}</p>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingMealSave} onOpenChange={(open) => { if (!open) setPendingMealSave(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bengali">মিল কাউন্ট পরিবর্তন নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription className="font-bengali">
              <span className="font-semibold">{pendingMealSave?.name}</span> এর মিল কাউন্ট{' '}
              <span className="font-bold text-destructive">{pendingMealSave?.oldCount}</span> থেকে{' '}
              <span className="font-bold text-primary">{pendingMealSave?.newCount}</span> এ পরিবর্তন করা হবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bengali">বাতিল</AlertDialogCancel>
            <AlertDialogAction className="font-bengali" onClick={saveMealCountOverride}>সেভ করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDeletePaymentId} onOpenChange={(open) => { if (!open) setPendingDeletePaymentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bengali">পেমেন্ট ডিলিট নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription className="font-bengali">
              আপনি কি নিশ্চিতভাবে এই পেমেন্টটি ডিলিট করতে চান? এই কাজটি আর ফিরিয়ে আনা যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bengali">বাতিল</AlertDialogCancel>
            <AlertDialogAction className="font-bengali bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeletePayment}>ডিলিট করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calculator, Search, TrendingUp, TrendingDown, Minus, ChevronRight, Sun, Moon, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, getDay } from 'date-fns';
import { getMealMonthDateRange } from '@/lib/mealMonth';
import { sortByRoll } from '@/lib/sortMembers';

const EXTRA_OPTIONS_MAP: Record<string, string> = {
  beef: 'গরু', mutton: 'খাসি', chicken: 'গরু/খাসির পরিবর্তে মুরগি',
  egg_fish_fry: 'ডিম ভাজি(মাছ)', egg_fish_poach: 'ডিম পোচ(মাছ)',
  egg_chicken_fry: 'ডিম ভাজি(পোল্ট্রি)', egg_chicken_poach: 'ডিম পোচ(পোল্ট্রি)',
  egg_instead_of_fish: 'ডিম(মাছ)', egg_instead_of_chicken: 'ডিম(পোল্ট্রি)',
  egg_fry: 'ডিম ভাজি', egg_poach: 'ডিম পোচ',
};

const DAY_NAMES_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const MONTH_PAGE_SIZE = 1000;

const fetchMonthRows = async (table: 'daily_meals' | 'extra_meals', columns: string, startDate: string, endDate: string) => {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte('meal_date', startDate)
      .lte('meal_date', endDate)
      .order('meal_date')
      .order('user_id')
      .order('id')
      .range(from, from + MONTH_PAGE_SIZE - 1);

    if (error) throw error;
    const rows = data || [];
    allRows.push(...rows);
    if (rows.length < MONTH_PAGE_SIZE) break;
    from += MONTH_PAGE_SIZE;
  }

  return allRows;
};

type PrevMonthData = {
  month: any;
  mealMap: Map<string, number>;
  paidMap: Map<string, number>;
  rate: number;
  extraCharge: number;
};

export default function BillingManagement() {
  const { user, isManager, isAdmin, isHistoricalManager } = useAuth();
  const isOnlyHistoricalManager = isHistoricalManager && !isManager && !isAdmin;
  const [members, setMembers] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [rawMeals, setRawMeals] = useState<any[]>([]);
  const [rawExtras, setRawExtras] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [mealMonth, setMealMonth] = useState<any>(null);
  const [allMonths, setAllMonths] = useState<any[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<string>('');
  const [prevMonthData, setPrevMonthData] = useState<PrevMonthData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingMealUserId, setEditingMealUserId] = useState<string | null>(null);
  const [editMealCount, setEditMealCount] = useState('');
  const [pendingSave, setPendingSave] = useState<{ userId: string; oldCount: number; newCount: number; name: string } | null>(null);

  const now = new Date();

  const sortMonthsChronologically = (list: any[]) => {
    // Newest first by start_date (fallback to year/month, then created_at)
    return [...list].sort((a, b) => {
      const aKey = a.start_date || `${a.year}-${String(a.month).padStart(2, '0')}-01`;
      const bKey = b.start_date || `${b.year}-${String(b.month).padStart(2, '0')}-01`;
      if (aKey !== bKey) return bKey.localeCompare(aKey);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  };

  const fetchAllMonths = useCallback(async () => {
    let query = supabase.from('meal_months').select('*');
    if (isOnlyHistoricalManager) {
      query = query.eq('manager_user_id', user?.id);
    }
    const { data } = await query;
    const months = sortMonthsChronologically(data || []);
    setAllMonths(months);
    return months;
  }, [isOnlyHistoricalManager, user]);

  const fetchPrevMonthData = useCallback(async (currentMonth: any, months: any[]) => {
    // Find the month just before the current one chronologically (by start_date)
    const sorted = sortMonthsChronologically(months);
    const currentIdx = sorted.findIndex((m: any) => m.id === currentMonth.id);
    const prevMonth = currentIdx >= 0 && currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null;

    if (!prevMonth) {
      setPrevMonthData(null);
      return;
    }

    const { start: sd, end: ed } = getMealMonthDateRange(prevMonth, now);

    const [mealsRes, extraRes, paymentsRes, balancesRes] = await Promise.all([
      fetchMonthRows('daily_meals', 'user_id, lunch, dinner, meal_date', sd, ed),
      fetchMonthRows('extra_meals', 'user_id, quantity, meal_count_equivalent, meal_date', sd, ed),
      supabase.from('payments').select('user_id, amount').eq('month_id', prevMonth.id),
      supabase.from('member_balances').select('user_id, meal_count_override').eq('month_id', prevMonth.id),
    ]);

    const mealMap = new Map<string, number>();
    mealsRes.forEach((m: any) => {
      const count = (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0);
      mealMap.set(m.user_id, (mealMap.get(m.user_id) || 0) + count);
    });
    extraRes.forEach((e: any) => {
      mealMap.set(e.user_id, (mealMap.get(e.user_id) || 0) + e.quantity * e.meal_count_equivalent);
    });
    (balancesRes.data || []).forEach((b: any) => {
      if (b.meal_count_override !== null && b.meal_count_override !== undefined) {
        mealMap.set(b.user_id, Number(b.meal_count_override));
      }
    });

    const paidMap = new Map<string, number>();
    (paymentsRes.data || []).forEach((p: any) => {
      paidMap.set(p.user_id, (paidMap.get(p.user_id) || 0) + Number(p.amount));
    });

    setPrevMonthData({
      month: prevMonth,
      mealMap,
      paidMap,
      rate: Number(prevMonth.meal_rate) || 0,
      extraCharge: Number(prevMonth.extra_charge ?? 0),
    });
  }, []);

  const fetchDataForMonth = useCallback(async (month: any, months?: any[]) => {
    if (!month) return;
    setMealMonth(month);

    const { start: startOfMonth, end: endOfMonth } = getMealMonthDateRange(month, now);

    const [membersRes, mealsRes, extraRes, paymentsRes, balancesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      fetchMonthRows('daily_meals', 'user_id, lunch, dinner, lunch_extra_option, dinner_extra_option, meal_date', startOfMonth, endOfMonth),
      fetchMonthRows('extra_meals', 'user_id, quantity, meal_count_equivalent, meal_type, meal_date, is_feast_day', startOfMonth, endOfMonth),
      supabase.from('payments').select('user_id, amount').eq('month_id', month.id),
      supabase.from('member_balances').select('user_id, meal_count_override').eq('month_id', month.id),
    ]);

    setMembers(membersRes.data || []);
    setRawMeals(mealsRes || []);
    setRawExtras(extraRes || []);

    const userMealMap = new Map<string, number>();
    mealsRes.forEach(m => {
      const count = (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0);
      userMealMap.set(m.user_id, (userMealMap.get(m.user_id) || 0) + count);
    });
    extraRes.forEach(e => {
      userMealMap.set(e.user_id, (userMealMap.get(e.user_id) || 0) + e.quantity * e.meal_count_equivalent);
    });
    (balancesRes.data || []).forEach((b: any) => {
      if (b.meal_count_override !== null && b.meal_count_override !== undefined) {
        userMealMap.set(b.user_id, Number(b.meal_count_override));
      }
    });
    setMeals(Array.from(userMealMap.entries()).map(([user_id, total]) => ({ user_id, total })));

    setPayments(paymentsRes.data || []);

    // Fetch previous month data
    const monthsList = months || allMonths;
    fetchPrevMonthData(month, monthsList);
  }, [allMonths]);

  useEffect(() => {
    (async () => {
      const months = await fetchAllMonths();
      const active = months.find((m: any) => m.is_active) || months[0];
      if (active) {
        setSelectedMonthId(active.id);
        fetchDataForMonth(active, months);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedMonthId && allMonths.length > 0) {
      const month = allMonths.find(m => m.id === selectedMonthId);
      if (month) fetchDataForMonth(month, allMonths);
    }
  }, [selectedMonthId]);

  useEffect(() => {
    const channel = supabase
      .channel('billing-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => { if (mealMonth) fetchDataForMonth(mealMonth); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_meals' }, () => { if (mealMonth) fetchDataForMonth(mealMonth); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extra_meals' }, () => { if (mealMonth) fetchDataForMonth(mealMonth); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_months' }, () => { fetchAllMonths(); if (mealMonth) fetchDataForMonth(mealMonth); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mealMonth, fetchDataForMonth]);

  const canEdit = isManager || isAdmin;

  const saveMealCountOverride = async (userId: string, newCount: number) => {
    if (!mealMonth) return;
    const { error } = await supabase.from('member_balances').upsert({
      user_id: userId,
      month_id: mealMonth.id,
      meal_count_override: newCount,
    } as any, { onConflict: 'user_id,month_id' });
    if (error) toast.error(error.message);
    else {
      toast.success('মিল কাউন্ট আপডেট হয়েছে');
      setMeals(prev => prev.map(m => m.user_id === userId ? { ...m, total: newCount } : m));
    }
    setEditingMealUserId(null);
  };

  const mealRate = mealMonth ? Number(mealMonth.meal_rate) : 0;
  const extraCharge = mealMonth ? Number(mealMonth.extra_charge ?? 0) : 0;
  const minMeals = mealMonth ? Number((mealMonth as any).min_meals ?? 0) : 0;
  const prevMinMeals = prevMonthData?.month ? Number((prevMonthData.month as any).min_meals ?? 0) : 0;

  const mealMap = useMemo(() => {
    const map = new Map<string, number>();
    meals.forEach(m => map.set(m.user_id, m.total));
    return map;
  }, [meals]);

  const paidMap = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach(p => {
      map.set(p.user_id, (map.get(p.user_id) || 0) + Number(p.amount));
    });
    return map;
  }, [payments]);

  const filteredMembers = useMemo(() => {
    return sortByRoll(members.filter(m => {
      const matchSearch = !searchQuery || m.full_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchYear = filterYear === 'all' || m.year === filterYear;
      const matchGender = filterGender === 'all' || m.gender === filterGender;
      return matchSearch && matchYear && matchGender;
    }));
  }, [members, searchQuery, filterYear, filterGender]);

  const getMonthLabel = (m: any) => {
    if (m?.start_date && m?.end_date) {
      return `${format(new Date(m.start_date), 'dd MMM')} — ${format(new Date(m.end_date), 'dd MMM yyyy')}`;
    }
    return m ? `${m.year}-${String(m.month).padStart(2, '0')}` : '';
  };

  const prevLabel = prevMonthData?.month ? getMonthLabel(prevMonthData.month) : null;

  return (
    <>
    <Card className="holo-card animate-fade-in-up overflow-hidden">
      <CardHeader>
        <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
          <Calculator className="h-5 w-5 text-primary animate-float" /> মাসিক হিসাব
        </CardTitle>
        <div className="mt-2">
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
      </CardHeader>
      <CardContent className="space-y-4">
        {!mealMonth && <p className="text-muted-foreground font-bengali text-center py-8">কোনো মাস নেই।</p>}
        {mealMonth && (
          <>
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
            </div>

            {/* Member Cards — two sections: prev month + current month */}
            <div className="space-y-3">
              {filteredMembers.map(m => {
                const rawUserMeals = mealMap.get(m.user_id) || 0;
                const userMeals = minMeals > 0 && rawUserMeals < minMeals ? minMeals : rawUserMeals;
                const cost = userMeals * mealRate + extraCharge;
                const paid = paidMap.get(m.user_id) || 0;

                // Previous month data
                const rawPrevMeals = prevMonthData?.mealMap.get(m.user_id) || 0;
                const prevMeals = prevMinMeals > 0 && rawPrevMeals < prevMinMeals ? prevMinMeals : rawPrevMeals;
                const prevPaid = prevMonthData?.paidMap.get(m.user_id) || 0;
                const prevRate = prevMonthData?.rate || 0;
                const prevExtra = prevMonthData?.extraCharge || 0;
                const prevCost = prevMeals * prevRate + (prevMeals > 0 ? prevExtra : 0);
                const prevBalance = prevPaid - prevCost; // positive = overpaid (পাবে), negative = owes (বকেয়া)
                const hasPrevMonth = !!prevMonthData?.month;

                return (
                  <Card key={m.user_id} className="cursor-pointer card-hover card-shine transition-all duration-500 hover:shadow-xl hover:shadow-primary/10" onClick={() => setSelectedUserId(m.user_id)}>
                    <CardContent className="p-3 sm:p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium font-bengali">{m.full_name}</span>
                          <Badge variant="outline" className="text-[10px]">{m.year}</Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* আগের মাসের হিসাব */}
                        {hasPrevMonth && (
                          <div className="rounded-lg border border-dashed p-2.5 bg-muted/30">
                            <p className="text-[10px] font-bengali text-muted-foreground font-semibold mb-1.5 uppercase tracking-wide">
                              পূর্ববর্তী মাস {prevLabel && `(${prevLabel})`}
                            </p>
                            <div className="space-y-0.5 text-xs font-bengali">
                              <div className="flex justify-between">
                                <span>মিল:</span>
                                <span className="font-bold">{prevMeals}</span>
                              </div>
                              {prevRate > 0 && (
                                <>
                                  <div className="flex justify-between">
                                    <span>রেট:</span>
                                    <span>৳{prevRate.toFixed(0)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>খরচ:</span>
                                    <span>৳{prevCost.toFixed(0)}</span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between">
                                <span>জমা:</span>
                                <span className="text-primary font-bold">৳{prevPaid.toFixed(0)}</span>
                              </div>
                              <Separator className="my-1" />
                              <div className="flex justify-between font-bold">
                                <span>{prevBalance >= 0 ? 'পাবে:' : 'বকেয়া:'}</span>
                                <span className={prevBalance >= 0 ? 'text-primary' : 'text-destructive'}>
                                  ৳{Math.abs(prevBalance).toFixed(0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* এই মাসের হিসাব */}
                        <div className="rounded-lg border p-2.5 bg-background">
                          <p className="text-[10px] font-bengali text-muted-foreground font-semibold mb-1.5 uppercase tracking-wide">
                            এই মাস {getMonthLabel(mealMonth) && `(${getMonthLabel(mealMonth)})`}
                          </p>
                          <div className="space-y-0.5 text-xs font-bengali">
                            <div className="flex justify-between">
                              <span>মিল:</span>
                              <span className="inline-flex items-center gap-1 font-bold">
                                {canEdit && editingMealUserId === m.user_id ? (
                                  <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <Input
                                      type="number"
                                      value={editMealCount}
                                      onChange={e => setEditMealCount(e.target.value)}
                                      className="w-14 h-6 text-center text-xs"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const n = parseInt(editMealCount) || 0;
                                          setPendingSave({ userId: m.user_id, oldCount: userMeals, newCount: n, name: m.full_name || '' });
                                        } else if (e.key === 'Escape') {
                                          setEditingMealUserId(null);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="text-primary hover:text-primary/80"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const n = parseInt(editMealCount) || 0;
                                        setPendingSave({ userId: m.user_id, oldCount: userMeals, newCount: n, name: m.full_name || '' });
                                      }}
                                      title="সেভ"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setEditingMealUserId(null); }}
                                      title="বাতিল"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                ) : (
                                  <>
                                    {userMeals}
                                    {canEdit && (
                                      <button type="button" className="text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); setEditingMealUserId(m.user_id); setEditMealCount(String(userMeals)); }}>
                                        <Edit2 className="h-2.5 w-2.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </span>
                            </div>
                            {mealRate > 0 && (
                              <div className="flex justify-between">
                                <span>খরচ (মিল×৳{mealRate.toFixed(0)}{extraCharge > 0 ? `+৳${extraCharge.toFixed(0)}` : ''}):</span>
                                <span>৳{cost.toFixed(0)}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span>জমা:</span>
                              <span className="text-primary font-bold">৳{paid.toFixed(0)}</span>
                            </div>
                            {mealRate > 0 && (
                              <>
                                <Separator className="my-1" />
                                <div className="flex justify-between font-bold">
                                  <span>{paid >= cost ? (paid === cost ? 'সমান' : 'বেশি:') : 'কম:'}</span>
                                  {paid !== cost && (
                                    <span className={paid >= cost ? 'text-primary' : 'text-destructive'}>
                                      ৳{Math.abs(paid - cost).toFixed(0)}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredMembers.length === 0 && (
                <p className="text-center text-muted-foreground font-bengali py-8">কোনো সদস্য নেই</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedUserId} onOpenChange={() => setSelectedUserId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-bengali">
              {members.find(m => m.user_id === selectedUserId)?.full_name} — দৈনিক মিল বিবরণ
            </DialogTitle>
          </DialogHeader>
          {selectedUserId && (() => {
            const userDailyMeals = rawMeals.filter(m => m.user_id === selectedUserId);
            const userExtras = rawExtras.filter(e => e.user_id === selectedUserId);
            const mealsByDate = new Map(userDailyMeals.map(m => [m.meal_date, m]));

            // Build full date range for the selected meal month
            const sortedDates: string[] = [];
            if (mealMonth) {
              const range = getMealMonthDateRange(mealMonth, now);
              let cursor = new Date(`${range.start}T00:00:00`);
              const monthEnd = new Date(`${range.end}T00:00:00`);
              const today = new Date(new Date().setHours(0, 0, 0, 0));
              const tomorrow = new Date(today.getTime() + 86400000);
              // Past months → full range; current/future → cap at tomorrow.
              const effectiveEnd = monthEnd < today ? monthEnd : new Date(Math.min(monthEnd.getTime(), tomorrow.getTime()));
              while (cursor <= effectiveEnd) {
                sortedDates.push(format(cursor, 'yyyy-MM-dd'));
                cursor = new Date(cursor.getTime() + 86400000);
              }
            }
            if (sortedDates.length === 0) {
              const all = new Set<string>();
              userDailyMeals.forEach(m => all.add(m.meal_date));
              userExtras.forEach(e => all.add(e.meal_date));
              sortedDates.push(...Array.from(all).sort());
            }

            const totalRegular = userDailyMeals.reduce((a, m) => a + (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0), 0);
            const totalExtra = userExtras.reduce((a, e) => a + Number(e.quantity) * Number(e.meal_count_equivalent), 0);

            return (
              <div className="space-y-3">
                <div className="flex gap-3 text-sm font-bengali">
                  <Badge variant="outline">রেগুলার: {totalRegular}</Badge>
                  <Badge variant="outline">এক্সট্রা: {totalExtra}</Badge>
                  <Badge>মোট: {totalRegular + totalExtra}</Badge>
                </div>
                <div className="rounded-lg border overflow-auto">
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
                      {sortedDates.map(dateStr => {
                        const m: any = mealsByDate.get(dateStr) || { meal_date: dateStr, lunch: false, dinner: false, lunch_extra_option: '' };
                        const d = new Date(`${dateStr}T00:00:00`);
                        const dayIdx = getDay(d);
                        const isFeast = dayIdx === 1 || dayIdx === 5;
                        const extras = (m.lunch_extra_option || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                        const extraLabels = extras.map((v: string) => EXTRA_OPTIONS_MAP[v] || v);
                        const dayExtras = userExtras.filter(e => e.meal_date === dateStr);
                        const regCount = (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0);
                        const exCount = dayExtras.reduce((a, e) => a + Number(e.quantity) * Number(e.meal_count_equivalent), 0);
                        const dayTotal = regCount + exCount;

                        return (
                          <TableRow key={dateStr} className={isFeast ? 'bg-destructive/5' : ''}>
                            <TableCell className="text-xs py-1">{format(d, 'dd/MM')}</TableCell>
                            <TableCell className="text-center text-xs py-1 font-bengali">{DAY_NAMES_BN[dayIdx]}</TableCell>
                            <TableCell className="text-center py-1">
                              {m.lunch ? <span className="text-primary font-bold">✓</span> : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center py-1">
                              {m.dinner ? <span className="text-primary font-bold">✓</span> : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-xs py-1">
                              {extraLabels.length > 0 && (
                                <div className="font-bengali text-[10px] text-muted-foreground">{extraLabels.join(', ')}</div>
                              )}
                              {dayExtras.map(de => (
                                <Badge key={dateStr + de.meal_type} variant="secondary" className="text-[10px] mr-1 mt-0.5">
                                  {de.meal_type === 'lunch' ? 'L' : 'D'}+{de.quantity}{Number(de.meal_count_equivalent) !== 1 ? `×${de.meal_count_equivalent}` : ''}={Number(de.quantity) * Number(de.meal_count_equivalent)}
                                </Badge>
                              ))}
                            </TableCell>
                            <TableCell className="text-center py-1">
                              <Badge variant={isFeast ? 'destructive' : 'outline'} className="text-[10px] font-bold">{dayTotal}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingSave} onOpenChange={(open) => !open && setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bengali">মিল কাউন্ট সেভ করবেন?</AlertDialogTitle>
            <AlertDialogDescription className="font-bengali">
              <span className="font-semibold">{pendingSave?.name}</span> — মিল কাউন্ট{' '}
              <span className="font-bold">{pendingSave?.oldCount}</span> থেকে{' '}
              <span className="font-bold text-primary">{pendingSave?.newCount}</span> এ পরিবর্তন হবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bengali">বাতিল</AlertDialogCancel>
            <AlertDialogAction
              className="font-bengali"
              onClick={async () => {
                if (pendingSave) {
                  await saveMealCountOverride(pendingSave.userId, pendingSave.newCount);
                  setPendingSave(null);
                }
              }}
            >
              সেভ করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

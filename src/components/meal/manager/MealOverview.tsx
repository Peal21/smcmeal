import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, addDays, getDay } from 'date-fns';
import { Utensils, Sun, Moon, Users, Calendar, Search, Plus, Minus, Edit2 } from 'lucide-react';
import { fetchResolvedMealMonth, getMealMonthDateRange } from '@/lib/mealMonth';
import { sortByRoll } from '@/lib/sortMembers';

const MONTH_QUERY_LIMIT = 10000;

const EXTRA_OPTIONS_MAP: Record<string, string> = {
  beef: 'গরু',
  mutton: 'খাসি',
  chicken: 'গরু/খাসির পরিবর্তে মুরগি',
  egg_fish_fry: 'ডিম ভাজি(মাছ)',
  egg_fish_poach: 'ডিম পোচ(মাছ)',
  egg_chicken_fry: 'ডিম ভাজি(পোল্ট্রি)',
  egg_chicken_poach: 'ডিম পোচ(পোল্ট্রি)',
  // Legacy keys for backward compat
  egg_instead_of_fish: 'ডিম(মাছ)',
  egg_instead_of_chicken: 'ডিম(পোল্ট্রি)',
  egg_fry: 'ডিম ভাজি',
  egg_poach: 'ডিম পোচ',
};

const ALL_EXTRA_OPTIONS = [
  { value: 'beef', label: 'গরু' },
  { value: 'mutton', label: 'খাসি' },
  { value: 'chicken', label: 'গরু/খাসির পরিবর্তে মুরগি' },
  { value: 'egg_fish_fry', label: 'ডিম ভাজি (মাছ)', group: 'egg_fish' },
  { value: 'egg_fish_poach', label: 'ডিম পোচ (মাছ)', group: 'egg_fish' },
  { value: 'egg_chicken_fry', label: 'ডিম ভাজি (পোল্ট্রি)', group: 'egg_chicken' },
  { value: 'egg_chicken_poach', label: 'ডিম পোচ (পোল্ট্রি)', group: 'egg_chicken' },
];

const EGG_GROUPS: Record<string, string[]> = {
  egg_fish: ['egg_fish_fry', 'egg_fish_poach'],
  egg_chicken: ['egg_chicken_fry', 'egg_chicken_poach'],
};

const parseOptionLabels = (raw?: string | null): string[] =>
  (raw ?? '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => EXTRA_OPTIONS_MAP[v] || v);

export default function MealOverview() {
  const { user, isManager, isAdmin } = useAuth();
  const [stats, setStats] = useState({ totalLunch: 0, totalDinner: 0, totalMembers: 0, monthTotalMeals: 0 });
  const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [dateMeals, setDateMeals] = useState<any[]>([]);
  const [dateExtras, setDateExtras] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStats = async () => {
    const now = new Date();
    const { data: mm } = await fetchResolvedMealMonth(now);
    const { start: startOfMonth, end: endOfMonth } = getMealMonthDateRange(mm, now);

    const [mealsRes, membersRes, monthMealsRes, monthExtrasRes] = await Promise.all([
      supabase.from('daily_meals').select('lunch, dinner').eq('meal_date', selectedDate),
      supabase.from('profiles').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('daily_meals').select('lunch, dinner, meal_date').gte('meal_date', startOfMonth).lte('meal_date', endOfMonth).limit(MONTH_QUERY_LIMIT),
      supabase.from('extra_meals').select('quantity, meal_count_equivalent').gte('meal_date', startOfMonth).lte('meal_date', endOfMonth).limit(MONTH_QUERY_LIMIT),
    ]);

    const meals = mealsRes.data || [];
    const totalLunch = meals.filter(m => m.lunch).length;
    const totalDinner = meals.filter(m => m.dinner).length;
    const regularMeals = (monthMealsRes.data || []).reduce((a, m) => a + (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0), 0);
    const extraMeals = (monthExtrasRes.data || []).reduce((a, e) => a + (e.quantity * e.meal_count_equivalent), 0);

    setStats({ totalLunch, totalDinner, totalMembers: membersRes.count || 0, monthTotalMeals: regularMeals + extraMeals });
  };

  const fetchDateMeals = async () => {
    const [{ data: meals }, { data: profs }, { data: extras }] = await Promise.all([
      supabase.from('daily_meals').select('*').eq('meal_date', selectedDate),
      supabase.from('profiles').select('user_id, full_name, year, roll_number').eq('is_active', true).order('full_name'),
      supabase.from('extra_meals').select('*').eq('meal_date', selectedDate),
    ]);
    setDateMeals(meals || []);
    setProfiles(profs || []);
    setDateExtras(extras || []);
  };

  useEffect(() => { fetchStats(); fetchDateMeals(); }, [selectedDate]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_meals' }, () => { fetchStats(); fetchDateMeals(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extra_meals' }, () => { fetchStats(); fetchDateMeals(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_months' }, () => { fetchStats(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { fetchDateMeals(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const managerToggleMeal = async (userId: string, mealDate: string, type: 'lunch' | 'dinner', value: boolean) => {
    if (!isManager && !isAdmin) return;
    const existing = dateMeals.find(m => m.user_id === userId);
    const updatePayload = type === 'lunch' ? { lunch: value } : { dinner: value };
    if (existing) {
      await supabase.from('daily_meals').update(updatePayload).eq('id', existing.id);
    } else {
      const insertPayload = type === 'lunch'
        ? { user_id: userId, meal_date: mealDate, lunch: value }
        : { user_id: userId, meal_date: mealDate, dinner: value };
      await supabase.from('daily_meals').insert(insertPayload);
    }
    toast.success('মিল আপডেট হয়েছে');
    fetchDateMeals();
    fetchStats();
  };

  const isFeastDay = (dateStr: string) => {
    const day = getDay(new Date(dateStr));
    return day === 1 || day === 5;
  };

  const addExtraMeal = async (userId: string, mealType: 'lunch' | 'dinner') => {
    if (!user) return;
    const feast = isFeastDay(selectedDate);
    const { error } = await supabase.from('extra_meals').insert({
      user_id: userId,
      meal_date: selectedDate,
      meal_type: mealType,
      quantity: 1,
      reason: 'guest',
      is_feast_day: feast,
      meal_count_equivalent: feast ? 3 : 1,
      added_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Extra মিল যোগ হয়েছে');
      fetchDateMeals();
      fetchStats();
    }
  };

  const updateExtraQuantity = async (extraId: string, newQty: number) => {
    if (newQty < 1) {
      const { error } = await supabase.from('extra_meals').delete().eq('id', extraId);
      if (error) toast.error(error.message);
      else {
        toast.success('Extra মিল মুছে ফেলা হয়েছে');
        fetchDateMeals();
        fetchStats();
      }
      return;
    }

    const { error } = await supabase.from('extra_meals').update({ quantity: newQty }).eq('id', extraId);
    if (error) toast.error(error.message);
    else {
      toast.success('আপডেট হয়েছে');
      fetchDateMeals();
      fetchStats();
    }
  };

  const mealMap = new Map(dateMeals.map(m => [m.user_id, m]));

  const extrasMap = new Map<string, any[]>();
  dateExtras.forEach(e => {
    const list = extrasMap.get(e.user_id) || [];
    list.push(e);
    extrasMap.set(e.user_id, list);
  });

  const filteredProfiles = sortByRoll(profiles.filter(p => !searchQuery || p.full_name.toLowerCase().includes(searchQuery.toLowerCase())));
  const canEdit = isManager || isAdmin;

  const managerToggleExtra = async (userId: string, mealType: 'lunch' | 'dinner', value: string, checked: boolean) => {
    const existing = dateMeals.find(m => m.user_id === userId);
    const existingOption = mealType === 'lunch' ? existing?.lunch_extra_option : existing?.dinner_extra_option;
    let current: string[] = existingOption ? Array.from(new Set(existingOption.split(',').map((s: string) => s.trim()).filter(Boolean))) : [];

    if (checked) {
      const option = ALL_EXTRA_OPTIONS.find(o => o.value === value);
      const group = (option as any)?.group;
      if (group && EGG_GROUPS[group]) {
        current = current.filter((v: string) => !EGG_GROUPS[group].includes(v));
      }
      current.push(value);
    } else {
      current = current.filter((v: string) => v !== value);
    }

    const stored = current.length > 0 ? current.join(',') : null;
    const updatePayload = mealType === 'lunch' ? { lunch_extra_option: stored } : { dinner_extra_option: stored };
    const insertPayload = mealType === 'lunch'
      ? { user_id: userId, meal_date: selectedDate, lunch_extra_option: stored }
      : { user_id: userId, meal_date: selectedDate, dinner_extra_option: stored };

    if (existing) {
      await supabase.from('daily_meals').update(updatePayload).eq('id', existing.id);
    } else {
      await supabase.from('daily_meals').insert(insertPayload);
    }
    toast.success('Extra item আপডেট হয়েছে');
    fetchDateMeals();
    fetchStats();
  };

  return (
    <div className="space-y-6 page-enter">
      <h2 className="text-xl font-bold font-bengali gradient-text-hero inline-block">সারসংক্ষেপ</h2>

      <div className="flex items-center gap-3 flex-wrap">
        <Calendar className="h-5 w-5 text-primary" />
        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
        <Badge variant="outline" className="font-bengali">{format(new Date(selectedDate), 'dd MMMM yyyy')}</Badge>
        {isFeastDay(selectedDate) && <Badge variant="destructive" className="font-bengali">Feast Day</Badge>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
        <Card className="card-hover card-shine overflow-hidden group">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-accent/20">
              <Sun className="h-6 w-6 text-accent transition-transform group-hover:rotate-45 duration-500" />
            </div>
            <p className="text-3xl font-bold stat-number">{stats.totalLunch}</p>
            <p className="text-sm text-muted-foreground font-bengali">লাঞ্চ ({format(new Date(selectedDate), 'dd/MM')})</p>
          </CardContent>
        </Card>
        <Card className="card-hover card-shine overflow-hidden group">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-info/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-info/20">
              <Moon className="h-6 w-6 text-info transition-transform group-hover:-rotate-12 duration-500" />
            </div>
            <p className="text-3xl font-bold stat-number" style={{ animationDelay: '0.1s' }}>{stats.totalDinner}</p>
            <p className="text-sm text-muted-foreground font-bengali">ডিনার ({format(new Date(selectedDate), 'dd/MM')})</p>
          </CardContent>
        </Card>
        <Card className="card-hover card-shine overflow-hidden group">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-warning/20">
              <Utensils className="h-6 w-6 text-warning transition-transform group-hover:scale-125 duration-500" />
            </div>
            <p className="text-3xl font-bold stat-number" style={{ animationDelay: '0.2s' }}>{stats.monthTotalMeals}</p>
            <p className="text-sm text-muted-foreground font-bengali">এই মাসে মোট মিল</p>
          </CardContent>
        </Card>
        <Card className="card-hover card-shine overflow-hidden group">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
              <Users className="h-6 w-6 text-primary transition-transform group-hover:scale-110 duration-500" />
            </div>
            <p className="text-3xl font-bold stat-number" style={{ animationDelay: '0.3s' }}>{stats.totalMembers}</p>
            <p className="text-sm text-muted-foreground font-bengali">মোট সদস্য</p>
          </CardContent>
        </Card>
      </div>

      <Card className="holo-card animate-fade-in-up overflow-hidden">
        <CardHeader>
          <CardTitle className="font-bengali text-lg">
            {format(new Date(selectedDate), 'dd MMMM yyyy')} — সদস্যদের মিল
          </CardTitle>
          {canEdit && (
            <p className="text-xs text-muted-foreground font-bengali">মিল চালু/বন্ধ ও Extra মিল যোগ/এডিট করতে পারবেন</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="নাম খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          <div className="rounded-lg border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bengali">নাম</TableHead>
                  <TableHead className="font-bengali text-center">Batch</TableHead>
                  <TableHead className="font-bengali text-center">লাঞ্চ</TableHead>
                  <TableHead className="font-bengali text-center">ডিনার</TableHead>
                  <TableHead className="font-bengali text-center">Extra L</TableHead>
                  <TableHead className="font-bengali text-center">Extra D</TableHead>
                  <TableHead className="font-bengali text-center">মোট</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredProfiles.map(p => {
                  const meal = mealMap.get(p.user_id);
                  const userExtras = extrasMap.get(p.user_id) || [];
                  const lunchExtras = userExtras.filter(e => e.meal_type === 'lunch');
                  const dinnerExtras = userExtras.filter(e => e.meal_type === 'dinner');
                  const extraLunchQty = lunchExtras.reduce((s, e) => s + e.quantity, 0);
                  const extraDinnerQty = dinnerExtras.reduce((s, e) => s + e.quantity, 0);
                  const extraMealEquiv = userExtras.reduce((s, e) => s + (e.quantity * e.meal_count_equivalent), 0);
                  const totalMeals = (meal?.lunch ? 1 : 0) + (meal?.dinner ? 1 : 0) + extraMealEquiv;
                  const lunchOptionLabels = parseOptionLabels(meal?.lunch_extra_option);
                  const dinnerOptionLabels = parseOptionLabels(meal?.dinner_extra_option);

                  return (
                    <TableRow key={p.user_id} className="transition-all duration-300 hover:bg-primary/5 animate-fade-in" style={{ animationDelay: `${filteredProfiles.indexOf(p) * 0.02}s` }}>
                      <TableCell className="font-bengali text-sm">
                        <div className="space-y-1">
                          <p>{p.full_name}</p>
                          {canEdit ? (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {/* Lunch Extra Item Popover */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] font-bengali gap-1 border-primary/20 hover:bg-primary/5">
                                    <Edit2 className="h-2.5 w-2.5" />
                                    L: {lunchOptionLabels.length > 0 ? lunchOptionLabels.join(', ') : 'বাছাই'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-3">
                                  <p className="text-xs font-bengali font-semibold mb-2">লাঞ্চ Extra Item:</p>
                                  <div className="space-y-2">
                                    {ALL_EXTRA_OPTIONS.map(o => {
                                      const currentExtras = meal?.lunch_extra_option ? Array.from(new Set(meal.lunch_extra_option.split(',').map((s: string) => s.trim()).filter(Boolean))) : [];
                                      return (
                                        <label key={o.value} className="flex items-center gap-2 text-sm font-bengali cursor-pointer">
                                          <Checkbox
                                            checked={currentExtras.includes(o.value)}
                                            onCheckedChange={(checked) => managerToggleExtra(p.user_id, 'lunch', o.value, !!checked)}
                                          />
                                          {o.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>

                              {/* Dinner Extra Item Popover */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] font-bengali gap-1 border-info/20 hover:bg-info/5">
                                    <Edit2 className="h-2.5 w-2.5" />
                                    D: {dinnerOptionLabels.length > 0 ? dinnerOptionLabels.join(', ') : 'বাছাই'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-3">
                                  <p className="text-xs font-bengali font-semibold mb-2">ডিনার Extra Item:</p>
                                  <div className="space-y-2">
                                    {ALL_EXTRA_OPTIONS.map(o => {
                                      const currentExtras = meal?.dinner_extra_option ? Array.from(new Set(meal.dinner_extra_option.split(',').map((s: string) => s.trim()).filter(Boolean))) : [];
                                      return (
                                        <label key={o.value} className="flex items-center gap-2 text-sm font-bengali cursor-pointer">
                                          <Checkbox
                                            checked={currentExtras.includes(o.value)}
                                            onCheckedChange={(checked) => managerToggleExtra(p.user_id, 'dinner', o.value, !!checked)}
                                          />
                                          {o.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          ) : (lunchOptionLabels.length > 0 || dinnerOptionLabels.length > 0) ? (
                            <div className="flex flex-wrap gap-1">
                              {lunchOptionLabels.map((label, idx) => (
                                <span
                                  key={`l-${p.user_id}-${idx}`}
                                  className="inline-flex items-center rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                                >
                                  L: {label}
                                </span>
                              ))}
                              {dinnerOptionLabels.map((label, idx) => (
                                <span
                                  key={`d-${p.user_id}-${idx}`}
                                  className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  D: {label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="text-center text-xs">{p.year}</TableCell>

                      <TableCell className="text-center">
                        {canEdit ? (
                          <Switch checked={meal?.lunch || false} onCheckedChange={v => managerToggleMeal(p.user_id, selectedDate, 'lunch', v)} />
                        ) : (
                          <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-border px-2 py-0.5 text-xs text-foreground">
                            {meal?.lunch ? 'L' : '—'}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {canEdit ? (
                          <Switch checked={meal?.dinner || false} onCheckedChange={v => managerToggleMeal(p.user_id, selectedDate, 'dinner', v)} />
                        ) : (
                          <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-border px-2 py-0.5 text-xs text-foreground">
                            {meal?.dinner ? 'D' : '—'}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {canEdit ? (
                          <div className="flex items-center justify-center gap-1">
                            {lunchExtras.length > 0 ? (
                              <>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateExtraQuantity(lunchExtras[0].id, lunchExtras[0].quantity - 1)}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-medium w-5 text-center">{extraLunchQty}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateExtraQuantity(lunchExtras[0].id, lunchExtras[0].quantity + 1)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => addExtraMeal(p.user_id, 'lunch')}>
                                <Plus className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{extraLunchQty > 0 ? `+${extraLunchQty}` : '—'}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {canEdit ? (
                          <div className="flex items-center justify-center gap-1">
                            {dinnerExtras.length > 0 ? (
                              <>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateExtraQuantity(dinnerExtras[0].id, dinnerExtras[0].quantity - 1)}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-medium w-5 text-center">{extraDinnerQty}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateExtraQuantity(dinnerExtras[0].id, dinnerExtras[0].quantity + 1)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => addExtraMeal(p.user_id, 'dinner')}>
                                <Plus className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{extraDinnerQty > 0 ? `+${extraDinnerQty}` : '—'}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <span className={`inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-0.5 text-xs ${totalMeals > 0 ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-muted text-muted-foreground'}`}>
                          {totalMeals}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

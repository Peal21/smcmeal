import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format, getDay } from 'date-fns';
import { Plus, CalendarIcon, Utensils, Trash2, Edit2, Check, X } from 'lucide-react';
import { fetchResolvedMealMonth, getMealMonthDateRange } from '@/lib/mealMonth';
import AdminDeleteConfirm from './AdminDeleteConfirm';
import { sortByRoll } from '@/lib/sortMembers';
import { Checkbox } from '@/components/ui/checkbox';

const MONTH_QUERY_LIMIT = 10000;

const EXTRA_LABEL_MAP: Record<string, string> = {
  beef: 'গরু', mutton: 'খাসি', chicken: 'মুরগি',
  egg_fish_fry: 'ডিম ভাজি(মাছ)', egg_fish_poach: 'ডিম পোচ(মাছ)',
  egg_chicken_fry: 'ডিম ভাজি(পোল্ট্রি)', egg_chicken_poach: 'ডিম পোচ(পোল্ট্রি)',
};
const EXTRA_OPTIONS_LIST = [
  { value: 'beef', label: 'গরু', group: 'meat' },
  { value: 'mutton', label: 'খাসি', group: 'meat' },
  { value: 'chicken', label: 'মুরগি', group: 'meat' },
  { value: 'egg_fish_fry', label: 'ডিম ভাজি(মাছ)', group: 'egg_fish' },
  { value: 'egg_fish_poach', label: 'ডিম পোচ(মাছ)', group: 'egg_fish' },
  { value: 'egg_chicken_fry', label: 'ডিম ভাজি(পোল্ট্রি)', group: 'egg_chicken' },
  { value: 'egg_chicken_poach', label: 'ডিম পোচ(পোল্ট্রি)', group: 'egg_chicken' },
];
const EXCLUSION_GROUPS_M: Record<string, string[]> = {
  meat: ['beef', 'mutton', 'chicken'],
  egg_fish: ['egg_fish_fry', 'egg_fish_poach'],
  egg_chicken: ['egg_chicken_fry', 'egg_chicken_poach'],
};

interface EditState {
  quantity: string;
  mealType: 'lunch' | 'dinner';
  reason: string;
  isFeastDay: boolean;
  mealCountEquivalent: string;
  mealDate: Date;
  extraOptions: string[];
}

export default function ExtraMealManager() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [mealType, setMealType] = useState<'lunch' | 'dinner'>('lunch');
  const [quantity, setQuantity] = useState('0');
  const [reason, setReason] = useState('guest');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [addExtraOptions, setAddExtraOptions] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    quantity: '1', mealType: 'lunch', reason: 'guest',
    isFeastDay: false, mealCountEquivalent: '1', mealDate: new Date(), extraOptions: [],
  });

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('extra-meals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'extra_meals' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_months' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const now = new Date();
    const { data: mm } = await fetchResolvedMealMonth(now);
    const { start: startOfMonth, end: endOfMonth } = getMealMonthDateRange(mm, now);

    const [membersRes, extrasRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, roll_number').eq('is_active', true).order('full_name'),
      supabase.from('extra_meals').select('*').gte('meal_date', startOfMonth).lte('meal_date', endOfMonth).order('created_at', { ascending: false }).limit(MONTH_QUERY_LIMIT),
    ]);
    const membersData = membersRes.data || [];
    const extrasData = extrasRes.data || [];
    const nameMap = new Map(membersData.map((m: any) => [m.user_id, m.full_name]));
    const extrasWithNames = extrasData.map((e: any) => ({ ...e, member_name: nameMap.get(e.user_id) || '—' }));
    setMembers(sortByRoll(membersData));
    setExtras(extrasWithNames);
  };

  const isFeastDay = (date: Date) => {
    const day = getDay(date);
    return day === 1 || day === 5;
  };

  const incAddExtra = (value: string) => {
    const qty = parseFloat(quantity) || 0;
    if (addExtraOptions.length >= qty) {
      toast.error(`সর্বোচ্চ ${qty}টি item`);
      return;
    }
    setAddExtraOptions(s => [...s, value]);
  };

  const decAddExtra = (value: string) => {
    setAddExtraOptions(s => {
      const idx = s.lastIndexOf(value);
      if (idx === -1) return s;
      const next = [...s];
      next.splice(idx, 1);
      return next;
    });
  };

  const addExtraMeal = async () => {
    if (!selectedMember || !user) return;
    const qty = parseFloat(quantity) || 0;
    if (qty < 1) { toast.error('সংখ্যা কমপক্ষে ১ হতে হবে'); return; }
    if (addExtraOptions.length !== qty) {
      toast.error(`${qty}টি serving — তাই ঠিক ${qty}টি item বাছাই করুন (এখন ${addExtraOptions.length}টি)`);
      return;
    }
    const feast = isFeastDay(selectedDate);
    const mealCountEquivalent = feast ? 3 : 1;

    const { error } = await supabase.from('extra_meals').insert({
      user_id: selectedMember,
      meal_date: format(selectedDate, 'yyyy-MM-dd'),
      meal_type: mealType,
      quantity: qty,
      reason,
      is_feast_day: feast,
      meal_count_equivalent: mealCountEquivalent,
      added_by: user.id,
      extra_option: addExtraOptions.join(',') || null,
    });

    if (error) toast.error(error.message);
    else {
      toast.success(`Extra মিল যোগ হয়েছে${feast ? ' (Feast Day — ১ মিল = ৩ মিল)' : ''}`);
      setQuantity('0');
      setSelectedMember('');
      setAddExtraOptions([]);
      fetchData();
    }
  };

  const deleteExtra = async (id: string) => {
    const { error } = await supabase.from('extra_meals').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('মুছে ফেলা হয়েছে'); fetchData(); }
  };

  const startEditing = (e: any) => {
    setEditingId(e.id);
    setEditState({
      quantity: String(e.quantity),
      mealType: e.meal_type,
      reason: e.reason || 'guest',
      isFeastDay: e.is_feast_day,
      mealCountEquivalent: String(e.meal_count_equivalent),
      mealDate: new Date(e.meal_date + 'T00:00:00'),
      extraOptions: (e.extra_option || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    });
  };

  const incEditExtra = (value: string) => {
    const qty = parseFloat(editState.quantity) || 0;
    if (editState.extraOptions.length >= qty) {
      toast.error(`সর্বোচ্চ ${qty}টি item`);
      return;
    }
    setEditState(s => ({ ...s, extraOptions: [...s.extraOptions, value] }));
  };

  const decEditExtra = (value: string) => {
    setEditState(s => {
      const idx = s.extraOptions.lastIndexOf(value);
      if (idx === -1) return s;
      const next = [...s.extraOptions];
      next.splice(idx, 1);
      return { ...s, extraOptions: next };
    });
  };

  const toggleEditExtraOption = (value: string, checked: boolean) => {
    if (checked) incEditExtra(value); else decEditExtra(value);
  };

  const updateExtra = async (id: string) => {
    const qty = parseFloat(editState.quantity) || 1;
    const mce = parseFloat(editState.mealCountEquivalent) || 1;
    if (editState.extraOptions.length !== qty) {
      toast.error(`${qty}টি serving — তাই ঠিক ${qty}টি item বাছাই করুন (এখন ${editState.extraOptions.length}টি)`);
      return;
    }
    const { error } = await supabase.from('extra_meals').update({
      quantity: qty,
      meal_type: editState.mealType,
      reason: editState.reason,
      is_feast_day: editState.isFeastDay,
      meal_count_equivalent: mce,
      meal_date: format(editState.mealDate, 'yyyy-MM-dd'),
      extra_option: editState.extraOptions.join(',') || null,
    } as any).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('আপডেট হয়েছে'); setEditingId(null); fetchData(); }
  };

  return (
    <div className="space-y-6 page-enter stagger-children">
      {/* Add Form */}
      <Card className="holo-card card-hover overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 animate-float">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            Extra মিল যোগ করুন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="font-bengali">সদস্য</Label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger><SelectValue placeholder="সদস্য নির্বাচন" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bengali">তারিখ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-bengali">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'dd MMM yyyy')}
                    {isFeastDay(selectedDate) && <Badge className="ml-2 font-bengali" variant="secondary">Feast</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={d => d && setSelectedDate(d)} /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="font-bengali">মিল টাইপ</Label>
              <Select value={mealType} onValueChange={v => setMealType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lunch">লাঞ্চ</SelectItem>
                  <SelectItem value="dinner">ডিনার</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bengali">কয়টি serving</Label>
              <Input type="number" value={quantity} onChange={e => {
                setQuantity(e.target.value);
                setAddExtraOptions([]);
              }} min="0" step="0.5" />
            </div>
            <div>
              <Label className="font-bengali">কারণ</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest">গেস্ট</SelectItem>
                  <SelectItem value="extra_self">নিজের extra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bengali">Extra Item (গরু/খাসি)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-bengali text-sm" disabled={parseFloat(quantity) <= 0}>
                    <span>{addExtraOptions.length}টি item</span>
                    <Utensils className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 space-y-1">
                  <p className="text-xs font-bengali text-muted-foreground">নির্বাচিত: {addExtraOptions.length}/{parseFloat(quantity) || 0}টি</p>
                  {EXTRA_OPTIONS_LIST.map(o => {
                    const count = addExtraOptions.filter(v => v === o.value).length;
                    return (
                      <div key={o.value} className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-accent/10 text-xs">
                        <span className="font-bengali">{o.label}</span>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => decAddExtra(o.value)} disabled={count === 0}>−</Button>
                          <span className="w-5 text-center font-bold">{count}</span>
                          <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => incAddExtra(o.value)}>+</Button>
                        </div>
                      </div>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end">
              <Button onClick={addExtraMeal} className="w-full font-bengali gap-1 bg-gradient-to-r from-primary to-primary/80" disabled={!selectedMember}>
                <Plus className="h-4 w-4" /> যোগ করুন
              </Button>
            </div>
          </div>
          {(() => {
            const q = parseFloat(quantity) || 0;
            if (q < 1) return null;
            const isFeast = isFeastDay(selectedDate);
            const mult = isFeast ? 3 : 1;
            const total = q * mult;
            return (
              <div className={`p-3 rounded-xl border ${isFeast ? 'bg-destructive/5 border-destructive/30' : 'bg-primary/5 border-primary/30'}`}>
                <p className={`text-sm font-bengali ${isFeast ? 'text-destructive' : 'text-primary'}`}>
                  {isFeast ? '🎉 Feast Day: ' : '📊 হিসাব: '}
                  <strong>{q} serving × {mult}</strong> = <strong>{total} মিল</strong> যোগ হবে
                </p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* List */}
      <Card className="card-hover overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="font-bengali flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Utensils className="h-4 w-4 text-primary" />
            </div>
            এই মাসের Extra মিল তালিকা
            <Badge variant="outline" className="ml-auto">{extras.length}টি</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bengali">সদস্য</TableHead>
                  <TableHead className="font-bengali">তারিখ</TableHead>
                  <TableHead className="font-bengali">টাইপ</TableHead>
                  <TableHead className="font-bengali">সংখ্যা</TableHead>
                  <TableHead className="font-bengali">কারণ</TableHead>
                  <TableHead className="font-bengali">Feast</TableHead>
                  <TableHead className="font-bengali">মিল গণনা</TableHead>
                  <TableHead className="font-bengali">আইটেম</TableHead>
                  <TableHead className="font-bengali text-center">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extras.map(e => (
                  <TableRow key={e.id} className="transition-colors">
                    <TableCell className="font-medium">{e.member_name || '—'}</TableCell>

                    {/* Date */}
                    <TableCell className="text-sm">
                      {editingId === e.id ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs w-full">
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {format(editState.mealDate, 'dd MMM')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={editState.mealDate} onSelect={d => d && setEditState(s => ({ ...s, mealDate: d }))} />
                          </PopoverContent>
                        </Popover>
                      ) : format(new Date(e.meal_date), 'dd MMM')}
                    </TableCell>

                    {/* Type */}
                    <TableCell className="font-bengali">
                      {editingId === e.id ? (
                        <Select value={editState.mealType} onValueChange={v => setEditState(s => ({ ...s, mealType: v as any }))}>
                          <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lunch">লাঞ্চ</SelectItem>
                            <SelectItem value="dinner">ডিনার</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (e.meal_type === 'lunch' ? 'লাঞ্চ' : 'ডিনার')}
                    </TableCell>

                    {/* Quantity */}
                    <TableCell>
                      {editingId === e.id ? (
                        <Input type="number" min="0.5" step="0.5" value={editState.quantity} onChange={ev => setEditState(s => ({ ...s, quantity: ev.target.value }))} className="w-16 h-7 text-xs" />
                      ) : <span className="font-bold">{e.quantity}</span>}
                    </TableCell>

                    {/* Reason */}
                    <TableCell className="font-bengali text-sm">
                      {editingId === e.id ? (
                        <Select value={editState.reason} onValueChange={v => setEditState(s => ({ ...s, reason: v }))}>
                          <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="guest">গেস্ট</SelectItem>
                            <SelectItem value="extra_self">নিজের</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (e.reason === 'guest' ? 'গেস্ট' : 'নিজের')}
                    </TableCell>

                    {/* Feast toggle */}
                    <TableCell>
                      {editingId === e.id ? (
                        <Switch checked={editState.isFeastDay} onCheckedChange={v => setEditState(s => ({ ...s, isFeastDay: v }))} />
                      ) : (
                        <Badge variant={e.is_feast_day ? 'destructive' : 'outline'} className="text-xs">
                          {e.is_feast_day ? 'হ্যাঁ' : 'না'}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Meal count equivalent */}
                    <TableCell>
                      {editingId === e.id ? (
                        <div className="flex items-center gap-1">
                          <Input type="number" min="0.5" step="0.5" value={editState.mealCountEquivalent} onChange={ev => setEditState(s => ({ ...s, mealCountEquivalent: ev.target.value }))} className="w-14 h-7 text-xs" />
                          <span className="text-xs text-muted-foreground">×</span>
                        </div>
                      ) : (
                        <Badge variant={e.is_feast_day ? 'destructive' : 'secondary'} className="font-bengali">
                          {e.quantity * e.meal_count_equivalent} মিল {e.meal_count_equivalent > 1 ? `(×${e.meal_count_equivalent})` : ''}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Items / Extra options */}
                    <TableCell>
                      {editingId === e.id ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              {editState.extraOptions.length}টি item
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2 space-y-1">
                            <p className="text-xs font-bengali text-muted-foreground">নির্বাচিত: {editState.extraOptions.length}/{parseFloat(editState.quantity) || 0}টি</p>
                            {EXTRA_OPTIONS_LIST.map(o => {
                              const count = editState.extraOptions.filter(v => v === o.value).length;
                              return (
                                <div key={o.value} className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-accent/10 text-xs">
                                  <span className="font-bengali">{o.label}</span>
                                  <div className="flex items-center gap-1">
                                    <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => decEditExtra(o.value)} disabled={count === 0}>−</Button>
                                    <span className="w-5 text-center font-bold">{count}</span>
                                    <Button type="button" size="icon" variant="outline" className="h-6 w-6" onClick={() => incEditExtra(o.value)}>+</Button>
                                  </div>
                                </div>
                              );
                            })}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="font-bengali text-xs text-muted-foreground">
                          {e.extra_option ? (() => {
                            const items = e.extra_option.split(',').map((s: string) => s.trim()).filter(Boolean);
                            const counts = items.reduce((acc: Record<string, number>, v: string) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
                            return Object.entries(counts).map(([v, c]) => `${EXTRA_LABEL_MAP[v] || v}${(c as number) > 1 ? `×${c}` : ''}`).join(', ');
                          })() : '—'}
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        {editingId === e.id ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateExtra(e.id)}>
                              <Check className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-primary/10" onClick={() => startEditing(e)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <AdminDeleteConfirm
                              title="Extra মিল মুছবেন?"
                              description="এই extra মিল মুছে ফেলতে অ্যাডমিন পাসওয়ার্ড দিন।"
                              onConfirm={() => deleteExtra(e.id)}
                              trigger={
                                <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/10">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              }
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {extras.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground font-bengali py-8">কোনো extra মিল নেই</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

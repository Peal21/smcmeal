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
import { toast } from 'sonner';
import { format, getDay, addDays, startOfDay } from 'date-fns';
import { CalendarIcon, Flame, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import AdminDeleteConfirm from './AdminDeleteConfirm';

function getNextDefaultFeastDates(count = 6): Date[] {
  const dates: Date[] = [];
  let d = startOfDay(new Date());
  while (dates.length < count) {
    const day = getDay(d);
    if (day === 1 || day === 5) dates.push(new Date(d));
    d = addDays(d, 1);
  }
  return dates;
}

export default function FeastDayManager() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<any[]>([]);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newMealType, setNewMealType] = useState('both');
  const [newMce, setNewMce] = useState('3');
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMce, setEditMce] = useState('3');
  const [editMealType, setEditMealType] = useState('both');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());

  const upcomingDefaults = getNextDefaultFeastDates(6);

  useEffect(() => { fetchConfigs(); }, []);

  useEffect(() => {
    const ch = supabase.channel('feast-config-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feast_day_config' }, () => fetchConfigs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchConfigs = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('feast_day_config')
      .select('*')
      .gte('feast_date', today)
      .order('feast_date');
    setConfigs(data || []);
  };

  const addConfig = async () => {
    if (!user) return;
    const mce = parseFloat(newMce) || 3;
    const { error } = await supabase.from('feast_day_config').insert({
      feast_date: format(newDate, 'yyyy-MM-dd'),
      meal_type: newMealType,
      meal_count_equivalent: mce,
      note: newNote || null,
      created_by: user.id,
    });
    if (error) {
      if (error.code === '23505') toast.error('এই তারিখ ও টাইপের জন্য ইতিমধ্যে কনফিগ আছে');
      else toast.error(error.message);
    } else {
      toast.success('Feast Day কনফিগ যোগ হয়েছে');
      setNewNote('');
      setNewMce('3');
      fetchConfigs();
    }
  };

  const updateConfig = async (id: string) => {
    const mce = parseFloat(editMce) || 3;
    const { error } = await supabase.from('feast_day_config').update({
      meal_count_equivalent: mce,
      meal_type: editMealType,
      note: editNote || null,
      feast_date: format(editDate, 'yyyy-MM-dd'),
    }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('আপডেট হয়েছে'); setEditingId(null); fetchConfigs(); }
  };

  const deleteConfig = async (id: string) => {
    const { error } = await supabase.from('feast_day_config').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('মুছে ফেলা হয়েছে'); fetchConfigs(); }
  };

  const startEditing = (c: any) => {
    setEditingId(c.id);
    setEditMce(String(c.meal_count_equivalent));
    setEditMealType(c.meal_type);
    setEditNote(c.note || '');
    setEditDate(new Date(c.feast_date + 'T00:00:00'));
  };

  const isDefaultFeast = (date: Date) => {
    const day = getDay(date);
    return day === 1 || day === 5;
  };

  const configuredDatesSet = new Set(configs.map(c => c.feast_date));

  return (
    <div className="space-y-6 page-enter stagger-children">
      {/* Upcoming default feast days */}
      <Card className="card-hover overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-500/10 to-transparent">
          <CardTitle className="font-bengali flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            আসন্ন ডিফল্ট Feast Day (সোম ও শুক্র)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {upcomingDefaults.map(d => {
              const dateStr = format(d, 'yyyy-MM-dd');
              const hasOverride = configuredDatesSet.has(dateStr);
              return (
                <Badge key={dateStr} variant={hasOverride ? 'default' : 'outline'} className="font-bengali text-sm py-1.5 px-3">
                  {format(d, 'dd MMM (EEE)')}
                  {hasOverride && <span className="ml-1 text-xs">✏️</span>}
                </Badge>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 font-bengali">
            ডিফল্ট: সোমবার ও শুক্রবার — ১ মিল = ৩ মিল। নিচে কাস্টম কনফিগ করে ওভাররাইড বা নতুন তারিখ যোগ করুন।
          </p>
        </CardContent>
      </Card>

      {/* Add custom feast config */}
      <Card className="holo-card card-hover overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 animate-float">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            Feast Day কনফিগ যোগ / ওভাররাইড
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="font-bengali">তারিখ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-bengali">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(newDate, 'dd MMM yyyy')}
                    {isDefaultFeast(newDate) && <Badge className="ml-2" variant="secondary">ডিফল্ট</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newDate} onSelect={d => d && setNewDate(d)} /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="font-bengali">মিল টাইপ</Label>
              <Select value={newMealType} onValueChange={setNewMealType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">উভয় (লাঞ্চ+ডিনার)</SelectItem>
                  <SelectItem value="lunch">শুধু লাঞ্চ</SelectItem>
                  <SelectItem value="dinner">শুধু ডিনার</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-bengali">১ মিল = কত মিল</Label>
              <Input type="number" value={newMce} onChange={e => setNewMce(e.target.value)} min="1" step="0.5" />
            </div>
            <div>
              <Label className="font-bengali">নোট (ঐচ্ছিক)</Label>
              <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="বিশেষ কারণ..." className="font-bengali" />
            </div>
          </div>
          <Button onClick={addConfig} className="font-bengali gap-1 bg-gradient-to-r from-primary to-primary/80">
            <Plus className="h-4 w-4" /> যোগ করুন
          </Button>
        </CardContent>
      </Card>

      {/* Config list */}
      <Card className="card-hover overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="font-bengali flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Flame className="h-4 w-4 text-primary" />
            </div>
            কাস্টম Feast Day কনফিগ তালিকা
            <Badge variant="outline" className="ml-auto">{configs.length}টি</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bengali">তারিখ</TableHead>
                  <TableHead className="font-bengali">টাইপ</TableHead>
                  <TableHead className="font-bengali">১মিল=?মিল</TableHead>
                  <TableHead className="font-bengali">নোট</TableHead>
                  <TableHead className="font-bengali text-center">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      {editingId === c.id ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {format(editDate, 'dd MMM')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={editDate} onSelect={d => d && setEditDate(d)} />
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span>
                          {format(new Date(c.feast_date + 'T00:00:00'), 'dd MMM yyyy (EEE)')}
                          {!isDefaultFeast(new Date(c.feast_date + 'T00:00:00')) && (
                            <Badge variant="secondary" className="ml-1 text-[10px]">কাস্টম</Badge>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-bengali">
                      {editingId === c.id ? (
                        <Select value={editMealType} onValueChange={setEditMealType}>
                          <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both">উভয়</SelectItem>
                            <SelectItem value="lunch">লাঞ্চ</SelectItem>
                            <SelectItem value="dinner">ডিনার</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        c.meal_type === 'both' ? 'উভয়' : c.meal_type === 'lunch' ? 'লাঞ্চ' : 'ডিনার'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === c.id ? (
                        <Input type="number" min="1" step="0.5" value={editMce} onChange={ev => setEditMce(ev.target.value)} className="w-16 h-7 text-xs" />
                      ) : (
                        <Badge variant="destructive" className="font-bengali">×{c.meal_count_equivalent}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-bengali">
                      {editingId === c.id ? (
                        <Input value={editNote} onChange={ev => setEditNote(ev.target.value)} className="h-7 text-xs" placeholder="নোট..." />
                      ) : (c.note || '—')}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        {editingId === c.id ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateConfig(c.id)}>
                              <Check className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-primary/10" onClick={() => startEditing(c)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <AdminDeleteConfirm
                              title="Feast কনফিগ মুছবেন?"
                              description="এই feast day কনফিগ মুছে ফেলতে অ্যাডমিন পাসওয়ার্ড দিন।"
                              onConfirm={() => deleteConfig(c.id)}
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
                {configs.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-bengali py-8">কোনো কাস্টম কনফিগ নেই — ডিফল্ট (সোম/শুক্র, ×৩) ব্যবহৃত হচ্ছে</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

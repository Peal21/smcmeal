import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, CalendarIcon, Trash2, Star } from 'lucide-react';
import AdminDeleteConfirm from './AdminDeleteConfirm';

export default function SpecialDayItemManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [itemName, setItemName] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [responses, setResponses] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel('special-day-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_day_items' }, () => fetchItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_day_responses' }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchItems = async () => {
    const { data: itemsData } = await supabase
      .from('special_day_items')
      .select('*')
      .order('item_date', { ascending: false });
    setItems(itemsData || []);

    // Fetch response counts
    const { data: responsesData } = await supabase
      .from('special_day_responses')
      .select('item_id, opted_in');
    
    const counts: Record<string, number> = {};
    (responsesData || []).forEach((r: any) => {
      if (r.opted_in) {
        counts[r.item_id] = (counts[r.item_id] || 0) + 1;
      }
    });
    setResponses(counts);
  };

  const addItem = async () => {
    if (!itemName.trim() || !user) { toast.error('আইটেমের নাম দিন'); return; }
    const { error } = await supabase.from('special_day_items').insert({
      item_name: itemName.trim(),
      item_date: format(selectedDate, 'yyyy-MM-dd'),
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('বিশেষ দিনের আইটেম যোগ হয়েছে');
      setItemName('');
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('special_day_items').delete().eq('id', id);
    if (error) toast.error(error.message);
    else toast.success('আইটেম মুছে ফেলা হয়েছে');
  };

  return (
    <div className="space-y-6 page-enter stagger-children">
      <Card className="holo-card card-hover overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 animate-float">
              <Star className="h-4 w-4 text-primary" />
            </div>
            বিশেষ দিনের আইটেম যোগ করুন
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label className="font-bengali">আইটেমের নাম</Label>
              <Input
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                placeholder="যেমন: পোলাও, বিরিয়ানি, খিচুড়ি"
                className="font-bengali"
              />
            </div>
            <div>
              <Label className="font-bengali">তারিখ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-bengali">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={selectedDate} onSelect={d => d && setSelectedDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end">
              <Button onClick={addItem} className="w-full font-bengali gap-1 bg-gradient-to-r from-primary to-primary/80" disabled={!itemName.trim()}>
                <Plus className="h-4 w-4" /> যোগ করুন
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="font-bengali flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Star className="h-4 w-4 text-primary" />
            </div>
            বিশেষ দিনের আইটেম তালিকা
            <Badge variant="outline" className="ml-auto">{items.length}টি</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground font-bengali py-8">কোনো বিশেষ দিনের আইটেম নেই</p>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50 transition-all hover:bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15">
                      <Star className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold font-bengali">{item.item_name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(item.item_date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-bengali text-xs">
                      {responses[item.id] || 0} জন চায়
                    </Badge>
                    <AdminDeleteConfirm
                      title="আইটেম মুছবেন?"
                      description="এই বিশেষ দিনের আইটেম মুছে ফেলতে অ্যাডমিন পাসওয়ার্ড দিন।"
                      onConfirm={() => deleteItem(item.id)}
                      trigger={
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

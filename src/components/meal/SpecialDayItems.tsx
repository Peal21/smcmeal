import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { Star } from 'lucide-react';

export default function SpecialDayItems() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [myResponses, setMyResponses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) fetchData();
    const channel = supabase
      .channel('special-day-student')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_day_items' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_day_responses' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const mealDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const { data: itemsData } = await supabase
      .from('special_day_items')
      .select('*')
      .eq('item_date', mealDate)
      .order('item_date');

    setItems(itemsData || []);

    const { data: responsesData } = await supabase
      .from('special_day_responses')
      .select('item_id, opted_in')
      .eq('user_id', user.id);

    const map: Record<string, boolean> = {};
    (responsesData || []).forEach((r: any) => { map[r.item_id] = r.opted_in; });
    setMyResponses(map);
  };

  const toggleResponse = async (itemId: string, optIn: boolean) => {
    if (!user) return;
    if (myResponses[itemId] !== undefined) {
      const { error } = await supabase
        .from('special_day_responses')
        .update({ opted_in: optIn })
        .eq('item_id', itemId)
        .eq('user_id', user.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase
        .from('special_day_responses')
        .insert({ item_id: itemId, user_id: user.id, opted_in: optIn });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(optIn ? 'আইটেম নিতে চান — সেভ হয়েছে' : 'আইটেম বাদ দেওয়া হয়েছে');
    setMyResponses(prev => ({ ...prev, [itemId]: optIn }));
  };

  if (items.length === 0) return null;

  return (
    <Card className="card-hover card-shine overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-accent/10 to-transparent pb-3">
        <CardTitle className="font-bengali flex items-center gap-2 text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
            <Star className="h-4 w-4 text-accent" />
          </div>
          ⭐ বিশেষ দিনের আইটেম
        </CardTitle>
        <p className="text-xs text-muted-foreground font-bengali">আপনি চাইলে সুইচ চালু করুন</p>
      </CardHeader>
      <CardContent className="space-y-2 pt-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-accent/5 to-transparent border border-accent/10 transition-all hover:border-accent/30">
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
              {myResponses[item.id] && (
                <Badge className="font-bengali text-xs bg-accent/15 text-accent-foreground border-accent/30">চাই</Badge>
              )}
              <Switch
                checked={myResponses[item.id] || false}
                onCheckedChange={v => toggleResponse(item.id, v)}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FileSpreadsheet, Download, FileText } from 'lucide-react';
import { generateMealExcel } from '@/lib/excelGenerator';
import { generateMealPdf } from '@/lib/pdfMealGenerator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ExportFormat = 'excel' | 'pdf';

export default function ExcelExport() {
  const [loading, setLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [selectedDate, setSelectedDate] = useState(format(tomorrow, 'yyyy-MM-dd'));

  const generateExport = async (
    filterGender: 'male' | 'female',
    filterYears: Array<'1st' | '2nd' | '3rd' | '4th' | '5th' | 'extra'>,
    fileName: string,
  ) => {
    setLoading(true);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, year, roll_number')
      .eq('is_active', true)
      .eq('gender', filterGender)
      .in('year', filterYears)
      .order('roll_number');

    if (!profiles?.length) {
      toast.error('No data found');
      setLoading(false);
      return;
    }

    const userIds = profiles.map((p) => p.user_id);
    const [{ data: meals }, { data: extraMeals }, { data: specialItems }, { data: specialResponses }] = await Promise.all([
      supabase.from('daily_meals')
        .select('user_id, lunch, dinner, lunch_extra_option, meal_date')
        .eq('meal_date', selectedDate)
        .in('user_id', userIds),
      supabase.from('extra_meals')
        .select('user_id, meal_type, quantity, meal_count_equivalent, is_feast_day, extra_option')
        .eq('meal_date', selectedDate)
        .in('user_id', userIds),
      supabase.from('special_day_items')
        .select('id, item_name')
        .eq('item_date', selectedDate),
      supabase.from('special_day_responses')
        .select('item_id, user_id, opted_in')
        .in('user_id', userIds),
    ]);

    const dayOfWeek = new Date(selectedDate).getDay();
    const isFeastDay = dayOfWeek === 1 || dayOfWeek === 5;

    // Build special day data
    const specialItemsList = specialItems || [];
    const specialResponsesList = specialResponses || [];
    const specialItemIds = specialItemsList.map(i => i.id);
    const relevantResponses = specialResponsesList.filter(r => specialItemIds.includes(r.item_id) && r.opted_in);

    // Map: user_id -> list of item names they opted into
    const userSpecialMap = new Map<string, string[]>();
    for (const r of relevantResponses) {
      const item = specialItemsList.find(i => i.id === r.item_id);
      if (item) {
        const list = userSpecialMap.get(r.user_id) || [];
        list.push(item.item_name);
        userSpecialMap.set(r.user_id, list);
      }
    }

    // Special item counts for summary
    const specialSummary = specialItemsList.map(item => ({
      label: item.item_name,
      value: relevantResponses.filter(r => r.item_id === item.id).length,
    })).filter(s => s.value > 0);

    if (exportFormat === 'pdf') {
      await generateMealPdf(profiles, meals || [], filterGender, filterYears, selectedDate, fileName, extraMeals || [], isFeastDay, userSpecialMap, specialSummary);
      toast.success('PDF ডাউনলোড হয়েছে');
    } else {
      await generateMealExcel(profiles, meals || [], filterGender, filterYears, selectedDate, fileName, extraMeals || [], isFeastDay, userSpecialMap, specialSummary);
      toast.success('Excel ডাউনলোড হয়েছে');
    }
    setLoading(false);
  };

  return (
    <Card className="holo-card animate-fade-in-up overflow-hidden">
      <CardHeader>
        <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
          <FileSpreadsheet className="h-5 w-5 text-primary animate-float" /> এক্সপোর্ট (A4 Printable)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label className="font-bengali">তারিখ</Label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="max-w-xs" />
          </div>
          <div className="space-y-2">
            <Label className="font-bengali">ফরম্যাট</Label>
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> PDF</span>
                </SelectItem>
                <SelectItem value="excel">
                  <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 stagger-children">
          <Card className="border-2 card-hover card-shine overflow-hidden group">
            <CardHeader>
              <CardTitle className="text-lg font-bengali">ছেলে (Boys)</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => generateExport('male', ['1st', '2nd', '3rd', '4th', '5th', 'extra'], 'boys_all')}
                disabled={loading}
                className="w-full font-bengali gap-2"
              >
                <Download className="h-4 w-4" /> সব Batch — এক পেজ
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 card-hover card-shine overflow-hidden group">
            <CardHeader>
              <CardTitle className="text-lg font-bengali">মেয়ে (Girls)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => generateExport('female', ['1st', '2nd', '3rd', '4th', '5th', 'extra'], 'girls_all')}
                disabled={loading}
                className="w-full font-bengali gap-2"
              >
                <Download className="h-4 w-4" /> সব Batch — এক পেজ
              </Button>
              <Button
                onClick={() => generateExport('female', ['3rd'], 'girls_3rd_year')}
                disabled={loading}
                variant="secondary"
                className="w-full font-bengali gap-2"
              >
                <Download className="h-4 w-4" /> শুধু 3rd Year
              </Button>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Play, History } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';

function getDhakaToday() {
  const now = new Date();
  const dhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return dhaka.toISOString().split('T')[0];
}

export default function AutoCarryControl() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('carry_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setLogs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const runManualCarry = async () => {
    setRunning(true);
    try {
      const today = getDhakaToday();
      const tomorrow = format(addDays(new Date(today), 1), 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('auto-carry-meals', {
        body: {
          source_date: today,
          target_date: tomorrow,
          triggered_by: 'manual',
        },
      });

      if (error) throw error;
      toast.success(`সফল! ${data?.message || 'Auto-carry সম্পন্ন হয়েছে'}`);
      fetchLogs();
    } catch (err: any) {
      toast.error(`ত্রুটি: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="holo-card animate-fade-in-up overflow-hidden">
      <CardHeader>
        <CardTitle className="font-bengali flex items-center gap-2 gradient-text-hero">
          <RefreshCw className="h-5 w-5 text-primary animate-spin-slow" /> Auto Carry নিয়ন্ত্রণ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button onClick={runManualCarry} disabled={running} className="font-bengali gap-2">
            <Play className="h-4 w-4" />
            {running ? 'চলছে...' : 'এখনই Carry চালাও'}
          </Button>
          <p className="text-sm text-muted-foreground font-bengali">
            আজকের ডেটা → আগামীকালে কপি করবে
          </p>
        </div>

        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-bengali font-medium">Carry লগ ইতিহাস</h3>
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="rounded-lg border overflow-auto card-shine">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bengali">তারিখ</TableHead>
                <TableHead className="font-bengali text-center">Source → Target</TableHead>
                <TableHead className="font-bengali text-center">Insert</TableHead>
                <TableHead className="font-bengali text-center">Update</TableHead>
                <TableHead className="font-bengali text-center">Skip</TableHead>
                <TableHead className="font-bengali text-center">ট্রিগার</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log, i) => (
                <TableRow key={log.id} className="animate-fade-in transition-all duration-300 hover:bg-primary/5" style={{ animationDelay: `${i * 0.05}s` }}>
                  <TableCell className="text-xs">
                    {format(new Date(log.created_at), 'dd/MM HH:mm')}
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {format(new Date(log.source_date), 'dd/MM')} → {format(new Date(log.target_date), 'dd/MM')}
                  </TableCell>
                  <TableCell className="text-center font-bold text-primary">{log.inserted_count}</TableCell>
                  <TableCell className="text-center">{log.updated_count}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{log.skipped_count}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={log.triggered_by === 'manual' ? 'default' : 'outline'} className="text-xs">
                      {log.triggered_by === 'manual' ? 'ম্যানুয়াল' : 'অটো'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground font-bengali py-8">
                    কোনো লগ নেই
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

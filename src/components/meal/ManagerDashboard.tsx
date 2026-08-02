import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import MealOverview from './manager/MealOverview';
import MemberManagement from './manager/MemberManagement';
import PaymentManagement from './manager/PaymentManagement';
import BillingManagement from './manager/BillingManagement';
import MonthSettings from './manager/MonthSettings';
import ExcelExport from './manager/ExcelExport';
import ExtraMealManager from './manager/ExtraMealManager';
import AutoCarryControl from './manager/AutoCarryControl';
import SpecialDayItemManager from './manager/SpecialDayItemManager';
import FeastDayManager from './manager/FeastDayManager';
import { LayoutDashboard, Users, CreditCard, Settings, FileSpreadsheet, Plus, Calculator, RefreshCw, Star, Flame } from 'lucide-react';
import { playClickSound } from '@/lib/sounds';

import { useAuth } from '@/hooks/useAuth';

const tabs = [
  { value: 'overview', label: 'সারসংক্ষেপ', icon: LayoutDashboard },
  { value: 'members', label: 'সদস্য', icon: Users },
  { value: 'extra', label: 'Extra মিল', icon: Plus },
  { value: 'feast', label: 'Feast Day', icon: Flame },
  { value: 'billing', label: 'হিসাব', icon: Calculator },
  { value: 'payments', label: 'পেমেন্ট', icon: CreditCard },
  { value: 'export', label: 'এক্সেল', icon: FileSpreadsheet },
  { value: 'settings', label: 'সেটিংস', icon: Settings },
  { value: 'special', label: 'বিশেষ দিন', icon: Star },
  { value: 'carry', label: 'Auto Carry', icon: RefreshCw },
];

export default function ManagerDashboard() {
  const { isManager, isAdmin, isHistoricalManager } = useAuth();
  const isOnlyHistoricalManager = isHistoricalManager && !isManager && !isAdmin;

  const allowedTabs = tabs.filter(tab => {
    if (isOnlyHistoricalManager) {
      return ['billing', 'payments', 'export', 'settings'].includes(tab.value);
    }
    return true;
  });

  const defaultTab = isOnlyHistoricalManager ? 'billing' : 'overview';

  return (
    <Tabs defaultValue={defaultTab} onValueChange={() => playClickSound()} className="space-y-6 animate-fade-in">
      <ScrollArea className="w-full pb-2">
        <TabsList className="inline-flex w-max gap-1.5 bg-muted/40 border border-border/40 backdrop-blur-md rounded-2xl p-1.5 shadow-md">
          {allowedTabs.map((tab, i) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="font-bengali gap-2 rounded-xl whitespace-nowrap transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-info data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/20 hover:text-foreground text-xs sm:text-sm px-3.5 py-2 hover:bg-background/40"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <tab.icon className="h-4 w-4 shrink-0" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollBar orientation="horizontal" className="h-1" />
      </ScrollArea>

      {allowedTabs.some(t => t.value === 'overview') && (
        <TabsContent value="overview" className="animate-fade-in-up"><MealOverview /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'members') && (
        <TabsContent value="members" className="animate-fade-in-up"><MemberManagement /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'extra') && (
        <TabsContent value="extra" className="animate-fade-in-up"><ExtraMealManager /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'feast') && (
        <TabsContent value="feast" className="animate-fade-in-up"><FeastDayManager /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'billing') && (
        <TabsContent value="billing" className="animate-fade-in-up"><BillingManagement /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'payments') && (
        <TabsContent value="payments" className="animate-fade-in-up"><PaymentManagement /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'export') && (
        <TabsContent value="export" className="animate-fade-in-up"><ExcelExport /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'settings') && (
        <TabsContent value="settings" className="animate-fade-in-up"><MonthSettings /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'special') && (
        <TabsContent value="special" className="animate-fade-in-up"><SpecialDayItemManager /></TabsContent>
      )}
      {allowedTabs.some(t => t.value === 'carry') && (
        <TabsContent value="carry" className="animate-fade-in-up"><AutoCarryControl /></TabsContent>
      )}
    </Tabs>
  );
}

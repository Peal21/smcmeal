import { useAuth } from '@/hooks/useAuth';
import StudentDashboard from '@/components/meal/StudentDashboard';
import ManagerDashboard from '@/components/meal/ManagerDashboard';
import AppHeader from '@/components/meal/AppHeader';

export default function Dashboard() {
  const { isManager, isAdmin, isHistoricalManager, adminMode } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-[#0B0F17] text-foreground relative selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300">
      {/* Subtle modern ambient background glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Soft top emerald glow */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/8 dark:bg-emerald-500/6 rounded-full blur-3xl" />
        {/* Soft corner blue/cyan tint */}
        <div className="absolute top-1/4 -right-40 w-[500px] h-[400px] bg-sky-500/5 dark:bg-sky-500/4 rounded-full blur-3xl" />
        {/* Very subtle subtle micro grid for tech feel without noise */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 container mx-auto px-3 sm:px-6 py-4 sm:py-8 max-w-6xl">
          {adminMode && (isManager || isAdmin || isHistoricalManager) ? (
            <ManagerDashboard />
          ) : (
            <StudentDashboard />
          )}
        </main>
      </div>
    </div>
  );
}

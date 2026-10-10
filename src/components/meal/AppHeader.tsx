import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, LogOut, User, Sparkles, Sun, Moon, Settings, GraduationCap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { playClickSound } from '@/lib/sounds';

export default function AppHeader() {
  const { profile, signOut, isManager, isAdmin, isHistoricalManager, adminMode, enableAdminMode, disableAdminMode } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/85 dark:bg-[#0B0F17]/85 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between max-w-6xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold font-bengali tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              সাতক্ষীরা মেডিকেল কলেজ
            </h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-bengali">
              মিল ম্যানেজমেন্ট সিস্টেম
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick toggle for privileged users */}
          {(isManager || isAdmin || isHistoricalManager) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                playClickSound();
                if (adminMode) disableAdminMode(); else enableAdminMode();
              }}
              className={`font-bengali h-8 text-xs px-3 rounded-lg border transition-all ${
                adminMode
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {adminMode ? (
                <>
                  <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                  <span>ছাত্র ভিউ</span>
                </>
              ) : (
                <>
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  <span>ম্যানেজার ভিউ</span>
                </>
              )}
            </Button>
          )}

          {/* Theme switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              playClickSound();
              setTheme(theme === 'dark' ? 'light' : 'dark');
            }}
            className="h-8 w-8 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Profile Name */}
          {profile?.full_name && (
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold font-bengali text-slate-800 dark:text-slate-200 leading-tight">
                  {profile.full_name}
                </span>
                <div className="flex items-center gap-1">
                  {isManager && <span className="text-[10px] text-emerald-600 font-medium">ম্যানেজার</span>}
                  {isAdmin && <span className="text-[10px] text-purple-600 font-medium">অ্যাডমিন</span>}
                </div>
              </div>
            </div>
          )}

          {/* Logout */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              playClickSound();
              signOut();
            }}
            className="h-8 w-8 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            title="লগআউট"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}



import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, LogOut, User, Sparkles, Sun, Moon, Settings, GraduationCap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { playClickSound } from '@/lib/sounds';

export default function AppHeader() {
  const { profile, signOut, isManager, isAdmin, adminMode, enableAdminMode, disableAdminMode } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b border-border/30 sticky top-0 z-50 glass-card rounded-none border-x-0 border-t-0">
      {/* Animated top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-primary via-accent to-info bg-[length:200%_100%] animate-gradient-shift" />
      
      <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-7xl">
        <div className="flex items-center gap-3 animate-fade-in-left">
          <div className="relative group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary to-info shadow-lg shadow-primary/25 transition-all duration-500 group-hover:shadow-xl group-hover:shadow-primary/40 group-hover:scale-110 group-hover:rotate-3 animate-rotate-3d" style={{ animationDuration: '12s' }}>
              <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent animate-glow-pulse" />
            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent animate-pulse-ring" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold font-bengali leading-tight gradient-text-hero" style={{ backgroundSize: '200% auto' }}>সাতক্ষীরা মেডিকেল কলেজ</h1>
            <p className="text-[10px] text-muted-foreground font-bengali flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-accent animate-glow-pulse" /> মিল ম্যানেজমেন্ট সিস্টেম
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 animate-fade-in-right">
          {/* Quick toggle for privileged users (Manager / Admin) to switch views */}
          {(isManager || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                playClickSound();
                if (adminMode) disableAdminMode(); else enableAdminMode();
              }}
              className={`font-bengali h-8 text-[11px] px-2.5 rounded-xl border border-primary/20 hover:scale-105 transition-all duration-300 flex items-center gap-1.5 shadow-sm ${
                adminMode 
                  ? 'bg-gradient-to-r from-primary/10 to-info/10 text-primary hover:bg-primary/25 border-primary/30' 
                  : 'bg-gradient-to-r from-accent/10 to-warning/10 text-accent-foreground hover:bg-accent/25 border-accent/30'
              }`}
            >
              {adminMode ? (
                <>
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">ছাত্র ভিউ</span>
                </>
              ) : (
                <>
                  <Settings className="h-3.5 w-3.5 animate-spin-slow" />
                  <span className="hidden xs:inline">ম্যানেজার ভিউ</span>
                </>
              )}
            </Button>
          )}

          {/* Light/Dark mode switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              playClickSound();
              setTheme(theme === 'dark' ? 'light' : 'dark');
            }}
            className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-300 hover:rotate-45"
            title="Theme Switcher"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* User profile info */}
          <div className="hidden xs:flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-info/10 border border-primary/20 transition-all duration-300 hover:scale-110">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-bengali font-semibold leading-tight">{profile?.full_name}</span>
              <div className="flex gap-1">
                {isManager && <Badge variant="secondary" className="font-bengali text-[8px] px-1 py-0 h-3.5 bg-secondary/80 text-secondary-foreground border-0">ম্যানেজার</Badge>}
                {isAdmin && <Badge className="font-bengali text-[8px] px-1 py-0 h-3.5 bg-gradient-to-r from-primary to-accent text-white border-0 shadow-sm shadow-primary/20">অ্যাডমিন</Badge>}
              </div>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => {
            playClickSound();
            signOut();
          }} className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all duration-500 hover:rotate-12 hover:scale-110" title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

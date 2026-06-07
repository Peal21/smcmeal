import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UtensilsCrossed, ShieldCheck, Download, LogIn, UserPlus, Lock, Mail, User, GraduationCap, ArrowLeft, Sparkles, Zap, Star, KeyRound, Sun, Moon, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { generateMealExcel } from '@/lib/excelGenerator';
import { playClickSound, playSuccessSound } from '@/lib/sounds';

/* ───── Animated particles ───── */
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 2 + Math.random() * 4,
      delay: `${Math.random() * 6}s`,
      duration: `${4 + Math.random() * 6}s`,
      opacity: 0.15 + Math.random() * 0.3,
    })), []);

  return (
    <>
      {particles.map(p => (
        <div
          key={p.id}
          className="auth-particle animate-particle-rise"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
            opacity: p.opacity,
            bottom: 0,
          }}
        />
      ))}
    </>
  );
}

/* ───── Matrix rain chars ───── */
function MatrixRain() {
  const chars = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      char: String.fromCharCode(0x09E0 + Math.floor(Math.random() * 50)),
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 8}s`,
      duration: `${3 + Math.random() * 5}s`,
    })), []);

  return (
    <>
      {chars.map(c => (
        <span
          key={c.id}
          className="matrix-char"
          style={{
            left: c.left,
            animationDelay: c.delay,
            animationDuration: c.duration,
          }}
        >
          {c.char}
        </span>
      ))}
    </>
  );
}

/* ───── Orbiting rings ───── */
function OrbitRings() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      {[300, 400, 500].map((size, i) => (
        <div
          key={size}
          className="absolute rounded-full border animate-spin-slow"
          style={{
            width: size,
            height: size,
            top: -(size / 2),
            left: -(size / 2),
            borderColor: `hsla(var(--primary), ${0.06 - i * 0.015})`,
            animationDuration: `${20 + i * 10}s`,
            animationDirection: i % 2 ? 'reverse' : 'normal',
          }}
        />
      ))}
    </div>
  );
}

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [year, setYear] = useState('1st');
  const [gender, setGender] = useState('male');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPortalPassword, setAdminPortalPassword] = useState('');
  const [masterLoginId, setMasterLoginId] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'newpass'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const { enableAdminMode, disableAdminMode } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    supabase.rpc('is_signup_enabled' as any).then(({ data }) => {
      if (typeof data === 'boolean') setSignupEnabled(data);
    });
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    disableAdminMode();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
        if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success('লগইন সফল!');
    playSuccessSound();
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail, password: signupPassword,
      options: { data: { full_name: fullName, roll_number: rollNumber || null, year, gender }, emailRedirectTo: `${window.location.origin}/` },
    });
        if (error) { toast.error(error.message); }
    else { 
      toast.success('অ্যাকাউন্ট তৈরি হয়েছে! ইমেইলে ভেরিফিকেশন লিংক পাঠানো হয়েছে।', { duration: 10000 });
      playSuccessSound();
    }
    setLoading(false);
  };

  const resetForgotState = () => {
    playClickSound();
    setShowForgot(false);
    setForgotStep('email');
    setOtpCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotEmail('');
    setResendTimer(0);
  };

  const handleForgotSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { toast.error('ইমেইল দিন'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset-otp', {
        body: { action: 'generate', email: forgotEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.code) {
        setOtpCode(data.code);
        toast.success(`আপনার রিকভারি কোড: ${data.code}`, { duration: 30000 });
      }
      playSuccessSound();
      setForgotStep('otp');
      setResendTimer(60);
    } catch (err: any) {
      toast.error(err.message || 'কোড পাঠাতে সমস্যা হয়েছে');
    }
    setLoading(false);
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset-otp', {
        body: { action: 'generate', email: forgotEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.code) {
        setOtpCode(data.code);
        toast.success(`নতুন কোড: ${data.code}`, { duration: 30000 });
      }
      setResendTimer(60);
    } catch (err: any) {
      toast.error(err.message || 'কোড পাঠাতে সমস্যা হয়েছে');
    }
    setLoading(false);
  };

  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে'); return; }
    if (newPassword !== confirmNewPassword) { toast.error('পাসওয়ার্ড মিলছে না!'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset-otp', {
        body: {
          action: 'verify',
          email: forgotEmail.trim(),
          code: otpCode.trim(),
          new_password: newPassword,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।', { duration: 8000 });
      playSuccessSound();
      resetForgotState();
    } catch (err: any) {
      toast.error(err.message || 'পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে');
    }
    setLoading(false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    enableAdminMode();
    try {
      // 1) Master credentials (login id + password) — no portal password needed.
      if (!adminEmail.includes('@')) {
        const { data, error } = await supabase.functions.invoke('master-admin-login', {
          body: { login_id: adminEmail.trim(), password: adminPassword },
        });
        if (!error && !data?.error && data?.email && data?.token_hash) {
          const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
          if (vErr) throw vErr;
          toast.success('মাস্টার অ্যাডমিন লগইন সফল!');
          playSuccessSound();
          setLoading(false);
          return;
        }
        throw new Error('ভুল মাস্টার আইডি বা পাসওয়ার্ড');
      }

      // 2) Email + password sign-in.
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
      if (error || !signInData?.user) throw new Error(error?.message || 'লগইন ব্যর্থ');

      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', signInData.user.id);
      const isSuper = roles?.some(r => r.role === 'super_admin');
      const isManagerRole = roles?.some(r => r.role === 'meal_manager');
      if (!isSuper && !isManagerRole) {
        await supabase.auth.signOut();
        throw new Error('এই অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই!');
      }

      // 3) Super admin: no dedicated portal password required.
      if (isSuper) {
        toast.success('সুপার অ্যাডমিন লগইন সফল!');
        playSuccessSound();
        setLoading(false);
        return;
      }

      // 4) Meal manager must pass dedicated portal password.
      const { data: isValid, error: pErr } = await supabase.rpc('verify_admin_portal_password' as any, { _password: adminPortalPassword });
      if (pErr || !isValid) {
        await supabase.auth.signOut();
        throw new Error('Dedicated Admin Password ভুল।');
      }
      toast.success('অ্যাডমিন লগইন সফল!');
      playSuccessSound();
    } catch (err: any) {
      disableAdminMode();
      toast.error(err?.message || 'লগইন ব্যর্থ');
    }
    setLoading(false);
  };

  const LoadingSpinner = () => (
    <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> লোড হচ্ছে...</span>
  );

  const inputCls = "pl-10 h-11 rounded-xl bg-background/40 backdrop-blur-sm border-border/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all duration-300 shadow-sm";

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Theme Switcher Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-9 w-9 rounded-xl glass hover:bg-primary/10 hover:text-primary transition-all duration-300 shadow-md"
          title="Theme Switcher"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      {/* ══════ ANIMATED BACKGROUND LAYERS ══════ */}
      <div className="absolute inset-0 aurora-bg" />
      <div className="absolute inset-0 cyber-grid" />

      {/* ══════ BACKGROUND DINING IMAGE ══════ */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.25] dark:opacity-[0.14]">
        <img 
          src="/dining.png" 
          alt="SMC Dining Background" 
          className="w-full h-full object-cover scale-105 filter blur-[1.5px] dark:blur-[2.5px] transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-background/30 via-background/10 to-background/40" />
      </div>

      {/* Morphing blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/8 blob" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 bg-accent/8 blob" style={{ animationDelay: '-3s' }} />
        <div className="absolute -bottom-24 left-1/4 w-80 h-80 bg-info/6 blob" style={{ animationDelay: '-6s' }} />
        <div className="absolute top-2/3 right-1/4 w-64 h-64 bg-destructive/4 blob" style={{ animationDelay: '-1.5s' }} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingParticles />
      </div>

      {/* Matrix rain */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <MatrixRain />
      </div>

      {/* Orbit rings */}
      <OrbitRings />

      {/* Floating icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          { Icon: UtensilsCrossed, top: '12%', left: '8%', delay: '0s', size: 'h-8 w-8' },
          { Icon: Sparkles, top: '20%', right: '12%', delay: '1.2s', size: 'h-6 w-6' },
          { Icon: GraduationCap, bottom: '20%', left: '15%', delay: '2.4s', size: 'h-7 w-7' },
          { Icon: Star, top: '50%', right: '8%', delay: '0.8s', size: 'h-5 w-5' },
          { Icon: Zap, bottom: '30%', right: '20%', delay: '1.6s', size: 'h-6 w-6' },
          { Icon: UtensilsCrossed, top: '70%', left: '5%', delay: '3s', size: 'h-5 w-5' },
        ].map(({ Icon, delay, size, ...pos }, i) => (
          <div
            key={i}
            className="absolute icon-float opacity-[0.08]"
            style={{ ...pos, animationDelay: delay } as any}
          >
            <Icon className={`${size} text-primary`} />
          </div>
        ))}
      </div>

      {/* ══════ MAIN CONTENT ══════ */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className={`w-full max-w-md transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          {/* ── Logo & Title ── */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-5 relative">
              {/* Pulsing rings behind logo */}
              <div className="absolute inset-0 mx-auto h-20 w-20 flex items-center justify-center" style={{ top: -2, left: 'calc(50% - 40px)' }}>
                <div className="absolute h-20 w-20 rounded-2xl border-2 border-primary/20 animate-pulse-ring" />
                <div className="absolute h-20 w-20 rounded-2xl border-2 border-primary/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
                <div className="absolute h-20 w-20 rounded-2xl border-2 border-primary/5 animate-pulse-ring" style={{ animationDelay: '1s' }} />
              </div>
              
              <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-info shadow-2xl shadow-primary/40 animate-bounce-in animate-rotate-3d relative overflow-hidden">
                <UtensilsCrossed className="h-9 w-9 text-primary-foreground relative z-10" />
                {/* Holographic shine */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%', animation: 'shimmer 3s ease-in-out infinite' }} />
              </div>
            </div>

            <h1 className="text-3xl font-extrabold font-bengali gradient-text-hero animate-fade-in-down" style={{ animationDelay: '0.3s' }}>
              সাতক্ষীরা মেডিকেল কলেজ
            </h1>
            <p className="text-sm text-muted-foreground font-bengali mt-2 animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent animate-glow-pulse" />
                মিল ম্যানেজমেন্ট সিস্টেম
                <Sparkles className="h-3.5 w-3.5 text-accent animate-glow-pulse" style={{ animationDelay: '1s' }} />
              </span>
            </p>
          </div>

          {/* ── Auth Card ── */}
          <Card className="holo-card border-0 shadow-2xl animate-scale-in scan-line rounded-2xl" style={{ animationDelay: '0.4s' }}>
            <CardContent className="p-0">
              <Tabs defaultValue="login" onValueChange={() => playClickSound()} className="w-full">
                <TabsList className={`grid w-full ${signupEnabled ? 'grid-cols-3' : 'grid-cols-2'} rounded-none bg-secondary/30 backdrop-blur-sm p-1 h-auto`}>
                  <TabsTrigger value="login" className="font-bengali gap-1 py-2 text-xs data-[state=active]:bg-card/80 data-[state=active]:shadow-md data-[state=active]:shadow-primary/5 rounded-xl transition-all duration-300">
                    <LogIn className="h-3 w-3" /> লগইন
                  </TabsTrigger>
                  {signupEnabled && (
                    <TabsTrigger value="signup" className="font-bengali gap-1 py-2 text-xs data-[state=active]:bg-card/80 data-[state=active]:shadow-md rounded-xl transition-all duration-300">
                      <UserPlus className="h-3 w-3" /> রেজিঃ
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="admin" className="font-bengali gap-1 py-2 text-xs data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive data-[state=active]:shadow-md rounded-xl transition-all duration-300">
                    <ShieldCheck className="h-3 w-3" /> অ্যাডমিন
                  </TabsTrigger>
                </TabsList>

                <div className="p-6">
                  {/* ── LOGIN ── */}
                  <TabsContent value="login" className="mt-0 animate-fade-in">
                    {showForgot ? (
                      <>
                        {/* Step indicator */}
                        <div className="flex items-center justify-center gap-2 pb-4">
                          {['ইমেইল', 'লিংক', 'পাসওয়ার্ড'].map((label, i) => {
                            const stepIndex = { email: 0, otp: 1, newpass: 2 }[forgotStep];
                            const isActive = i === stepIndex;
                            const isDone = i < stepIndex;
                            return (
                              <div key={label} className="flex items-center gap-1.5">
                                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${isActive ? 'bg-primary text-primary-foreground scale-110' : isDone ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                                  {isDone ? '✓' : i + 1}
                                </div>
                                <span className={`text-xs font-bengali ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{label}</span>
                                {i < 2 && <div className={`w-6 h-0.5 ${isDone ? 'bg-primary' : 'bg-border'}`} />}
                              </div>
                            );
                          })}
                        </div>

                        {forgotStep === 'email' && (
                          <form onSubmit={handleForgotSendCode} className="space-y-4 stagger-children">
                            <div className="text-center pb-2">
                              <Lock className="h-10 w-10 text-primary mx-auto mb-2 animate-bounce-in" />
                              <h3 className="font-bengali font-semibold text-lg">পাসওয়ার্ড ভুলে গেছেন?</h3>
                              <p className="text-sm text-muted-foreground font-bengali mt-1">আপনার ইমেইলে ৬ সংখ্যার কোড পাঠানো হবে।</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="font-bengali text-sm">ইমেইল</Label>
                              <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required className={inputCls} placeholder="your@email.com" autoFocus />
                              </div>
                            </div>
                            <Button type="submit" className="w-full font-bengali h-11 rounded-xl bg-gradient-to-r from-primary to-info hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02]" disabled={loading}>
                              {loading ? <LoadingSpinner /> : '📧 কোড পাঠান'}
                            </Button>
                            <Button type="button" variant="ghost" className="w-full font-bengali text-sm gap-1" onClick={resetForgotState}>
                              <ArrowLeft className="h-3.5 w-3.5" /> লগইনে ফিরে যান
                            </Button>
                          </form>
                        )}
                        {forgotStep === 'otp' && (
                          <form onSubmit={(e) => { e.preventDefault(); setForgotStep('newpass'); }} className="space-y-4 stagger-children">
                            <div className="text-center pb-2">
                              <Mail className="h-10 w-10 text-primary mx-auto mb-2 animate-bounce-in" />
                              <h3 className="font-bengali font-semibold text-lg">কোড যাচাই করুন</h3>
                              <p className="text-sm text-muted-foreground font-bengali mt-1">
                                আপনার ৬ সংখ্যার কোড নিচে দিন
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label className="font-bengali text-sm">৬ সংখ্যার কোড</Label>
                              <Input
                                type="text" inputMode="numeric" maxLength={6}
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                required
                                className="text-center text-2xl tracking-[0.5em] h-14 rounded-xl bg-background/50 border-border/50 focus:border-primary/50 font-mono"
                                placeholder="000000"
                                autoFocus
                              />
                            </div>
                            <Button type="submit" className="w-full font-bengali h-11 rounded-xl bg-gradient-to-r from-primary to-info hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02]" disabled={otpCode.length !== 6}>
                              ✅ পরবর্তী ধাপ
                            </Button>
                            <div className="flex items-center justify-between">
                              <Button type="button" variant="ghost" size="sm" className="font-bengali text-xs gap-1" onClick={() => { setForgotStep('email'); setOtpCode(''); }}>
                                <ArrowLeft className="h-3 w-3" /> ইমেইল পরিবর্তন
                              </Button>
                              <Button
                                type="button" variant="ghost" size="sm"
                                className="font-bengali text-xs"
                                onClick={handleResendCode}
                                disabled={resendTimer > 0 || loading}
                              >
                                {resendTimer > 0 ? `আবার পাঠাতে ${resendTimer}সে` : '🔄 আবার কোড পাঠান'}
                              </Button>
                            </div>
                          </form>
                        )}
                        {forgotStep === 'newpass' && (
                          <form onSubmit={handleVerifyAndResetPassword} className="space-y-4 stagger-children">
                            <div className="text-center pb-2">
                              <Lock className="h-10 w-10 text-primary mx-auto mb-2 animate-bounce-in" />
                              <h3 className="font-bengali font-semibold text-lg">নতুন পাসওয়ার্ড সেট করুন</h3>
                              <p className="text-sm text-muted-foreground font-bengali mt-1">কমপক্ষে ৬ অক্ষরের একটি শক্তিশালী পাসওয়ার্ড দিন</p>
                            </div>
                            <div className="space-y-2">
                              <Label className="font-bengali text-sm">নতুন পাসওয়ার্ড</Label>
                              <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className={inputCls} autoFocus />
                              </div>
                              {newPassword && (
                                <div className="flex gap-1 mt-1">
                                  {[1, 2, 3, 4].map(i => (
                                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${newPassword.length >= i * 3 ? (newPassword.length >= 10 ? 'bg-green-500' : newPassword.length >= 8 ? 'bg-yellow-500' : 'bg-red-500') : 'bg-border'}`} />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="font-bengali text-sm">পাসওয়ার্ড নিশ্চিত করুন</Label>
                              <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required minLength={6} className={inputCls} />
                              </div>
                              {confirmNewPassword && newPassword !== confirmNewPassword && (
                                <p className="text-xs text-destructive font-bengali">⚠️ পাসওয়ার্ড মিলছে না</p>
                              )}
                            </div>
                            <Button type="submit" className="w-full font-bengali h-11 rounded-xl bg-gradient-to-r from-primary to-info hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02]" disabled={loading || newPassword.length < 6 || newPassword !== confirmNewPassword}>
                              {loading ? <LoadingSpinner /> : '🔒 পাসওয়ার্ড পরিবর্তন করুন'}
                            </Button>
                          </form>
                        )}
                      </>
                    ) : (
                      <form onSubmit={handleLogin} className="space-y-4 stagger-children">
                        <div className="space-y-2">
                          <Label className="font-bengali text-sm">ইমেইল</Label>
                          <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className={inputCls} placeholder="your@email.com" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bengali text-sm">পাসওয়ার্ড</Label>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className={inputCls} />
                          </div>
                        </div>
                        <Button type="submit" className="w-full font-bengali h-12 rounded-xl bg-gradient-to-r from-primary via-primary to-info text-primary-foreground hover:shadow-xl hover:shadow-primary/30 transition-all duration-500 hover:scale-[1.02] gap-2 text-base font-semibold" disabled={loading}>
                          {loading ? <LoadingSpinner /> : <><LogIn className="h-4 w-4" /> লগইন করুন</>}
                        </Button>
                        <button type="button" className="w-full text-sm text-primary hover:text-primary/80 font-bengali transition-all py-1 hover:tracking-wide" onClick={() => setShowForgot(true)}>
                          পাসওয়ার্ড ভুলে গেছেন?
                        </button>
                      </form>
                    )}
                  </TabsContent>

                  {/* ── SIGNUP ── */}
                  <TabsContent value="signup" className="mt-0 animate-fade-in">
                    <form onSubmit={handleSignup} className="space-y-3.5 stagger-children">
                      <div className="space-y-2">
                        <Label className="font-bengali text-sm">পুরো নাম</Label>
                        <div className="relative group">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input value={fullName} onChange={e => setFullName(e.target.value)} required className={inputCls} placeholder="আপনার নাম" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bengali text-sm">রোল নম্বর</Label>
                        <div className="relative group">
                          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input value={rollNumber} onChange={e => setRollNumber(e.target.value)} placeholder="e.g. 123" className={inputCls} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bengali text-sm">ইমেইল</Label>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required className={inputCls} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bengali text-sm">পাসওয়ার্ড</Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required minLength={6} className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="font-bengali text-sm">Year</Label>
                          <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['1st', '2nd', '3rd', '4th', '5th'].map(y => <SelectItem key={y} value={y}>{y} Year</SelectItem>)}
                              <SelectItem value="extra">Extra</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bengali text-sm">লিঙ্গ</Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">ছেলে (Boys)</SelectItem>
                              <SelectItem value="female">মেয়ে (Girls)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit" className="w-full font-bengali h-12 rounded-xl bg-gradient-to-r from-primary via-primary to-info text-primary-foreground hover:shadow-xl hover:shadow-primary/30 transition-all duration-500 hover:scale-[1.02] gap-2 text-base font-semibold" disabled={loading}>
                        {loading ? <LoadingSpinner /> : <><UserPlus className="h-4 w-4" /> রেজিস্ট্রেশন করুন</>}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* ── ADMIN ── */}
                  <TabsContent value="admin" className="mt-0 animate-fade-in">
                    <form onSubmit={handleAdminLogin} className="space-y-4 stagger-children">
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-destructive/10 to-destructive/5 border border-destructive/20 text-destructive text-sm font-bengali">
                        <ShieldCheck className="h-5 w-5 shrink-0 animate-glow-pulse" />
                        <span>মিল ম্যানেজার, সুপার অ্যাডমিন বা মাস্টার আইডি দিয়ে লগইন করুন।</span>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bengali text-sm">ইমেইল বা মাস্টার আইডি</Label>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-destructive transition-colors" />
                          <Input type="text" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required className={inputCls} placeholder="admin@example.com বা superadmin" autoComplete="username" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bengali text-sm">পাসওয়ার্ড</Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-destructive transition-colors" />
                          <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required className={inputCls} autoComplete="current-password" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bengali text-sm">Dedicated Admin Password <span className="text-xs text-muted-foreground">(শুধু মিল ম্যানেজারের জন্য)</span></Label>
                        <div className="relative group">
                          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-destructive transition-colors" />
                          <Input type="password" value={adminPortalPassword} onChange={e => setAdminPortalPassword(e.target.value)} className={inputCls} placeholder="সুপার অ্যাডমিন/মাস্টার হলে খালি রাখুন" />
                        </div>
                      </div>
                      <Button type="submit" className="w-full font-bengali h-12 rounded-xl bg-gradient-to-r from-destructive via-destructive to-destructive/70 text-destructive-foreground hover:shadow-xl hover:shadow-destructive/30 transition-all duration-500 hover:scale-[1.02] gap-2 text-base font-semibold" disabled={loading}>
                        {loading ? <LoadingSpinner /> : <><ShieldCheck className="h-4 w-4" /> অ্যাডমিন লগইন</>}
                      </Button>
                    </form>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* ── Footer ── */}
          <div className="text-center mt-6 animate-fade-in space-y-1" style={{ animationDelay: '0.8s' }}>
            <p className="text-xs text-muted-foreground font-bengali">
              © ২০২৫ সাতক্ষীরা মেডিকেল কলেজ মিল ম্যানেজমেন্ট
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              Developed by <span className="font-semibold gradient-text-hero">Al Shariear Khan Peal</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick Download FAB ── */}
      <div className="fixed bottom-4 right-4 flex gap-2 z-50 animate-fade-in-up" style={{ animationDelay: '1.2s' }}>
        <button
          onClick={async () => {
            toast.info('ডাউনলোড হচ্ছে...');
            try {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://fmleplqssxndaynmxhjr.supabase.co"}/functions/v1/download-meal-sheet?gender=male`);
              if (!res.ok) throw new Error('No data');
              const { profiles, meals, extraMeals, date } = await res.json();
              const dayOfWeek = new Date(date).getDay();
              const isFeastDay = dayOfWeek === 1 || dayOfWeek === 5;
              await generateMealExcel(profiles, meals, 'male', ['1st','2nd','3rd','4th','5th','extra'], date, 'boys_all', extraMeals || [], isFeastDay);
              toast.success('Boys Excel ডাউনলোড হয়েছে!');
            } catch { toast.error('ডাটা পাওয়া যায়নি'); }
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-info text-primary-foreground px-4 py-2.5 text-xs font-bengali shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 hover:scale-110"
        >
          <Download className="h-3.5 w-3.5" /> Boys
        </button>
        <button
          onClick={async () => {
            toast.info('ডাউনলোড হচ্ছে...');
            try {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://fmleplqssxndaynmxhjr.supabase.co"}/functions/v1/download-meal-sheet?gender=female`);
              if (!res.ok) throw new Error('No data');
              const { profiles, meals, extraMeals, date } = await res.json();
              const dayOfWeek = new Date(date).getDay();
              const isFeastDay = dayOfWeek === 1 || dayOfWeek === 5;
              await generateMealExcel(profiles, meals, 'female', ['1st','2nd','3rd','4th','5th','extra'], date, 'girls_all', extraMeals || [], isFeastDay);
              toast.success('Girls Excel ডাউনলোড হয়েছে!');
            } catch { toast.error('ডাটা পাওয়া যায়নি'); }
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-warning text-accent-foreground px-4 py-2.5 text-xs font-bengali shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 transition-all duration-300 hover:scale-110"
        >
          <Download className="h-3.5 w-3.5" /> Girls
        </button>
      </div>
    </div>
  );
}

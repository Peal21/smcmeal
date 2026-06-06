import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const navigate = useNavigate();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready');
      }
      // Also: if user arrives here with a valid session (recovery already processed)
      if (event === 'SIGNED_IN' && session) {
        setStatus('ready');
      }
    });

    // Check hash for recovery type
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setStatus('ready');
    } else {
      // Check if user already has a session (link already processed)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setStatus('ready');
        } else {
          // Wait for supabase to process the URL
          timeout = setTimeout(() => {
            setStatus(prev => prev === 'checking' ? 'invalid' : prev);
          }, 5000);
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('পাসওয়ার্ড মিলছে না!');
      return;
    }
    if (password.length < 6) {
      toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।');
      await supabase.auth.signOut();
      navigate('/auth');
    }
    setLoading(false);
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground font-bengali">লিংক যাচাই করা হচ্ছে...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <p className="text-muted-foreground font-bengali">অবৈধ বা মেয়াদোত্তীর্ণ লিংক। অনুগ্রহ করে আবার পাসওয়ার্ড রিসেট করুন।</p>
            <Button className="mt-4 font-bengali" onClick={() => navigate('/auth')}>লগইনে ফিরে যান</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <KeyRound className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl font-bold font-bengali">নতুন পাসওয়ার্ড সেট করুন</CardTitle>
          <CardDescription className="font-bengali">আপনার নতুন পাসওয়ার্ড দিন</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <Label className="font-bengali">নতুন পাসওয়ার্ড</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <Label className="font-bengali">পাসওয়ার্ড নিশ্চিত করুন</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full font-bengali" disabled={loading}>
              {loading ? 'লোড হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

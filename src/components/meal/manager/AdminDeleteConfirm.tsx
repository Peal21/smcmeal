import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldAlert, Trash2 } from 'lucide-react';

interface AdminDeleteConfirmProps {
  /** The trigger element (usually a delete button) */
  trigger: React.ReactNode;
  /** Title shown in the confirmation dialog */
  title?: string;
  /** Description shown in the confirmation dialog */
  description?: string;
  /** Called after admin password is verified successfully */
  onConfirm: () => Promise<void> | void;
}

export default function AdminDeleteConfirm({
  trigger,
  title = 'ডিলিট নিশ্চিত করুন',
  description = 'এই অ্যাকশন সম্পন্ন করতে অ্যাডমিন পাসওয়ার্ড দিন।',
  onConfirm,
}: AdminDeleteConfirmProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerifyAndDelete = async () => {
    if (!password.trim()) {
      toast.error('পাসওয়ার্ড দিন');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_admin_portal_password', {
        _password: password,
      });
      if (error) throw error;
      if (!data) {
        toast.error('ভুল পাসওয়ার্ড!');
        setLoading(false);
        return;
      }
      await onConfirm();
      setOpen(false);
      setPassword('');
    } catch (err: any) {
      toast.error(err.message || 'যাচাই করতে সমস্যা হয়েছে');
    }
    setLoading(false);
  };

  return (
    <>
      <div onClick={() => setOpen(true)} className="inline-flex">
        {trigger}
      </div>
      <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPassword(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bengali flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-bengali">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="font-bengali">অ্যাডমিন পাসওয়ার্ড</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="পাসওয়ার্ড লিখুন"
              className="mt-1"
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyAndDelete()}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bengali" onClick={() => setPassword('')}>বাতিল</AlertDialogCancel>
            <Button
              onClick={handleVerifyAndDelete}
              disabled={loading || !password.trim()}
              className="font-bengali bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? 'যাচাই হচ্ছে...' : 'ডিলিট করুন'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

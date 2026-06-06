import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CONGRATS_EVENT } from '@/lib/notify';
import { CheckCircle2, Sparkles } from 'lucide-react';

export default function CongratsDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail || 'সফল হয়েছে';
      setMessage(detail);
      setOpen(true);
      window.setTimeout(() => setOpen(false), 2200);
    };
    window.addEventListener(CONGRATS_EVENT, handler);
    return () => window.removeEventListener(CONGRATS_EVENT, handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-background via-background to-primary/5 shadow-2xl shadow-primary/20">
        <DialogTitle className="sr-only">অভিনন্দন</DialogTitle>
        <DialogDescription className="sr-only">{message}</DialogDescription>
        <div className="flex flex-col items-center text-center py-4 px-2 gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center shadow-lg shadow-primary/40 animate-bounce-in">
              <CheckCircle2 className="h-11 w-11 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-accent animate-glow-pulse" />
            <Sparkles className="absolute -bottom-1 -left-2 h-4 w-4 text-primary animate-glow-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <h2 className="text-3xl font-extrabold font-bengali bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            অভিনন্দন!
          </h2>
          <p className="text-sm font-bengali text-foreground/80 leading-relaxed">
            {message}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

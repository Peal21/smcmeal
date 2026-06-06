import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share, Plus, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return; // Already installed, don't show

    // Check if dismissed recently (don't nag every visit)
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Show again after 3 days
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return;
    }

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    // For Android/Chrome - listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS - show manual instructions after a delay
    if (isiOS) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="max-w-[340px] rounded-2xl border-primary/20 bg-gradient-to-br from-background via-background to-primary/5 p-0 overflow-hidden">
        {/* Top decorative bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />
        
        <div className="p-6 space-y-5">
          <DialogHeader className="space-y-3">
            {/* Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/30 animate-bounce-in">
              <Download className="h-8 w-8 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center font-bengali text-xl font-bold gradient-text">
              অ্যাপ ইনস্টল করুন
            </DialogTitle>
            <DialogDescription className="text-center font-bengali text-sm leading-relaxed">
              আপনার ফোনে অ্যাপটি ইনস্টল করুন — দ্রুত অ্যাক্সেস পাবেন, অফলাইনেও কাজ করবে!
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            /* iOS Manual Instructions */
            <div className="space-y-3 rounded-xl bg-muted/50 p-4 border border-border/50">
              <p className="font-bengali text-sm font-semibold text-foreground">ইনস্টল করতে:</p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="text-xs font-bold">১</span>
                  </div>
                  <p className="font-bengali text-sm text-muted-foreground flex items-center gap-1.5">
                    নিচের <Share className="h-4 w-4 text-primary inline" /> Share বাটনে ক্লিক করুন
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="text-xs font-bold">২</span>
                  </div>
                  <p className="font-bengali text-sm text-muted-foreground flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-primary inline" /> "Add to Home Screen" সিলেক্ট করুন
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="text-xs font-bold">৩</span>
                  </div>
                  <p className="font-bengali text-sm text-muted-foreground">
                    "Add" বাটনে ট্যাপ করুন — ব্যাস!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Android/Chrome Install Button */
            <Button
              onClick={handleInstall}
              className="w-full h-12 rounded-xl font-bengali text-base font-bold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]"
            >
              <Download className="h-5 w-5 mr-2" />
              এখনই ইনস্টল করুন
            </Button>
          )}

          <button
            onClick={handleDismiss}
            className="w-full text-center font-bengali text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            পরে করব
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

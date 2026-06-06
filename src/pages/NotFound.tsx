import { useLocation } from "react-router-dom";
import { useEffect, useMemo } from "react";

function NotFoundParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 2 + Math.random() * 4,
      delay: `${Math.random() * 8}s`,
      duration: `${5 + Math.random() * 7}s`,
      opacity: 0.08 + Math.random() * 0.12,
    })), []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map(p => (
        <div
          key={p.id}
          className="auth-particle animate-particle-rise"
          style={{ left: p.left, width: p.size, height: p.size, animationDelay: p.delay, animationDuration: p.duration, opacity: p.opacity, bottom: 0 }}
        />
      ))}
    </div>
  );
}

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="fixed inset-0 aurora-bg pointer-events-none z-0" />
      <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
      <div className="fixed inset-0 bg-mesh pointer-events-none z-0" />
      <NotFoundParticles />
      
      <div className="relative z-10 text-center animate-fade-in-up">
        <h1 className="mb-4 text-8xl font-black gradient-text-hero animate-float">404</h1>
        <p className="mb-6 text-xl text-muted-foreground font-bengali animate-fade-in" style={{ animationDelay: '0.2s' }}>
          পেজ খুঁজে পাওয়া যায়নি!
        </p>
        <a 
          href="/" 
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-info text-primary-foreground font-bengali font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all duration-500 animate-fade-in"
          style={{ animationDelay: '0.4s' }}
        >
          হোমে ফিরে যান
        </a>
      </div>
    </div>
  );
};

export default NotFound;

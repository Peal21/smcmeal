import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import StudentDashboard from '@/components/meal/StudentDashboard';
import ManagerDashboard from '@/components/meal/ManagerDashboard';
import AppHeader from '@/components/meal/AppHeader';

function DashboardParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 1.5 + Math.random() * 4,
      delay: `${Math.random() * 10}s`,
      duration: `${5 + Math.random() * 8}s`,
      opacity: 0.06 + Math.random() * 0.15,
      colorH: i % 3 === 0 ? '158,64%,36%' : i % 3 === 1 ? '28,92%,54%' : '198,85%,48%',
    })), []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
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
            background: `radial-gradient(circle, hsla(${p.colorH},0.9), transparent)`,
          }}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { isManager, isAdmin, isHistoricalManager, adminMode } = useAuth();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* ══════ SMC COLLEGE PHOTO BACKGROUND SLIDESHOW ══════ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Rotating SMC college photos */}
        <div
          className="absolute inset-0 smc-slide-1"
          style={{
            backgroundImage: 'url(/smc_1.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            filter: 'blur(3px) brightness(0.1) saturate(1.5)',
            transform: 'scale(1.08)',
          }}
        />
        <div
          className="absolute inset-0 smc-slide-2"
          style={{
            backgroundImage: 'url(/smc_2.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(3px) brightness(0.08) saturate(1.6)',
            transform: 'scale(1.08)',
          }}
        />
        <div
          className="absolute inset-0 smc-slide-3"
          style={{
            backgroundImage: 'url(/smc_3.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(3px) brightness(0.08) saturate(1.4)',
            transform: 'scale(1.08)',
          }}
        />
        <div
          className="absolute inset-0 smc-slide-4"
          style={{
            backgroundImage: 'url(/smc_4.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(3px) brightness(0.08) saturate(1.5)',
            transform: 'scale(1.08)',
          }}
        />
        <div
          className="absolute inset-0 smc-slide-5"
          style={{
            backgroundImage: 'url(/smc_5.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(3px) brightness(0.08) saturate(1.6)',
            transform: 'scale(1.08)',
          }}
        />
      </div>

      {/* Animated background layers */}
      <div className="fixed inset-0 aurora-bg pointer-events-none z-0" />
      <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
      <div className="fixed inset-0 bg-mesh pointer-events-none z-0" />
      
      {/* Morphing background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/6 blob" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-accent/6 blob" style={{ animationDelay: '-4s' }} />
        <div className="absolute -bottom-32 right-1/4 w-80 h-80 bg-info/5 blob" style={{ animationDelay: '-2s' }} />
        <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-primary/4 blob" style={{ animationDelay: '-7s' }} />
      </div>

      <DashboardParticles />

      {/* Content */}
      <div className="relative z-10">
        <AppHeader />
        <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-7xl page-enter">
          {adminMode && (isManager || isAdmin || isHistoricalManager) ? <ManagerDashboard /> : <StudentDashboard />}
        </main>
      </div>
    </div>
  );
}

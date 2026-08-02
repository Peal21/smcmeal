import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import StudentDashboard from '@/components/meal/StudentDashboard';
import ManagerDashboard from '@/components/meal/ManagerDashboard';
import AppHeader from '@/components/meal/AppHeader';

function DashboardParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: 2 + Math.random() * 3,
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

export default function Dashboard() {
  const { isManager, isAdmin, isHistoricalManager, adminMode } = useAuth();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background layers */}
      <div className="fixed inset-0 aurora-bg pointer-events-none z-0" />
      <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
      <div className="fixed inset-0 bg-mesh pointer-events-none z-0" />
      
      {/* Morphing background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 blob" />
        <div className="absolute top-1/2 -left-20 w-64 h-64 bg-accent/5 blob" style={{ animationDelay: '-4s' }} />
        <div className="absolute -bottom-32 right-1/4 w-72 h-72 bg-info/4 blob" style={{ animationDelay: '-2s' }} />
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

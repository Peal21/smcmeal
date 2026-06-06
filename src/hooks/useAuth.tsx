import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  roll_number: string | null;
  year: string;
  gender: string;
  phone: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  loading: boolean;
  isManager: boolean;
  isAdmin: boolean;
  adminMode: boolean;
  enableAdminMode: () => void;
  disableAdminMode: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('adminMode') === 'true' || sessionStorage.getItem('adminMode') === 'true';
    } catch {
      return false;
    }
  });

  const enableAdminMode = useCallback(() => {
    try {
      localStorage.setItem('adminMode', 'true');
      sessionStorage.removeItem('adminMode');
    } catch {}
    setAdminMode(true);
  }, []);

  const disableAdminMode = useCallback(() => {
    try {
      localStorage.removeItem('adminMode');
      sessionStorage.removeItem('adminMode');
    } catch {}
    setAdminMode(false);
  }, []);

  const fetchProfileAndRoles = useCallback(async (userId: string) => {
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);
      setProfile((profileRes.data as Profile) ?? null);
      setRoles((rolesRes.data || []).map((r: any) => r.role));
    } catch (e) {
      console.error('Failed to fetch profile/roles', e);
      setProfile(null);
      setRoles([]);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Restore session first
    const init = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfileAndRoles(currentSession.user.id);
        }
      } catch (e) {
        console.error('Auth init error', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    // 2. Listen for subsequent auth changes — NO async work here (prevents deadlock)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) return;

        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          // Fire-and-forget profile fetch — don't block the callback
          fetchProfileAndRoles(nextSession.user.id);
        } else {
          setProfile(null);
          setRoles([]);
          disableAdminMode();
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileAndRoles, disableAdminMode]);

  const signOut = useCallback(async () => {
    disableAdminMode();
    await supabase.auth.signOut();
  }, [disableAdminMode]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfileAndRoles(user.id);
  }, [user, fetchProfileAndRoles]);

  const isManager = roles.includes('meal_manager');
  const isAdmin = roles.includes('super_admin');

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, loading, isManager, isAdmin, adminMode, enableAdminMode, disableAdminMode, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

const fallbackAuthContext: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: false,
  isManager: false,
  isAdmin: false,
  adminMode: false,
  enableAdminMode: () => undefined,
  disableAdminMode: () => undefined,
  signOut: async () => undefined,
  refreshProfile: async () => undefined,
};

export function useAuth() {
  return useContext(AuthContext) ?? fallbackAuthContext;
}

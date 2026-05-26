import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/primary/client";
import { type AppRole, dashboardPathForRole, fetchUserProfile, resolveUserRole } from "@/lib/auth";

type AuthState = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profileName: string | null;
  loading: boolean;
  roleLoading: boolean;
  signOut: () => Promise<void>;
  refreshRole: (authUser?: User | null) => Promise<AppRole | null>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  const refreshRole = useCallback(async (authUser?: User | null) => {
    setRoleLoading(true);
    try {
      let activeUser = authUser ?? user;
      if (!activeUser) {
        const { data } = await supabase.auth.getUser();
        activeUser = data.user ?? null;
      }
      if (!activeUser) {
        setRole(null);
        setProfileName(null);
        return null;
      }
      const email = activeUser.email ?? "";
      const [next, profile] = await Promise.all([
        resolveUserRole(activeUser.id, email),
        fetchUserProfile(activeUser.id, email),
      ]);
      setRole(next);
      setProfileName(
        profile?.full_name ||
          (activeUser.user_metadata?.full_name as string | undefined) ||
          email.split("@")[0] ||
          "User",
      );
      return next;
    } finally {
      setRoleLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setProfileName(null);
      return;
    }
    void refreshRole();
  }, [user, refreshRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfileName(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      role,
      profileName,
      loading,
      roleLoading,
      signOut,
      refreshRole,
    }),
    [session, user, role, profileName, loading, roleLoading, signOut, refreshRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { dashboardPathForRole };

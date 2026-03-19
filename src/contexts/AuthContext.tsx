import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type ProfileSummary = {
  full_name: string | null;
  email: string | null;
};

type AuthContextValue = {
  loading: boolean;
  profile: ProfileSummary | null;
  roles: AppRole[];
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadUserState(user: User | null) {
  if (!user) {
    return { roles: [] as AppRole[], profile: null as ProfileSummary | null };
  }

  const [rolesResponse, profileResponse] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("full_name,email").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  const roles = (rolesResponse.data ?? []).map((item) => item.role);
  const profile = profileResponse.data ?? {
    full_name: user.user_metadata?.full_name ?? null,
    email: user.email ?? null,
  };

  return { roles, profile };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const syncAuthState = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    try {
      const state = await loadUserState(nextSession?.user ?? null);
      setRoles(state.roles);
      setProfile(state.profile);
    } catch (error) {
      console.error("Failed to load auth state", error);
      setRoles([]);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        await syncAuthState(data.session);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      void syncAuthState(nextSession);
    });

    void initialize();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncAuthState]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ loading, profile, roles, session, signIn, signOut, user }),
    [loading, profile, roles, session, signIn, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

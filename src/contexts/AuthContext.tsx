import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "national_supervisor" | "department_supervisor" | "officer" | "viewer";

interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
  unit_id: string | null;
  active: boolean | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  canManagePv: boolean;
  refreshProfile: () => Promise<void>;
}

type LoadedUserData = {
  profile: UserProfile | null;
  roles: AppRole[];
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const latestRequestRef = useRef(0);

  const fetchUserData = useCallback(async (userId: string): Promise<LoadedUserData> => {
    const [{ data: profileData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("auth_user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    return {
      profile: profileData as UserProfile | null,
      roles: (rolesData?.map((r: { role: AppRole }) => r.role) || []) as AppRole[],
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    const nextData = await fetchUserData(user.id);
    setProfile(nextData.profile);
    setRoles(nextData.roles);
  }, [user, fetchUserData]);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const requestId = ++latestRequestRef.current;

    setLoading(true);
    setSession(nextSession);

    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      if (requestId !== latestRequestRef.current) return;
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    try {
      const nextData = await new Promise<LoadedUserData>((resolve, reject) => {
        setTimeout(async () => {
          try {
            resolve(await fetchUserData(nextUser.id));
          } catch (error) {
            reject(error);
          }
        }, 0);
      });

      if (requestId !== latestRequestRef.current) return;
      setProfile(nextData.profile);
      setRoles(nextData.roles);
    } catch {
      if (requestId !== latestRequestRef.current) return;
      setProfile(null);
      setRoles([]);
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
      }
    }
  }, [fetchUserData]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      void applySession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setRoles([]);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = roles.includes("admin");
  const isSupervisor = isAdmin || roles.includes("national_supervisor") || roles.includes("department_supervisor");
  const canManagePv = isAdmin || roles.includes("officer") || roles.includes("department_supervisor");

  return (
    <AuthContext.Provider
      value={{
        session, user, profile, roles, loading,
        signIn, signUp, signOut, resetPassword, updatePassword,
        hasRole, isAdmin, isSupervisor, canManagePv, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

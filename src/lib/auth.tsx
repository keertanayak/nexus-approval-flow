import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "lab_incharge" | "hod" | "principal" | "admin";

export interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  roll_no: string | null;
  department: string;
}

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  roles: AppRole[];
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfileAndRoles(userId: string) {
  const [profileRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  return {
    profile: (profileRes.data as ProfileRow | null) ?? null,
    roles: ((rolesRes.data ?? []) as { role: AppRole }[]).map((r) => r.role),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const hydrate = async (s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    if (s?.user) {
      const { profile, roles } = await fetchProfileAndRoles(s.user.id);
      setProfile(profile);
      setRoles(roles);
    } else {
      setProfile(null);
      setRoles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Set listener BEFORE fetching session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer DB calls to avoid deadlock with the auth callback
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          fetchProfileAndRoles(s.user.id).then(({ profile, roles }) => {
            setProfile(profile);
            setRoles(roles);
          });
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    if (!user) return;
    const { profile, roles } = await fetchProfileAndRoles(user.id);
    setProfile(profile);
    setRoles(roles);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ loading, session, user, profile, roles, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Returns the highest-priority role for routing. */
export function primaryRole(roles: AppRole[]): AppRole {
  const order: AppRole[] = ["admin", "principal", "hod", "lab_incharge", "student"];
  for (const r of order) if (roles.includes(r)) return r;
  return "student";
}

export function dashboardPathForRole(role: AppRole): string {
  switch (role) {
    case "student":
      return "/student/dashboard";
    case "lab_incharge":
    case "hod":
    case "principal":
      return "/approver/dashboard";
    case "admin":
      return "/admin/dues";
  }
}

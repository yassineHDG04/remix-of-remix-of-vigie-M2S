// Authentification Vigie basée sur Lovable Cloud (Supabase Auth).
// Fournit contexte session, user, rôle, profil (statut + must_reset), login/logout, Google.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "Admin" | "Superviseur";
}
export interface AuthProfile {
  status: "actif" | "suspendu" | "invite";
  mustResetPassword: boolean;
  fullName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: AuthProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isReady: boolean;
  hasAccess: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildUser(
  session: Session | null,
  role: "Admin" | "Superviseur",
  fullName: string | null,
): AuthUser | null {
  if (!session?.user) return null;
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
  const email = u.email ?? "";
  const name =
    fullName || meta.full_name || meta.name || (email ? email.split("@")[0] : "Utilisateur");
  return { id: u.id, email, name, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<"Admin" | "Superviseur">("Superviseur");
  const [hasAccess, setHasAccess] = useState<boolean>(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refreshFor = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setRole("Superviseur");
      setProfile(null);
      setHasAccess(true);
      return;
    }
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("profiles")
        .select("status, must_reset_password, full_name")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const list = (roles ?? []).map((r) => r.role);
    setRole(list.includes("admin") ? "Admin" : "Superviseur");
    setHasAccess(list.length > 0);
    if (prof) {
      setProfile({
        status: (prof.status as AuthProfile["status"]) ?? "actif",
        mustResetPassword: !!prof.must_reset_password,
        fullName: prof.full_name ?? "",
      });
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let hadSession = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Flag "just signed in" pour forcer l'écran de chargement après login.
      if (event === "SIGNED_IN" && !hadSession && s?.user) {
        try {
          sessionStorage.setItem("vigie:justSignedIn", "1");
        } catch {
          /* ignore */
        }
      }
      if (event === "SIGNED_OUT") {
        try {
          sessionStorage.removeItem("vigie:justSignedIn");
        } catch {
          /* ignore */
        }
      }
      hadSession = !!s;
      setSession(s);
      setTimeout(() => {
        void refreshFor(s?.user?.id);
      }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      hadSession = !!data.session;
      setSession(data.session);
      void refreshFor(data.session?.user?.id).finally(() => setIsReady(true));
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshFor]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      if (error.message.toLowerCase().includes("invalid")) {
        throw new Error("Identifiants invalides.");
      }
      throw new Error(error.message);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error)
      throw result.error instanceof Error ? result.error : new Error(String(result.error));
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRole("Superviseur");
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await refreshFor(session?.user?.id);
  }, [refreshFor, session?.user?.id]);

  const user = useMemo(
    () => buildUser(session, role, profile?.fullName ?? null),
    [session, role, profile?.fullName],
  );

  const value: AuthContextValue = {
    user,
    profile,
    session,
    isAuthenticated: !!session,
    isReady,
    hasAccess,
    login,
    loginWithGoogle,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}

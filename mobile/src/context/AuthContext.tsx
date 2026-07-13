import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import {
  getSession,
  signIn as authSignIn,
  signOut as authSignOut,
  getAppUser,
  type AppUser,
} from "@/services/auth/authService";

type AuthContextValue = {
  session: boolean;
  user: AppUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<boolean>(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    const s = await getSession();
    setSession(!!s);
    if (s) {
      const u = await getAppUser();
      setUser(u);
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSession().then((s) => {
      if (cancelled) return;
      const hasSession = !!s;
      setSession(hasSession);
      if (hasSession) {
        getAppUser().then((u) => {
          if (!cancelled) setUser(u);
        });
      } else {
        setUser(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authSignIn(email, password);
    if (!result.error && result.user) {
      setSession(true);
      setUser(result.user);
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(false);
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    isLoading,
    signIn,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

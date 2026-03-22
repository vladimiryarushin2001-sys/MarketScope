import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: { message: string } | null }>;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  /** Регистрация или, если email уже есть, вход с этим паролем (при успехе — сразу авторизация). */
  signUpOrSignIn: (email: string, password: string, fullName?: string) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const hasSupabase = isSupabaseConfigured;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string): Promise<{ error: { message: string } | null }> => {
      if (!hasSupabase) {
        return { error: { message: 'Supabase не настроен. Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env' } };
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: fullName ? { data: { full_name: fullName } } : undefined,
      });
      return { error: error ? { message: error.message } : null };
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: { message: string } | null }> => {
      if (!hasSupabase) {
        return { error: { message: 'Supabase не настроен. Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env' } };
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? { message: error.message } : null };
    },
    []
  );

  const signUpOrSignIn = useCallback(
    async (email: string, password: string, fullName?: string): Promise<{ error: { message: string } | null }> => {
      const up = await signUp(email, password, fullName);
      if (!up.error) return { error: null };
      const msg = up.error.message.toLowerCase();
      const isAlreadyRegistered =
        msg.includes('already') || msg.includes('registered') || msg.includes('already registered') || msg.includes('уже зарегистрирован');
      if (!isAlreadyRegistered) return up;
      return signIn(email, password);
    },
    [signUp, signIn]
  );

  const signOut = useCallback(async () => {
    if (hasSupabase) await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    authLoading,
    signUp,
    signIn,
    signUpOrSignIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, pass: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, pass: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  demoLogin: () => void;
  isDemoUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);

  useEffect(() => {
    // Initialize session from Supabase if configured
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setIsDemoUser(false);
        }
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } else {
      // Auto demo user mode if Supabase env vars not set
      demoLogin();
      setLoading(false);
    }
  }, []);

  const demoLogin = () => {
    const mockUser = {
      id: 'demo-user-0001',
      email: 'engineer@atm-ai.internal',
      user_metadata: { full_name: 'Senior Document AI Lead' },
      app_metadata: { provider: 'demo' },
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as unknown as User;

    setUser(mockUser);
    setIsDemoUser(true);
    setLoading(false);
  };

  const signInWithPassword = async (email: string, pass: string) => {
    if (!isSupabaseConfigured()) {
      demoLogin();
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  };

  const signUpWithPassword = async (email: string, pass: string) => {
    if (!isSupabaseConfigured()) {
      demoLogin();
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Sign up failed' };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured() && !isDemoUser) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setIsDemoUser(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithPassword,
        signUpWithPassword,
        signOut,
        demoLogin,
        isDemoUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

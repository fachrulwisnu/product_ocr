import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight, Server, KeyRound, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signInWithPassword, signUpWithPassword, demoLogin } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      setLoading(false);
      return;
    }

    const res = isSignUp
      ? await signUpWithPassword(email, password)
      : await signInWithPassword(email, password);

    if (res.error) {
      setErrorMsg(res.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-white">Enterprise ATM Document AI</h1>
            <p className="text-xs text-slate-400 font-mono">Phase 5 Hybrid Reasoning & Annotation Engine</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@enterprise.com"
                className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{isSignUp ? 'Create Supabase Account' : 'Sign In with Supabase Auth'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="hover:text-indigo-400 underline cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Register'}
          </button>

          <button
            type="button"
            onClick={demoLogin}
            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick Demo Mode</span>
          </button>
        </div>

        <div className="mt-6 p-3 rounded bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Phase 5 Enterprise Platform Status:</span>
          </div>
          <p>• Multi-Tenant Projects & Supabase Auth</p>
          <p>• Hybrid OCR & Ultra Reasoning LLM Engines Active</p>
          <p>• Annotation Studio & HITL Verification Table</p>
        </div>
      </div>
    </div>
  );
};

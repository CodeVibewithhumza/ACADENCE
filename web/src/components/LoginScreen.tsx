import { useState } from 'react';
import { Lock, Mail, Shield, Sparkles, Building2, UserCheck, AlertCircle, ArrowRight } from 'lucide-react';
import type { User } from '../types/auth';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('hello@123.com');
  const [password, setPassword] = useState('123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts = [
    { role: 'ADMIN', label: 'Super Admin', email: 'hello@123.com', pass: '123', color: 'bg-purple-950/60 border-purple-500/40 text-purple-300' },
    { role: 'COORDINATOR', label: 'Coordinator', email: 'coordinator@acadence.edu', pass: '123', color: 'bg-blue-950/60 border-blue-500/40 text-blue-300' },
    { role: 'FACULTY', label: 'Faculty', email: 'faculty.sharma@acadence.edu', pass: '123', color: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' },
    { role: 'STUDENT', label: 'Student', email: 'student.fyup@acadence.edu', pass: '123', color: 'bg-amber-950/60 border-amber-500/40 text-amber-300' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed. Please check credentials.');
      }

      const authenticatedUser: User = {
        ...data.user,
        token: data.token,
      };

      localStorage.setItem('acadence_auth_user', JSON.stringify(authenticatedUser));
      onLoginSuccess(authenticatedUser);
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickFill(accEmail: string, accPass: string) {
    setEmail(accEmail);
    setPassword(accPass);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 mb-2">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Autonomous Academic Timetable Optimization System</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              ACADENCE
            </h1>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            AI-Powered Conflict-Free Timetable Generation & Resource Scheduling
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-7 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Sign In to Acadence Portal
            </h2>
            <p className="text-xs text-slate-400">
              Enter your institutional credentials or choose a pre-configured role below.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Institutional Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@123.com"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="123"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Role Selector */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Quick Role Switch (Demo Mode)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleQuickFill(acc.email, acc.pass)}
                  className={`p-2 rounded-lg border text-left text-xs transition hover:scale-[1.02] flex items-center justify-between ${acc.color}`}
                >
                  <div>
                    <div className="font-bold">{acc.label}</div>
                    <div className="text-[10px] opacity-75">{acc.email.split('@')[0]}</div>
                  </div>
                  <UserCheck className="w-3.5 h-3.5 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Supabase Notice Footer */}
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Supabase Ready: Database credentials can be configured inside Settings.</span>
        </div>
      </div>
    </div>
  );
}


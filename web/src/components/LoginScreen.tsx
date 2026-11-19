import { useState } from 'react';
import { Lock, Mail, Shield, Building2, AlertCircle, ArrowRight, Eye, EyeOff, Sparkles, CheckCircle2, Cpu } from 'lucide-react';
import type { User } from '../types/auth';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('hello@123.com');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative overflow-hidden font-sans select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* ========================================================================= */}
      {/* LEFT SECTION: Modern Academic Showcase & Visual Experience                */}
      {/* ========================================================================= */}
      <div className="relative lg:w-7/12 xl:w-2/3 hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden border-r border-slate-800/80">
        {/* Architectural Background Image with Ambient Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity filter brightness-110 contrast-125"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop')`,
          }}
        />
        {/* Subtle Gradient Overlays for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent" />

        {/* Top Branding Pill */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/40 border border-white/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">ACADENCE</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  PRO v2.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Autonomous Academic Timetable Optimization System</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 backdrop-blur-md text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-[11px]">System Online • Cloud Synced</span>
          </div>
        </div>

        {/* Center Hero Information */}
        <div className="relative z-10 my-auto py-12 max-w-2xl space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI-Driven Constraint Satisfaction Engine</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Intelligent Academic Scheduling & Institutional Resource Harmony.
            </h1>
            <p className="text-slate-300 text-sm xl:text-base leading-relaxed">
              Empowering universities with mathematical CP-SAT optimization. Eliminate faculty collisions, room double-bookings, and student cohort overlaps across complex degree curriculums with guaranteed zero conflicts.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/90 backdrop-blur-md space-y-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">OR-Tools CP-SAT</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Sub-second mathematical solver satisfying all hard & soft institutional constraints.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/90 backdrop-blur-md space-y-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">Room Splitting</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Dynamic cohort split and collision-free room matching for large lecture batches.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/90 backdrop-blur-md space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">Role Governance</h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                Strict granular RBAC for Super Administrators, Coordinators, and Faculty members.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Institutional Seal */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-400">Institutional Timetable Operating System</span>
          </div>
          <span className="text-[11px] text-slate-500">Academic Year 2026-2027 • NEP Compliant</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT SECTION: Sleek, High-Aesthetic Institutional Sign-In Form           */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-5/12 xl:w-1/3 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 my-auto">
        {/* Mobile Header Branding (Shown on smaller screens) */}
        <div className="lg:hidden text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Academic Portal</span>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">ACADENCE</h1>
          </div>
        </div>

        {/* Clean Login Card */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 backdrop-blur-2xl rounded-3xl p-8 sm:p-9 shadow-2xl space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 text-[11px] font-bold uppercase tracking-wider">
              <Lock className="w-3 h-3" />
              <span>Secure Authentication</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Sign In to Portal
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter your verified institutional credentials to access your academic dashboard and schedules.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Institutional Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@institution.edu"
                required
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Password</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-4 pr-11 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold rounded-xl transition duration-200 shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99] mt-2"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Subtle Security & Encrypted Session Indicator */}
          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-slate-500" />
            <span>End-to-End Encrypted Institutional Session</span>
          </div>
        </div>

        {/* Clean Footer */}
        <p className="mt-8 text-center text-[11px] text-slate-500">
          &copy; {new Date().getFullYear()} Acadence Academic Systems. All rights reserved.
        </p>
      </div>
    </div>
  );
}

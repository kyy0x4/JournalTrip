import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Mail, Lock, ArrowRight, ShieldCheck, Truck, Activity,
  Eye, EyeOff, Sparkles, Gauge, Clock, Radio
} from 'lucide-react';
import { useLoginStats } from '../hooks/useLoginStats';
import Logo from '../image/Logo.png';
import LoginImg from '../image/login.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const navigate = useNavigate();
  const { stats } = useLoginStats();

  // CountUp: animasi angka saat nilai berubah
  const [display, setDisplay] = useState({ activeFleet: 0, onTimeRate: 0, liveTrips: 0 });
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDisplay({ activeFleet: stats.activeFleet, onTimeRate: stats.onTimeRate, liveTrips: stats.liveTrips });
    }, 600);
    return () => window.clearTimeout(id);
  }, [stats]);

  const fmtActive = display.activeFleet.toLocaleString('id-ID');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Gagal login, periksa kembali email & password Anda.');
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "peer w-full pl-12 pr-4 py-3.5 bg-white/70 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/[0.08] rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600";

  const inputWrap =
    "group relative rounded-2xl focus-within:shadow-[0_8px_30px_-8px_rgba(217,119,87,0.35)] transition-shadow duration-300";

  return (
    <div className="min-h-screen bg-[--bg-app] flex font-sans relative overflow-hidden">
      {/* ── FULL-SCREEN AURORA BACKGROUND ── */}
      <div className="aurora-bg" aria-hidden="true" />
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-red-300/15 dark:bg-red-500/[0.07] rounded-full blur-[130px] -translate-y-1/3 translate-x-1/4" />

      {/* ── LEFT COLUMN - FORM ── */}
      <div className="w-full lg:w-[42%] flex flex-col items-center justify-center p-6 md:p-10 relative z-10">
        <div className="w-full max-w-md">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center mb-10"
          >
            <img src={Logo} alt="K Line" className="h-11 object-contain mb-2" />
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.28em]">
              Fleet Monitoring
            </p>
          </motion.div>

          {/* Glass Card */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card rounded-4xl p-8 md:p-10 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-red-400/50 to-transparent" />

            <div className="mb-8">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Selamat Datang
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 15 }}
                  className="inline-block ml-1.5"
                >
                  👋
                </motion.span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                Masuk untuk mengelola operasional armada Anda.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="p-3.5 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-2xl font-medium border border-rose-100 dark:border-rose-900/50 flex items-start gap-2.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                  {error}
                </motion.div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Email
                </label>
                <div className={inputWrap}>
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors duration-300" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@kline.com"
                    required
                    className={inputBase}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="login-password" className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                  Password
                </label>
                <div className={inputWrap}>
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-red-500 transition-colors duration-300" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className={`${inputBase} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
                <span className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="w-4.5 h-4.5 appearance-none rounded-md border-2 border-slate-300 dark:border-slate-600 transition-all cursor-pointer bg-white/60 dark:bg-white/[0.05] checked:bg-red-500 checked:border-red-500 checked:shadow-[0_0_10px_rgba(217,119,87,0.4)]"
                  />
                  <svg
                    viewBox="0 0 24 24"
                    className={`absolute w-3 h-3 text-white pointer-events-none transition-all duration-200 ${remember ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Remember me</span>
              </label>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { scale: 1.02, y: -1 } : undefined}
                whileTap={!loading ? { scale: 0.98 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="relative w-full py-4 claude-gradient text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/30 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden group/btn mt-2"
              >
                <motion.div
                  initial={false}
                  animate={loading ? { x: ['-150%', '250%'] } : { x: '-150%' }}
                  transition={{ duration: 1.1, repeat: loading ? Infinity : 0, ease: 'easeInOut' }}
                  className="absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]"
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    <>
                      Sign In
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </motion.span>
                    </>
                  )}
                </span>
              </motion.button>
            </form>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest"
          >
            &copy; 2026 PT. K Line Mobaru Diamond Indonesia
          </motion.p>
        </div>
      </div>

      {/* ── RIGHT COLUMN - LOGISTIC SYSTEM ILLUSTRATION ── */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-10 relative overflow-hidden">
        <div className="absolute inset-0 claude-gradient-soft" />
        <div className="absolute bottom-0 left-0 w-[440px] h-[440px] bg-orange-300/20 dark:bg-orange-500/[0.06] rounded-full blur-[110px] translate-y-1/3 -translate-x-1/4" />

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 text-center mb-8 mt-4"
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/50 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] text-[10px] font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400 mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Logistic System Platform
          </span>
          <h1 className="text-4xl xl:text-[44px] font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
            Manage &amp; Verify
            <br />
            <span className="claude-gradient bg-clip-text text-transparent">
              Fleet Readiness
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 max-w-sm mx-auto leading-relaxed">
            Tenko, gatepass, monitoring ritase, dan analitik keselamatan dalam satu platform.
          </p>
        </motion.div>

        {/* Big Illustration with floating stat cards */}
        <div className="relative z-10 w-full max-w-[620px]">
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Glass frame untuk ilustrasi */}
            <div className="glass-card rounded-4xl p-5 md:p-7 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-red-400/40 to-transparent" />
              <img
                src={LoginImg}
                alt="Logistic System Illustration"
                className="w-full h-auto rounded-3xl"
              />
              <div className="absolute bottom-0 inset-x-0 h-24 bg-linear-to-t from-red-950/10 to-transparent pointer-events-none" />
            </div>

            {/* Floating stat card - fleet status */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-10 -left-4 glass-card rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">
                  {fmtActive}
                  <motion.span
                    key={stats.activeFleet}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-block ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle animate-pulse"
                  />
                </p>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">Armada Aktif</p>
              </div>
            </motion.div>

            {/* Floating stat card - on-time */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.65, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-14 -right-4 glass-card rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl"
            >
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Gauge className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{display.onTimeRate.toLocaleString('id-ID')}%</p>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">On-Time Bulan Ini</p>
              </div>
            </motion.div>

            {/* Floating stat card - live monitoring */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-1/3 -right-8 glass-card rounded-2xl px-4 py-3 items-center gap-3 shadow-xl hidden xl:flex"
            >
              <div className="relative w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{display.liveTrips.toLocaleString('id-ID')}</p>
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 text-blue-500" /> Trip Berjalan
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="relative z-10 flex items-center gap-3 mt-8 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-red-500" /> Tenko
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-red-500" /> LeadTime
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-red-500" /> Live Tracking
          </span>
        </motion.div>
      </div>
    </div>
  );
}

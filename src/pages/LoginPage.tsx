import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, ShieldCheck, Truck, Activity } from 'lucide-react';
import Logo from '../image/Logo.png';
import LoginImg from '../image/login.svg';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  const inputClass =
    "w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600";

  return (
    <div className="min-h-screen bg-[--bg-app] flex font-sans">
      {/* LEFT COLUMN - FORM */}
      <div className="w-full lg:w-[45%] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900/60 relative z-10 shadow-2xl">
        <div className="w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center mb-14"
          >
            <img src={Logo} alt="K Line" className="h-10 object-contain" />
          </motion.div>

          <motion.form
            onSubmit={handleLogin}
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-2xl font-medium text-center border border-rose-100 dark:border-rose-900/50"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@kline.com"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-start gap-3 pt-2 pb-4">
              <input
                type="checkbox"
                id="remember"
                className="mt-1 w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary/50 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Remember me
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">Save my login details for next time.</span>
              </label>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={!loading ? { scale: 1.02 } : undefined}
              whileTap={!loading ? { scale: 0.98 } : undefined}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="claude-gradient w-full py-4 text-white text-sm font-bold rounded-2xl shadow-lg shadow-red-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </motion.form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-16 text-center"
          >
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              &copy; 2026 PT. K Line Mobaru Diamond Indonesia
            </p>
          </motion.div>
        </div>
      </div>

      {/* RIGHT COLUMN - ILLUSTRATION (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative aurora blobs menyatu dengan background */}
        <div className="absolute inset-0 claude-gradient-soft" />
        <div className="absolute top-0 right-0 w-[520px] h-[520px] bg-red-400/20 rounded-full blur-[110px] -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[440px] h-[440px] bg-orange-300/25 rounded-full blur-[110px] translate-y-1/3 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-[380px] h-[380px] bg-red-200/20 dark:bg-red-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 text-center mb-8 mt-8"
        >
          <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug">
            Securely Manage And Verify <br />
            Fleet Readiness
          </h1>
          <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight mt-2 flex items-center justify-center gap-3">
            With <img src={Logo} alt="K Line" className="h-9 object-contain inline-block" />
            <span className="text-red-500">K Line !</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[620px] animate-float"
        >
          <img
            src={LoginImg}
            alt="Fleet Monitoring Illustration"
            className="w-full h-auto drop-shadow-[0_20px_40px_rgba(160,74,46,0.15)] dark:opacity-90"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="relative z-10 flex items-center gap-4 mt-8 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-red-500" /> Tenko
          </span>
          <span className="flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-red-500" /> P2H
          </span>
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-red-500" /> Live Monitoring
          </span>
        </motion.div>
      </div>
    </div>
  );
}

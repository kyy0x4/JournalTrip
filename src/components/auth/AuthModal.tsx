import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import Logo from '../../image/Logo.png';
import HeroImg from '../../image/20945966.webp';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const emailToLogin = username.includes('@') ? username : `${username.trim()}@kline.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password,
      });

      if (error) throw error;
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal login, periksa kembali email & password Anda.');
    } finally {
      setLoading(false);
    }
  };
  useEscapeKey(onClose, isOpen);


  return (
    createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-99999 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 bg-white/50 backdrop-blur-md rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* LEFT COLUMN - FORM */}
            <div className="w-full md:w-1/2 flex flex-col p-8 md:p-10 justify-center relative z-10 bg-white">
              <div className="w-full max-w-sm mx-auto">
                <div className="flex justify-center mb-10">
                  <img src={Logo} alt="K Line" className="h-8 object-contain" />
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  {error && (
                    <div className="p-3 text-xs text-rose-600 bg-rose-50 rounded-xl font-medium text-center">
                      {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Username</label>
                    <input 
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Contoh: mekanik1"
                      required
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                    <input 
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-1 pb-2">
                    <input type="checkbox" id="remember" className="mt-0.5 w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" />
                    <label htmlFor="remember" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Remember me
                      <span className="block text-[9px] text-slate-400 font-medium">Save my login details for next time.</span>
                    </label>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 active:scale-[0.98] text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Authenticating...' : 'Sign In'}
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT COLUMN - IMAGE */}
            <div className="hidden md:flex flex-1 bg-slate-50 flex-col items-center justify-center p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-linear-to-br from-blue-100 to-transparent rounded-full opacity-50 -translate-y-1/2 translate-x-1/3" />
              
              <div className="text-center z-10 mb-8 mt-4">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-snug">
                  Securely Verify <br /> Fleet Readiness
                </h2>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
                  With <span className="text-blue-500">K Line !</span>
                </h3>
              </div>
              
              <img 
                src={HeroImg} 
                alt="Illustration" 
                className="w-full max-w-[350px] object-contain z-10 mix-blend-multiply drop-shadow-xl"
              />
            </div>
            </motion.div>
          </div>
        )}
    </AnimatePresence>,
    document.body
    )
  );
}

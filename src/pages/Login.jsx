import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, ArrowRight, Activity, ShieldCheck, Zap } from 'lucide-react';

export default function Login() {
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });

    // Futuristic parallax effect for background elements
    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 20,
                y: (e.clientY / window.innerHeight - 0.5) * 20,
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const res = isLogin
            ? await login(formData.email, formData.password)
            : await register(formData.name, formData.email, formData.password);

        if (!res.success) {
            setError(res.error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] overflow-hidden flex items-center justify-center p-4 relative font-sans selection:bg-[#6366f1]/30">
            {/* Animated Futuristic Background Layer */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-[#6366f1] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"
                    style={{ transform: `translate(${mousePos.x}px, ${mousePos.y}px)`, transition: 'transform 0.2s ease-out' }}
                />
                <div
                    className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-[#818cf8] rounded-full mix-blend-screen filter blur-[150px] opacity-10"
                    style={{ transform: `translate(${-mousePos.x * 1.5}px, ${-mousePos.y * 1.5}px)`, transition: 'transform 0.2s ease-out' }}
                />
                {/* Abstract Grid dots */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNykiLz48L3N2Zz4=')] opacity-60"></div>
            </div>

            {/* Main Glassmorphic Container */}
            <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-700 group perspective-1000">

                {/* Glow border ring behind the card */}
                <div className="absolute -inset-[1px] bg-gradient-to-br from-[#6366f1]/80 via-transparent to-[#818cf8]/50 rounded-[2rem] opacity-30 group-hover:opacity-70 transition duration-1000 blur-sm pointer-events-none"></div>

                <div className="relative bg-[#0f172a]/80 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] p-10 overflow-hidden">

                    {/* Subtle top glare effect */}
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    {/* Subtle bottom glare effect */}
                    <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#6366f1]/30 to-transparent"></div>

                    {/* Header & Branding */}
                    <div className="text-center mb-10 relative">
                        <div className="inline-flex items-center justify-center mb-6 relative">
                            <div className="absolute inset-0 bg-[#6366f1] blur-[25px] opacity-50 rounded-full animate-pulse"></div>
                            <div className="relative bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#6366f1]/40 p-4 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transform group-hover:scale-105 transition-transform duration-500">
                                <Activity size={32} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                            </div>
                        </div>
                        <h1 className="text-4xl font-[Outfit] font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-slate-400 mb-2 tracking-tight">
                            {isLogin ? 'Access Portal' : 'Initialize Account'}
                        </h1>
                        <p className="text-[#818cf8] font-bold text-xs tracking-[0.2em] uppercase font-[Inter]">
                            {isLogin ? 'Secure CX Gateway' : 'Establish Presence'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-8 animate-in slide-in-from-top-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-medium flex items-center justify-center gap-3 backdrop-blur-md shadow-inner">
                            <Zap size={16} className="text-red-500 flex-shrink-0 animate-pulse" />
                            <span className="truncate">{error}</span>
                        </div>
                    )}

                    {/* Form Structure */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className={`space-y-5 transition-all duration-500 origin-top ${!isLogin ? 'opacity-100 scale-y-100 h-auto' : 'opacity-0 scale-y-0 h-0 overflow-hidden hidden'}`}>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Full Name</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        required={!isLogin}
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5 px-1">
                                <label className="block text-sm font-medium text-slate-300">Password</label>
                                {isLogin && <a href="#" className="text-sm font-medium text-indigo-400 hover:text-white transition-colors">Forgot password?</a>}
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner tracking-widest"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-8 bg-gradient-to-r from-[#4f46e5] to-[#6366f1] pt-3.5 pb-3.5 px-6 rounded-xl shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_30px_rgba(99,102,241,0.6)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-3 group/btn disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 relative overflow-hidden"
                        >
                            {/* Button Inner Shimmer */}
                            <div className="absolute inset-0 w-full h-full gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] animate-[shimmer_2.5s_infinite]"></div>
                            <div className="absolute top-0 inset-x-0 h-[1px] bg-white/40"></div>

                            {loading ? (
                                <div className="h-5 w-5 border-2 border-white/20 border-t-white/90 rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="font-[Outfit] font-bold tracking-[0.15em] text-white text-[13px] uppercase">
                                        {isLogin ? 'Initiate Link' : 'Generate Identity'}
                                    </span>
                                    <ArrowRight size={18} className="text-white group-hover/btn:translate-x-1.5 transition-transform duration-300" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer toggle */}
                    <div className="mt-10 text-center relative z-10">
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                                setFormData({ name: '', email: '', password: '' });
                            }}
                            className="group text-sm text-slate-400 hover:text-white transition-colors duration-300 flex flex-col items-center justify-center gap-1 mx-auto"
                        >
                            <span className="text-[11px] uppercase tracking-widest font-semibold opacity-70">
                                {isLogin ? "Require network clearance?" : "Active grid deployment?"}
                            </span>
                            <span className="text-[#818cf8] font-bold group-hover:text-white transition-colors duration-300 font-[Outfit] tracking-wide relative">
                                {isLogin ? 'REQUEST ACCESS' : 'AUTHENTICATE NOW'}
                                <div className="absolute -bottom-1 left-0 right-0 h-px bg-[#818cf8]/50 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center"></div>
                            </span>
                        </button>
                    </div>

                    {/* Secure watermark */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-1.5 opacity-30 pointer-events-none">
                        <ShieldCheck size={14} className="text-[#818cf8]" />
                        <span className="text-[9px] font-[Inter] tracking-[0.2em] text-[#818cf8] uppercase font-bold">Encrypted Link 256</span>
                    </div>

                    {/* Decorative Corner Borders */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#6366f1]/30 rounded-tl-2xl pointer-events-none"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#6366f1]/30 rounded-tr-2xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#6366f1]/30 rounded-bl-2xl pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#6366f1]/30 rounded-br-2xl pointer-events-none"></div>

                </div>
            </div>

            <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(150%);
          }
        }
      `}</style>
        </div>
    );
}

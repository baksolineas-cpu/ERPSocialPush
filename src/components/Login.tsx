import React from 'react';
import { useAuth } from './AuthProvider';
import { LogIn, ShieldCheck, Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoggingIn(true);
    await login(email);
    setIsLoggingIn(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-8">
        <div className="flex justify-center">
          <div className="p-4 bg-blue-50 rounded-2xl">
            <ShieldCheck size={48} className="text-blue-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Social Push® ERP</h1>
          <p className="text-slate-500">Acceso Restringido | Ingresa con tu correo y contraseña.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Correo Electrónico</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
          >
            {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
            Ingresar al Sistema
          </button>
        </form>

        <p className="text-xs text-slate-400">
          Al ingresar, aceptas los términos de uso y el aviso de privacidad de BAKSO, S.C.
        </p>
      </div>
    </div>
  );
}

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ClipboardList, 
  Menu, 
  X,
  ShieldCheck,
  LogIn,
  LogOut,
  Lock,
  Megaphone,
  Briefcase,
  DollarSign,
  BookOpen,
  Settings,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from './AuthProvider';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const location = useLocation();
  const { user, loading, logout, login } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['Admin'] },
    { name: 'Entrevista Hub', href: '/entrevista', icon: Activity, roles: ['Admin', 'Promoción'] },
    { name: 'Promoción', href: '/promocion', icon: Megaphone, roles: ['Admin', 'Promoción'] },
    { name: 'Operaciones', href: '/operaciones', icon: Briefcase, roles: ['Admin'] },
    { name: 'Tesorería', href: '/tesoreria', icon: DollarSign, roles: ['Admin'] },
    { name: 'Contabilidad', href: '/contabilidad', icon: BookOpen, roles: ['Admin'] },
    { name: 'Administración', href: '/admin', icon: Settings, roles: ['Admin'] },
  ];

  const filteredNavigation = navigation.filter(item => item.roles.includes(user?.role || ''));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>; // El manejo de login se hará en App.tsx
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Universal Header (Consolidated Layout) */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div className="hidden md:block overflow-hidden">
              <h1 className="font-bold text-slate-900 text-[11px] leading-tight uppercase tracking-tighter truncate">Social Push® ERP</h1>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest truncate">REINI V1</p>
            </div>
          </Link>
          
          <div className="h-8 w-px bg-slate-100 mx-2 hidden lg:block" />
          
          <nav className="hidden lg:flex items-center gap-1">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    isActive 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon size={14} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <button 
            className="p-2 text-slate-600 lg:hidden"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{user.name}</p>
            <div className="flex items-center justify-end gap-2">
              <span className={cn(
                "text-[8px] font-black uppercase px-2 py-0.5 rounded-md",
                user.role === 'Admin' ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
              )}>
                {user.role}
              </span>
              <p className="text-[10px] text-slate-400 font-bold">{user.email}</p>
            </div>
          </div>
          
          <div className="h-8 w-px bg-slate-100 hidden sm:block" />

          <button 
            onClick={logout}
            className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-slate-100"
            title="Cerrar Sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-16 bg-white border-b border-slate-200 z-[90] lg:hidden p-4 shadow-2xl"
          >
            <nav className="space-y-2">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-4 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
                      isActive 
                        ? "bg-blue-600 text-white shadow-xl" 
                        : "bg-slate-50 text-slate-600"
                    )}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <item.icon size={18} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full relative">
        {children}
      </main>
    </div>
  );
}

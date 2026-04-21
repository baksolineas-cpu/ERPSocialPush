import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  TrendingUp, 
  Target, 
  Calendar,
  Send,
  Video,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PromocionDashboard() {
  const kpis = [
    { label: 'Leads Recibidos vs. Contactados', value: '85%', subValue: '210/247', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Contactados vs. Entrevistas', value: '42%', subValue: '88/210', icon: Target, color: 'text-gold', bg: 'bg-gold/10' },
  ];

  const appointments = [
    { fecha: '2026-04-19', hora: '10:00 AM', prospecto: 'Juan Pérez', estatus: 'Confirmado', platform: 'Google Meet' },
    { fecha: '2026-04-19', hora: '11:15 AM', prospecto: 'María García', estatus: 'Pendiente', platform: 'WhatsApp Video' },
    { fecha: '2026-04-19', hora: '01:00 PM', prospecto: 'Roberto Sánchez', estatus: 'En Proceso', platform: 'Google Meet' },
    { fecha: '2026-04-20', hora: '09:30 AM', prospecto: 'Elena Mendoza', estatus: 'Confirmado', platform: 'Presencial' },
  ];

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-navy uppercase tracking-tighter italic">Promoción & Difusión</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Panel de Control de Leads y Agendamiento</p>
        </div>
        <button className="bg-navy text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-navy/20 hover:scale-105 transition-all flex items-center gap-2">
          <Calendar size={16} /> Nueva Cita
        </button>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {kpis.map((kpi, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6"
          >
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", kpi.bg)}>
              <kpi.icon className={kpi.color} size={32} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-navy">{kpi.value}</span>
                <span className="text-xs font-bold text-slate-400">{kpi.subValue}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Integration Panel */}
      <section className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-navy uppercase tracking-tight italic">Integración Google Calendar</h3>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Sincronización en Tiempo Real</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha/Hora</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Prospecto</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {appointments.map((appt, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-navy">{appt.fecha}</span>
                      <span className="text-[10px] font-bold text-slate-400 italic">{appt.hora}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600">
                        {appt.prospecto.charAt(0)}
                      </div>
                      <span className="text-xs font-black text-navy">{appt.prospecto}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      {appt.platform === 'Google Meet' || appt.platform === 'WhatsApp Video' ? <Video size={14} className="text-blue-500" /> : <Monitor size={14} className="text-slate-400" />}
                      {appt.platform}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-1 rounded-lg border",
                      appt.estatus === 'Confirmado' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      appt.estatus === 'Pendiente' ? "bg-amber-50 text-amber-600 border-amber-100" :
                      "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {appt.estatus}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button className="bg-[#003366] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gold hover:text-[#003366] transition-all shadow-md shadow-navy/10 flex items-center gap-2 ml-auto">
                      Iniciar Entrevista <Send size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const Monitor = ({ size, className }: { size: number, className: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </svg>
);

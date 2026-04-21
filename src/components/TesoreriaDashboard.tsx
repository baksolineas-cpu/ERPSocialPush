import React from 'react';
import { motion } from 'motion/react';
import { 
  DollarSign, 
  ArrowRightLeft, 
  Wallet, 
  CheckCircle2, 
  PieChart, 
  ArrowDownCircle,
  Calculator,
  ShieldCheck
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export default function TesoreriaDashboard() {
  const accountKPIs = [
    { label: 'Saldo en Cuenta Concentradora', value: 1250480, subValue: 'IMSS + Honorarios', icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Saldo en Cuenta de Honorarios', value: 485200, subValue: 'Utilidad Neta Social Push', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const dispersionData = [
    { cliente: 'Juan Pérez', curp: 'PERJ88...', total: 8500, imss: 6200, neto: 2300, estatus: 'Pendiente' },
    { cliente: 'María García', curp: 'GARM90...', total: 7200, imss: 5100, neto: 2100, estatus: 'Pendiente' },
    { cliente: 'Roberto Sánchez', curp: 'SANR75...', total: 9100, imss: 6800, neto: 2300, estatus: 'Pendiente' },
    { cliente: 'Elena Mendoza', curp: 'MENE82...', total: 6800, imss: 4900, neto: 1900, estatus: 'Aprobado' },
  ];

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-navy uppercase tracking-tighter italic">Tesorería</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Dispersión de Fondos y Control de Saldos</p>
        </div>
        <button className="bg-emerald-600 text-white px-8 py-4 rounded-[20px] font-black text-[11px] uppercase tracking-widest shadow-xl shadow-emerald-200 hover:scale-105 transition-all flex items-center gap-3">
          <ShieldCheck size={20} /> Aprobar Dispersión Masiva
        </button>
      </header>

      {/* Account KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accountKPIs.map((kpi, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-6">
               <div className={cn("w-20 h-20 rounded-[32px] flex items-center justify-center", kpi.bg)}>
                 <kpi.icon className={kpi.color} size={40} />
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                  <h4 className="text-4xl font-black text-navy tracking-tighter">{formatCurrency(kpi.value)}</h4>
                  <p className="text-[10px] font-bold text-slate-400 italic">({kpi.subValue})</p>
               </div>
            </div>
            <div className="hidden lg:block">
               <PieChart size={64} className="text-slate-100" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Dispersion Tool */}
      <section className="bg-white rounded-[56px] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gold/20 rounded-2xl flex items-center justify-center text-gold border border-gold/30">
              <Calculator size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight italic">Cálculo de Dispersión Automática</h3>
              <p className="text-[9px] text-white/50 font-black uppercase tracking-widest">Fórmula: [Total Depositado] - [Pago IMSS] = [Honorarios Netos]</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motor de Cálculo Listo</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente / ID</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Depositado</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pago IMSS (Retención)</th>
                <th className="px-10 py-5 text-[10px] font-black text-gold uppercase tracking-widest font-black">Honorarios Netos</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dispersionData.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-navy">{d.cliente}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.curp}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <span className="text-sm font-black text-slate-600">{formatCurrency(d.total)}</span>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-2">
                       <ArrowRightLeft size={14} className="text-red-300" />
                       <span className="text-sm font-black text-red-500">-{formatCurrency(d.imss)}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="bg-gold/5 border border-gold/10 px-4 py-2 rounded-xl inline-block">
                      <span className="text-lg font-black text-navy">{formatCurrency(d.neto)}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <button className={cn(
                      "px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                      d.estatus === 'Pendiente' ? "bg-slate-100 text-slate-400 hover:bg-navy hover:text-white" : "bg-emerald-50 text-emerald-600 cursor-default"
                    )}>
                      {d.estatus === 'Pendiente' ? 'Aprobar' : 'Dispersado'}
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

import React from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Search,
  BookOpen,
  Filter,
  BarChart3
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

export default function ContabilidadDashboard() {
  const billingData = [
    { nombre: 'Juan Pérez', id: 'SP-2026-001', rfc: 'PERJ880101XYZ', neto: 2300, estatus: 'Validado' },
    { nombre: 'Roberto Sánchez', id: 'SP-2026-003', rfc: 'SANR750303ABC', neto: 2300, estatus: 'Procesado' },
    { nombre: 'Elena Mendoza', id: 'SP-2026-004', rfc: 'MENE820404DEF', neto: 1900, estatus: 'Validado' },
    { nombre: 'Mario Luquín', id: 'SP-2026-005', rfc: 'LUQM700101GHI', neto: 2500, estatus: 'Pendiente' },
  ];

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-navy uppercase tracking-tighter italic">Contabilidad Administrativa</h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Facturación Pura y Reportes para Despacho Externo</p>
        </div>
        <div className="flex gap-4">
          <button className="bg-white text-navy border border-slate-200 px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
            <Filter size={16} /> Filtrar Mes
          </button>
          <button className="bg-navy text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-navy/20 hover:scale-105 transition-all flex items-center gap-2">
            <Download size={16} /> Exportar Reporte CSV
          </button>
        </div>
      </header>

      {/* Summary Mini-Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
             <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Registros Validados</p>
            <p className="text-xl font-black text-navy">124</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
             <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monto Pendiente Facturar</p>
            <p className="text-xl font-black text-navy">{formatCurrency(385420)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center">
             <BookOpen size={24} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Último Cierre</p>
            <p className="text-xl font-black text-navy">31 Mar 2026</p>
          </div>
        </div>
      </div>

      {/* Billing Table */}
      <section className="bg-white rounded-[48px] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-white flex items-center justify-between">
           <h3 className="text-lg font-black text-navy uppercase tracking-tight italic">Facturación Pura (Registros Conciliados)</h3>
           <div className="flex items-center gap-4">
             <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
               <input 
                 type="text" 
                 placeholder="Buscar por RFC o Nombre..." 
                 className="pl-12 pr-6 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest w-64 outline-none focus:ring-2 focus:ring-navy/5"
               />
             </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Cliente</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">RFC Extraído</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Registro</th>
                <th className="px-10 py-5 text-[10px] font-black text-navy uppercase tracking-widest">Honorarios a Facturar</th>
                <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estatus fiscal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {billingData.map((reg, idx) => (
                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-10 py-7">
                    <span className="text-xs font-black text-navy">{reg.nombre}</span>
                  </td>
                  <td className="px-10 py-7">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-slate-500 font-mono tracking-tighter">{reg.rfc}</span>
                       <button className="text-slate-300 hover:text-navy transition-colors"><ExternalLink size={12} /></button>
                    </div>
                  </td>
                  <td className="px-10 py-7 text-[10px] font-bold text-slate-400 tracking-widest">{reg.id}</td>
                  <td className="px-10 py-7">
                    <span className="text-sm font-black text-navy">{formatCurrency(reg.neto)}</span>
                  </td>
                  <td className="px-10 py-7 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <div className={cn(
                         "w-1.5 h-1.5 rounded-full",
                         reg.estatus === 'Validado' ? "bg-emerald-500" : 
                         reg.estatus === 'Procesado' ? "bg-blue-500" : "bg-amber-500"
                       )} />
                       <span className={cn(
                         "text-[9px] font-black uppercase tracking-widest",
                         reg.estatus === 'Validado' ? "text-emerald-600" : 
                         reg.estatus === 'Procesado' ? "text-blue-600" : "text-amber-600"
                       )}>{reg.estatus}</span>
                    </div>
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
